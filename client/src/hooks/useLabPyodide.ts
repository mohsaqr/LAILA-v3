import { useState, useEffect, useCallback, useRef } from 'react';
import { debug } from '../utils/debug';

interface PyodideOutput {
  type: 'stdout' | 'stderr' | 'plot' | 'message';
  content: string;
}

interface ExecutionResult {
  success: boolean;
  outputs: PyodideOutput[];
  error?: string;
}

interface UseLabPyodideReturn {
  isReady: boolean;
  isLoading: boolean;
  isExecuting: boolean;
  isInstallingPackages: boolean;
  packagesInstalled: boolean;
  loadingStatus: string;
  error: string | null;
  executeCode: (code: string) => Promise<ExecutionResult>;
  reset: () => Promise<void>;
}

// Package configurations for different Python lab types
const PYTHON_LAB_PACKAGES: Record<string, string[]> = {
  python: ['numpy', 'pandas', 'matplotlib'],
  'python-data': ['numpy', 'pandas', 'matplotlib', 'scipy', 'scikit-learn'],
  'python-ml': ['numpy', 'pandas', 'matplotlib', 'scikit-learn', 'scipy'],
  'python-stats': ['numpy', 'pandas', 'matplotlib', 'scipy', 'statsmodels'],
  'python-viz': ['numpy', 'pandas', 'matplotlib'],
  'python-sna': ['numpy', 'matplotlib', 'scipy', 'networkx'],
};

// Python plot capture helper — injected into every session
const PLOT_CAPTURE_HELPER = `
import io, base64, sys

def __capture_plot__():
    """Capture current matplotlib figure as base64 PNG and print marker."""
    try:
        import matplotlib.pyplot as plt
        figs = [plt.figure(n) for n in plt.get_fignums()]
        for fig in figs:
            buf = io.BytesIO()
            fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
            buf.seek(0)
            b64 = base64.b64encode(buf.getvalue()).decode()
            buf.close()
            print(f"__PLOT_BASE64__{b64}__END_PLOT__")
        plt.close('all')
    except Exception:
        pass

# Patch plt.show to auto-capture
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    _original_show = plt.show
    def _patched_show(*args, **kwargs):
        __capture_plot__()
    plt.show = _patched_show
except ImportError:
    pass
`;

