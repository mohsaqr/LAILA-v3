import { useState, useEffect, useCallback, useRef } from 'react';
import { WebR } from 'webr';
import { debug } from '../utils/debug';
import { NETWORK_SHIM } from './webrNetworkShim';
import { R_CONSOLE_HELPERS, evalAllCall } from './rRunner';

interface WebROutput {
  type: 'stdout' | 'stderr' | 'plot' | 'message';
  content: string;
}

interface ExecutionResult {
  success: boolean;
  outputs: WebROutput[];
  error?: string;
}

interface UseWebRReturn {
  isReady: boolean;
  isLoading: boolean;
  isExecuting: boolean;
  isInstallingPackages: boolean;
  /** Requested packages with no webR binary that failed to install. */
  failedPackages: string[];
  loadingStatus: string;
  error: string | null;
  executeCode: (code: string) => Promise<ExecutionResult>;
  reset: () => Promise<void>;
}

export const useWebR = (
  /** Packages detected from the notebook's own library() calls. */
  extraPackages: string[] = []
): UseWebRReturn => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isInstallingPackages, setIsInstallingPackages] = useState(false);
  const [failedPackages, setFailedPackages] = useState<string[]>([]);
  const [loadingStatus, setLoadingStatus] = useState('Initializing R...');
  const [error, setError] = useState<string | null>(null);

  const webRRef = useRef<WebR | null>(null);
  const initializingRef = useRef(false);
  // Packages already installed in the CURRENT session; cleared on reset (a
  // reset builds a fresh webR, so everything must be reinstalled).
  const installedRef = useRef<Set<string>>(new Set());

  // Initialize WebR
  const initWebR = useCallback(async () => {
    if (initializingRef.current || webRRef.current) return;

    initializingRef.current = true;
    setIsLoading(true);
    setError(null);

    debug.webr('[WebR] Starting initialization...');

    try {
      const webR = new WebR();
      debug.webr('[WebR] WebR instance created, calling init()...');
      await webR.init();
      debug.webr('[WebR] WebR initialized successfully');

      // Set up default options for better output handling
      await webR.evalRVoid(`
        options(
          width = 80,
          warn = 1,
          digits = 7
        )
      `);
      debug.webr('[WebR] Default options set');

      // Makes `import("<url>")` and friends reach the network at all — see
      // webrNetworkShim.ts for why they otherwise cannot.
      await webR.evalRVoid(NETWORK_SHIM);
      await webR.evalRVoid(R_CONSOLE_HELPERS);

      webRRef.current = webR;
      setIsReady(true);
      setLoadingStatus('Ready');
      debug.webr('[WebR] Ready to execute R code');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize WebR';
      setError(errorMessage);
      debug.error('[WebR] Initialization error:', err);
    } finally {
      setIsLoading(false);
      initializingRef.current = false;
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initWebR();

    // Cleanup on unmount
    return () => {
      if (webRRef.current) {
        webRRef.current.close();
        webRRef.current = null;
      }
    };
  }, [initWebR]);

  // Install exactly the packages the notebook loads, once webR is ready and the
  // (async-loaded) package list is known. Re-runs if the list grows; only ever
  // installs what's missing. webR's binary installer only has packages with a
  // WASM build — the rest are reported via failedPackages.
  useEffect(() => {
    const webR = webRRef.current;
    if (!webR || !isReady) return;
    const missing = [...new Set(extraPackages)].filter(p => !installedRef.current.has(p));
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      setIsInstallingPackages(true);
      const installed: string[] = [];
      const failed: string[] = [];

      // One call for the whole list — see the note in useLabWebR: a loop
      // re-resolves the dependency closure per package and never overlaps its
      // requests.
      missing.forEach(pkg => installedRef.current.add(pkg)); // don't retry in a loop
      setLoadingStatus(
        missing.length === 1 ? `Installing ${missing[0]}...` : `Installing ${missing.length} packages...`
      );
      try {
        await webR.installPackages(missing, { quiet: true });
        installed.push(...missing);
      } catch (batchErr) {
        // Retry individually only here, to find which package actually failed.
        debug.webr('[WebR] Batch install failed, retrying individually:', batchErr);
        for (const pkg of missing) {
          if (cancelled) return;
          try {
            await webR.installPackages([pkg], { quiet: true });
            installed.push(pkg);
          } catch (installErr) {
            failed.push(pkg);
            debug.webr(`[WebR] Warning: could not install ${pkg}:`, installErr);
          }
        }
      }
      if (cancelled) return;
      if (installed.length > 0) {
        setLoadingStatus('Loading packages...');
        await webR.evalRVoid(
          `suppressWarnings(suppressMessages({ ${installed
            .map(p => `tryCatch(library(${p}, quietly = TRUE), error = function(e) NULL)`)
            .join('; ')} }))`
        );
      }
      if (!cancelled) {
        if (failed.length > 0) setFailedPackages(prev => [...new Set([...prev, ...failed])]);
        setIsInstallingPackages(false);
        setLoadingStatus('Ready');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [extraPackages, isReady]);

  // Execute R code
  const executeCode = useCallback(async (code: string): Promise<ExecutionResult> => {
    debug.webr('[WebR] executeCode called, isReady:', isReady, 'hasWebR:', !!webRRef.current);

    if (!webRRef.current || !isReady) {
      debug.webr('[WebR] Not ready, returning error');
      return {
        success: false,
        outputs: [],
        error: 'WebR is not ready',
      };
    }

    setIsExecuting(true);
    const outputs: WebROutput[] = [];

    try {
      const webR = webRRef.current;
      debug.webr('[WebR] Executing code:', code.substring(0, 100) + '...');

      // Warnings are handled by withCallingHandlers, NOT by tryCatch. A
      // tryCatch warning handler is an *exiting* handler: it unwinds the stack
      // before running, so `muffleWarning` no longer exists by the time
      // invokeRestart looks for it and the whole cell dies with "no 'restart'
      // 'muffleWarning' found". withCallingHandlers runs the handler in place,
      // with the restart still established, so the warning prints and the cell
      // carries on.
      const result = await webR.evalRString(`
        paste(capture.output({
          tryCatch(
            withCallingHandlers(
              ${evalAllCall(code)},
              warning = function(w) { cat("Warning:", conditionMessage(w), "\\n"); invokeRestart("muffleWarning") }
            ),
            error = function(e) cat("Error:", conditionMessage(e), "\\n")
          )
        }), collapse = "\\n")
      `);

      debug.webr('[WebR] Execution result:', result);

      if (result && result.trim()) {
        outputs.push({ type: 'stdout', content: result });
      }

      // Check if there was an error in the output
      const hasError = result.includes('Error:');

      return {
        success: !hasError,
        outputs,
        error: hasError ? result : undefined,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Execution failed';
      debug.error('[WebR] Execution error:', err);
      outputs.push({ type: 'stderr', content: errorMessage });

      return {
        success: false,
        outputs,
        error: errorMessage,
      };
    } finally {
      setIsExecuting(false);
    }
  }, [isReady]);

  // Reset the R session
  const reset = useCallback(async () => {
    if (webRRef.current) {
      webRRef.current.close();
      webRRef.current = null;
    }
    // Fresh session — nothing is installed anymore, so allow reinstalls.
    installedRef.current = new Set();
    setFailedPackages([]);
    setIsReady(false);
    setError(null);
    await initWebR();
  }, [initWebR]);

  return {
    isReady,
    isLoading,
    isExecuting,
    isInstallingPackages,
    failedPackages,
    loadingStatus,
    error,
    executeCode,
    reset,
  };
};
