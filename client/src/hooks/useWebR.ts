import { useState, useEffect, useCallback, useRef } from 'react';
import { WebR } from 'webr';

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

    try {
      const webR = new WebR();
      await webR.init();

      // Set up default options for better output handling
      await webR.evalRVoid(`
        options(
          width = 80,
          warn = 1,
          digits = 7
        )
      `);

      webRRef.current = webR;
      setIsReady(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize WebR';
      setError(errorMessage);
      console.error('WebR initialization error:', err);
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
    if (!webRRef.current || !isReady) {
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

      // Use evalRCode with output capture
      // First, capture stdout/stderr by wrapping the code
      const wrappedCode = `
        .webr_output <- capture.output({
          .webr_result <- tryCatch({
            ${code}
          }, error = function(e) {
            cat("Error:", conditionMessage(e), "\\n", file = stderr())
            NULL
          }, warning = function(w) {
            cat("Warning:", conditionMessage(w), "\\n", file = stderr())
            invokeRestart("muffleWarning")
          })
        }, type = "output")
        if (length(.webr_output) > 0) cat(.webr_output, sep = "\\n")
        .webr_result
      `;

      // Execute and get result
      const result = await webR.evalR(wrappedCode);

      // Get the printed output
      const outputLines = await webR.evalRString(`
        paste(capture.output(print(.webr_result)), collapse = "\\n")
      `).catch(() => '');

      if (outputLines && outputLines.trim()) {
        outputs.push({ type: 'stdout', content: outputLines });
      }

      // Destroy the result to free memory
      if (result && typeof result === 'object' && 'destroy' in result) {
        await (result as { destroy: () => Promise<void> }).destroy();
      }

      return {
        success: true,
        outputs,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Execution failed';
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
