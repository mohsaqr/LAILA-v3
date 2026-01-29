import { useState, useEffect, useCallback, useRef } from 'react';
import { WebR } from 'webr';
import { debug } from '../utils/debug';

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
  error: string | null;
  executeCode: (code: string) => Promise<ExecutionResult>;
  reset: () => Promise<void>;
}

export const useWebR = (): UseWebRReturn => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const webRRef = useRef<WebR | null>(null);
  const initializingRef = useRef(false);

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

      webRRef.current = webR;
      setIsReady(true);
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

      // Use captureR for cleaner output handling
      const result = await webR.evalRString(`
        paste(capture.output({
          tryCatch(
            { ${code} },
            error = function(e) cat("Error:", conditionMessage(e), "\\n"),
            warning = function(w) { cat("Warning:", conditionMessage(w), "\\n"); invokeRestart("muffleWarning") }
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
    setIsReady(false);
    setError(null);
    await initWebR();
  }, [initWebR]);

  return {
    isReady,
    isLoading,
    isExecuting,
    error,
    executeCode,
    reset,
  };
};