export const useLabPyodide = (labType: string = 'python'): UseLabPyodideReturn => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isInstallingPackages, setIsInstallingPackages] = useState(false);
  const [packagesInstalled, setPackagesInstalled] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Initializing Python...');
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pyodideRef = useRef<any>(null);
  const initializingRef = useRef(false);

  // Get packages for this lab type
  const getPackagesForLabType = useCallback((type: string): string[] => {
    return PYTHON_LAB_PACKAGES[type] || PYTHON_LAB_PACKAGES.python;
  }, []);

  // Install packages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const installPackages = useCallback(async (pyodide: any, type: string) => {
    const packages = getPackagesForLabType(type);
    if (packages.length === 0) return true;

    setIsInstallingPackages(true);

    try {
      await pyodide.loadPackage('micropip');
      const micropip = pyodide.pyimport('micropip');

      for (const pkg of packages) {
        setLoadingStatus(`Installing ${pkg}...`);
        debug.webr?.(`[Lab Pyodide] Installing package: ${pkg}`);
        try {
          await micropip.install(pkg);
          debug.webr?.(`[Lab Pyodide] Successfully installed: ${pkg}`);
        } catch (installErr) {
          debug.webr?.(`[Lab Pyodide] Warning: Could not install ${pkg}:`, installErr);
        }
      }

      setPackagesInstalled(true);
      return true;
    } catch (err) {
      debug.error?.('[Lab Pyodide] Package installation error:', err);
      throw err;
    } finally {
      setIsInstallingPackages(false);
    }
  }, [getPackagesForLabType]);

  // Initialize Pyodide
  const initPyodide = useCallback(async () => {
    if (initializingRef.current || pyodideRef.current) return;

    initializingRef.current = true;
    setIsLoading(true);
    setError(null);
    setLoadingStatus('Initializing Python...');

    debug.webr?.(`[Lab Pyodide] Starting initialization for lab type: ${labType}`);

    try {
      // Dynamic import — Pyodide is loaded from CDN at runtime
      const { loadPyodide } = await import('pyodide');
      const pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
      });

      debug.webr?.('[Lab Pyodide] Pyodide initialized successfully');

      pyodideRef.current = pyodide;

      // Install packages
      await installPackages(pyodide, labType);

      // Install plot capture helper
      setLoadingStatus('Setting up environment...');
      await pyodide.runPythonAsync(PLOT_CAPTURE_HELPER);

      setIsReady(true);
      setLoadingStatus('Ready');
      debug.webr?.('[Lab Pyodide] Ready to execute Python code');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Python';
      setError(errorMessage);
      debug.error?.('[Lab Pyodide] Initialization error:', err);
    } finally {
      setIsLoading(false);
      initializingRef.current = false;
    }
  }, [labType, installPackages]);

  // Initialize on mount
  useEffect(() => {
    initPyodide();

    return () => {
      pyodideRef.current = null;
    };
  }, [initPyodide]);

  // Parse output for plots (same markers as WebR)
  const parseOutput = (output: string): PyodideOutput[] => {
    const outputs: PyodideOutput[] = [];
    const plotRegex = /__PLOT_BASE64__(.+?)__END_PLOT__/g;
    let match;
    let lastIndex = 0;

    while ((match = plotRegex.exec(output)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = output.substring(lastIndex, match.index).trim();
        if (textBefore) {
          outputs.push({ type: 'stdout', content: textBefore });
        }
      }
      outputs.push({ type: 'plot', content: match[1] });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < output.length) {
      const remaining = output.substring(lastIndex).trim();
      if (remaining) {
        outputs.push({ type: 'stdout', content: remaining });
      }
    }

    if (outputs.length === 0 && output.trim()) {
      outputs.push({ type: 'stdout', content: output });
    }

    return outputs;
  };

  // Execute Python code
  const executeCode = useCallback(async (code: string): Promise<ExecutionResult> => {
    if (!pyodideRef.current || !isReady) {
      return { success: false, outputs: [], error: 'Python is not ready' };
    }

    setIsExecuting(true);

    try {
      const pyodide = pyodideRef.current;

      // Capture stdout and stderr
      const captureCode = `
import sys, io

__stdout_capture__ = io.StringIO()
__stderr_capture__ = io.StringIO()
__old_stdout__ = sys.stdout
__old_stderr__ = sys.stderr
sys.stdout = __stdout_capture__
sys.stderr = __stderr_capture__

__exec_error__ = None
__exec_result__ = None
try:
    __exec_result__ = None
    __code__ = compile(${JSON.stringify(code)}, '<user>', 'exec')
    exec(__code__)
    # Auto-capture any open matplotlib figures
    __capture_plot__()
except Exception as __e__:
    __exec_error__ = str(__e__)
finally:
    sys.stdout = __old_stdout__
    sys.stderr = __old_stderr__

__combined__ = __stdout_capture__.getvalue()
if __stderr_capture__.getvalue():
    __combined__ += "\\n__STDERR__" + __stderr_capture__.getvalue()
if __exec_error__:
    __combined__ += "\\nError: " + __exec_error__
__combined__
`;

      const result = await pyodide.runPythonAsync(captureCode);
      const resultStr = typeof result === 'string' ? result : (result?.toString() || '');

      // Split stderr if present
      const outputs: PyodideOutput[] = [];
      const stderrIdx = resultStr.indexOf('\n__STDERR__');
      let mainOutput = resultStr;

      if (stderrIdx !== -1) {
        mainOutput = resultStr.substring(0, stderrIdx);
        const stderrContent = resultStr.substring(stderrIdx + '\n__STDERR__'.length).trim();
        if (stderrContent) {
          outputs.push(...parseOutput(mainOutput));
          outputs.push({ type: 'stderr', content: stderrContent });
        }
      }

      if (outputs.length === 0) {
        outputs.push(...parseOutput(mainOutput));
      }

      const hasError = resultStr.includes('Error: ');

      return {
        success: !hasError,
        outputs,
        error: hasError ? resultStr : undefined,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Execution failed';
      return {
        success: false,
        outputs: [{ type: 'stderr', content: errorMessage }],
        error: errorMessage,
      };
    } finally {
      setIsExecuting(false);
    }
  }, [isReady]);

  // Reset session
  const reset = useCallback(async () => {
    pyodideRef.current = null;
    setIsReady(false);
    setPackagesInstalled(false);
    setError(null);
    initializingRef.current = false;
    await initPyodide();
  }, [initPyodide]);

  return {
    isReady,
    isLoading,
    isExecuting,
    isInstallingPackages,
    packagesInstalled,
    loadingStatus,
    error,
    executeCode,
    reset,
  };
};
