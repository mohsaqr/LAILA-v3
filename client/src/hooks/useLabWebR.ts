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

interface UseLabWebRReturn {
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

// Package configurations for different lab types
const LAB_PACKAGES: Record<string, string[]> = {
  tna: [
    'base64enc',
    'rlang',
    'dplyr',
    'ggplot2',
    'igraph',
    'tidygraph',
    'ggraph',
    'ggforce',
    'ggfittext',
    'tna',
  ],
  statistics: [
    'base64enc',  // For plot capture only
  ],
  network: [
    'base64enc',
    'igraph',
    'ggplot2',
  ],
  dataviz: [
    'base64enc',
    'ggplot2',
  ],
  regression: [
    'base64enc',
  ],
  clustering: [
    'base64enc',
  ],
  timeseries: [
    'base64enc',
  ],
  sequence: [
    'base64enc',
  ],
  text: [
    'base64enc',
  ],
  custom: [
    'base64enc',
  ],
};

// Base plot capture helper (works for all lab types)
const BASE_PLOT_HELPER = `
# Universal plot capture function
.capture_to_base64 <- function(plot_obj = NULL) {
  tmp <- tempfile(fileext = ".png")
  png(tmp, width = 800, height = 600, res = 100)

  tryCatch({
    if (!is.null(plot_obj)) {
      if (inherits(plot_obj, c("gg", "ggplot", "tna", "Heatmap"))) {
        print(plot_obj)
      } else {
        tryCatch(print(plot_obj), error = function(e) NULL)
      }
    }
    dev.off()

    if (file.exists(tmp) && file.info(tmp)$size > 0) {
      raw_data <- readBin(tmp, "raw", file.info(tmp)$size)
      b64 <- base64enc::base64encode(raw_data)
      unlink(tmp)
      cat("__PLOT_BASE64__", b64, "__END_PLOT__", sep = "")
    } else {
      unlink(tmp)
    }
  }, error = function(e) {
    tryCatch(dev.off(), error = function(x) NULL)
    unlink(tmp)
    message(paste("Plot error:", e$message))
  })
  invisible(plot_obj)
}

# General capture_plot for any plot expression
capture_plot <- function(expr) {
  tmp <- tempfile(fileext = ".png")
  png(tmp, width = 800, height = 600, res = 100)

  result <- tryCatch({
    res <- eval(expr)
    if (inherits(res, c("gg", "ggplot", "tna", "Heatmap"))) {
      print(res)
    }
    res
  }, error = function(e) {
    tryCatch(dev.off(), error = function(x) NULL)
    unlink(tmp)
    stop(e)
  })

  tryCatch(dev.off(), error = function(e) NULL)

  if (file.exists(tmp) && file.info(tmp)$size > 0) {
    raw_data <- readBin(tmp, "raw", file.info(tmp)$size)
    b64 <- base64enc::base64encode(raw_data)
    unlink(tmp)
    cat("__PLOT_BASE64__", b64, "__END_PLOT__", sep = "")
  } else {
    unlink(tmp)
  }
  invisible(result)
}
`;

// TNA-specific helper (only loaded for TNA labs)
const TNA_PLOT_HELPER = `
# TNA network visualization using ggraph
ggplot_tna <- function(x, digits = 2, min_weight = 0.05, ...) {
  tmp <- tempfile(fileext = ".png")

  tryCatch({
    xlen <- nrow(x$weights)

    weights_filtered <- x$weights
    weights_filtered[weights_filtered < min_weight] <- 0

    graph_data <- tidygraph::as_tbl_graph(weights_filtered) |>
      tidygraph::activate("edges") |>
      dplyr::filter(weight >= min_weight) |>
      tidygraph::activate("nodes") |>
      dplyr::mutate(inits = x$inits)

    p <- ggraph::ggraph(graph_data, layout = "circle") +
      ggraph::geom_edge_arc(
        ggplot2::aes(
          label = round(!!rlang::sym("weight"), digits),
          width = !!rlang::sym("weight")
        ),
        color = "darkblue",
        alpha = 0.8,
        angle_calc = "along",
        label_dodge = ggplot2::unit(0.025, "native"),
        arrow = ggplot2::arrow(length = ggplot2::unit(0.025, "native")),
        start_cap = ggraph::circle(0.18, unit = "native"),
        end_cap = ggraph::circle(0.18, unit = "native"),
        strength = 0.25,
        show.legend = FALSE
      ) +
      ggraph::geom_edge_loop(
        ggplot2::aes(
          label = round(!!rlang::sym("weight"), 2),
          direction = (!!rlang::sym("from") - 1) * 360 / xlen,
          width = !!rlang::sym("weight"),
          span = 100
        ),
        color = "darkblue",
        alpha = 0.8,
        angle_calc = "along",
        label_dodge = ggplot2::unit(0.025, "native"),
        arrow = ggplot2::arrow(length = ggplot2::unit(0.025, "native")),
        start_cap = ggraph::circle(0.18, unit = "native"),
        end_cap = ggraph::circle(0.18, unit = "native"),
        show.legend = FALSE
      ) +
      ggraph::geom_node_circle(ggplot2::aes(r = 0.18), fill = "white") +
      ggraph::geom_node_circle(ggplot2::aes(r = 0.15)) +
      ggforce::geom_arc_bar(
        ggplot2::aes(
          x0 = !!rlang::sym("x"),
          y0 = !!rlang::sym("y"),
          r0 = 0.15,
          r = 0.18,
          start = 0,
          end = !!rlang::sym("inits") * base::pi * 2
        ),
        fill = "gray"
      ) +
      ggfittext::geom_fit_text(
        ggplot2::aes(
          label = !!rlang::sym("name"),
          xmin = !!rlang::sym("x") - 0.14,
          xmax = !!rlang::sym("x") + 0.14,
          y = !!rlang::sym("y")
        )
      ) +
      ggraph::scale_edge_width(range = c(0.5, 3)) +
      ggplot2::coord_fixed(clip = "off") +
      ggplot2::expand_limits(x = c(-1.5, 1.5), y = c(-1.5, 1.5)) +
      ggraph::theme_graph() +
      ggplot2::theme(
        plot.margin = ggplot2::margin(0, 0, 0, 0),
        panel.spacing = ggplot2::unit(0, "lines")
      )

    png(tmp, width = 1400, height = 1400, res = 100)
    print(p)
    dev.off()

    if (file.exists(tmp) && file.info(tmp)$size > 0) {
      raw_data <- readBin(tmp, "raw", file.info(tmp)$size)
      b64 <- base64enc::base64encode(raw_data)
      unlink(tmp)
      cat("__PLOT_BASE64__", b64, "__END_PLOT__", sep = "")
    } else {
      unlink(tmp)
      cat("Could not generate plot\\n")
    }
  }, error = function(e) {
    tryCatch(dev.off(), error = function(x) NULL)
    unlink(tmp)
    cat("Plot error:", e$message, "\\n")
  })

  invisible(NULL)
}
`;

export const useLabWebR = (labType: string = 'custom'): UseLabWebRReturn => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isInstallingPackages, setIsInstallingPackages] = useState(false);
  const [packagesInstalled, setPackagesInstalled] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Initializing WebR...');
  const [error, setError] = useState<string | null>(null);

  const webRRef = useRef<WebR | null>(null);
  const initializingRef = useRef(false);
  const currentLabTypeRef = useRef(labType);

  // Get packages for this lab type
  const getPackagesForLabType = useCallback((type: string): string[] => {
    return LAB_PACKAGES[type] || LAB_PACKAGES.custom;
  }, []);

  // Install packages for the lab type
  const installPackages = useCallback(async (webR: WebR, type: string) => {
    const packages = getPackagesForLabType(type);

    if (packages.length === 0) {
      return true;
    }

    setIsInstallingPackages(true);
    const installedPackages: string[] = [];

    try {
      for (const pkg of packages) {
        setLoadingStatus(`Installing ${pkg}...`);
        debug.webr(`[Lab WebR] Installing package: ${pkg}`);

        try {
          await webR.installPackages([pkg], { quiet: true });
          installedPackages.push(pkg);
          debug.webr(`[Lab WebR] Successfully installed: ${pkg}`);
        } catch (installErr) {
          debug.webr(`[Lab WebR] Warning: Could not install ${pkg}:`, installErr);
        }
      }

      // Load packages
      setLoadingStatus('Loading packages...');
      const loadScript = `
        suppressWarnings(suppressMessages({
          ${installedPackages.map(pkg =>
            `tryCatch(library(${pkg}, quietly = TRUE), error = function(e) NULL)`
          ).join('\n          ')}
        }))
      `;
      await webR.evalRVoid(loadScript);

      setPackagesInstalled(true);
      return true;
    } catch (err) {
      debug.error('[Lab WebR] Package installation error:', err);
      throw err;
    } finally {
      setIsInstallingPackages(false);
    }
  }, [getPackagesForLabType]);

  // Initialize WebR
  const initWebR = useCallback(async () => {
    if (initializingRef.current || webRRef.current) return;

    initializingRef.current = true;
    setIsLoading(true);
    setError(null);
    setLoadingStatus('Initializing WebR...');

    debug.webr(`[Lab WebR] Starting initialization for lab type: ${labType}`);

    try {
      const webR = new WebR();
      await webR.init();
      debug.webr('[Lab WebR] WebR initialized successfully');

      // Set up default options
      await webR.evalRVoid(`
        options(
          width = 80,
          warn = 1,
          digits = 7
        )
      `);

      webRRef.current = webR;

      // Install packages for this lab type
      await installPackages(webR, labType);

      // Install helper functions
      setLoadingStatus('Setting up environment...');
      await webR.evalRVoid(BASE_PLOT_HELPER);

      // Add TNA-specific helpers if needed
      if (labType === 'tna') {
        await webR.evalRVoid(TNA_PLOT_HELPER);
      }

      setIsReady(true);
      setLoadingStatus('Ready');
      debug.webr('[Lab WebR] Ready to execute R code');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize WebR';
      setError(errorMessage);
      debug.error('[Lab WebR] Initialization error:', err);
    } finally {
      setIsLoading(false);
      initializingRef.current = false;
    }
  }, [labType, installPackages]);

  // Initialize on mount
  useEffect(() => {
    currentLabTypeRef.current = labType;
    initWebR();

    return () => {
      if (webRRef.current) {
        webRRef.current.close();
        webRRef.current = null;
      }
    };
  }, [initWebR, labType]);

  // Parse output for plots
  const parseOutput = (output: string): WebROutput[] => {
    const outputs: WebROutput[] = [];
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

    try {
      const webR = webRRef.current;
      const isPlotCode = code.includes('plot(') || code.includes('ggplot_tna(') || code.includes('ggplot(');

      let rCode: string;

      if (isPlotCode && !code.includes('ggplot_tna(')) {
        rCode = `
          paste(capture.output({
            tryCatch({
              capture_plot(quote({ ${code.replace(/`/g, "\\`")} }))
            },
            error = function(e) cat("Error:", conditionMessage(e), "\\n"),
            warning = function(w) { invokeRestart("muffleWarning") }
            )
          }), collapse = "\\n")
        `;
      } else if (code.includes('ggplot_tna(')) {
        rCode = `
          paste(capture.output({
            tryCatch({
              ${code.replace(/`/g, "\\`")}
            },
            error = function(e) cat("Error:", conditionMessage(e), "\\n"),
            warning = function(w) { invokeRestart("muffleWarning") }
            )
          }), collapse = "\\n")
        `;
      } else {
        rCode = `
          paste(capture.output({
            tryCatch({
              .exprs <- parse(text = ${JSON.stringify(code)})
              .last_result <- NULL
              for (.expr in .exprs) {
                .last_result <- eval(.expr)
              }
              if (!is.null(.last_result)) {
                print(.last_result)
              }
            },
            error = function(e) cat("Error:", conditionMessage(e), "\\n"),
            warning = function(w) { invokeRestart("muffleWarning") }
            )
          }), collapse = "\\n")
        `;
      }

      const result = await webR.evalRString(rCode);
      const outputs = parseOutput(result || '');
      const hasError = result.includes('Error:');

      return {
        success: !hasError,
        outputs,
        error: hasError ? result : undefined,
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
    if (webRRef.current) {
      webRRef.current.close();
      webRRef.current = null;
    }
    setIsReady(false);
    setPackagesInstalled(false);
    setError(null);
    initializingRef.current = false;
    await initWebR();
  }, [initWebR]);

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
