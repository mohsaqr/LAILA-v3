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

interface UseTNAWebRReturn {
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

// TNA Lab required packages (order matters - dependencies first)
// Note: WebR has a limited package repository - not all CRAN packages are available
const TNA_PACKAGES = [
  'base64enc',     // For encoding plots (usually available)
  'rlang',         // Required for tidy evaluation (!! operator)
  'dplyr',         // Data manipulation
  'ggplot2',       // Plotting foundation
  'igraph',        // Graph/network analysis foundation
  'tidygraph',     // Tidy API for graph manipulation
  'ggraph',        // Graph visualization
  'ggforce',       // Extended ggplot2 geoms
  'ggfittext',     // Text fitting in plots
  'tna',           // Transition Network Analysis (main package)
];

// Packages to try installing from CRAN if not in WebR repo
const FALLBACK_PACKAGES = ['quadprog'];

// Helper function to capture plots as base64 PNG
const GGPLOT_TNA_HELPER = `
# Check if quadprog is available (set during initialization)
.quadprog_available <- suppressWarnings(requireNamespace("quadprog", quietly = TRUE))

# Universal plot capture function - handles both base R plots and ggplot objects
.capture_to_base64 <- function(plot_obj = NULL) {
  tmp <- tempfile(fileext = ".png")
  png(tmp, width = 800, height = 600, res = 100)

  tryCatch({
    if (!is.null(plot_obj)) {
      # If it's a ggplot or similar, print it to render
      if (inherits(plot_obj, c("gg", "ggplot", "tna", "Heatmap"))) {
        print(plot_obj)
      } else {
        # For other objects, try to plot them
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

# Wrapper for ggplot_tna - network visualization using ggraph
# This creates a proper network graph with circle layout
ggplot_tna <- function(x, digits = 2, min_weight = 0.05, ...) {
  tmp <- tempfile(fileext = ".png")

  tryCatch({
    xlen <- nrow(x$weights)

    # Filter edges below min_weight
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

    # Capture to PNG - larger size with no margins
    png(tmp, width = 1400, height = 1400, res = 100)
    print(p)
    dev.off()

    # Read and encode
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

# General capture_plot for any plot expression
capture_plot <- function(expr) {
  tmp <- tempfile(fileext = ".png")
  png(tmp, width = 800, height = 600, res = 100)

  result <- suppressWarnings(suppressMessages(tryCatch({
    res <- eval(expr)
    # If result is a ggplot-like object, print it to render
    if (inherits(res, c("gg", "ggplot", "tna", "Heatmap"))) {
      print(res)
    }
    res
  }, error = function(e) {
    tryCatch(dev.off(), error = function(x) NULL)
    unlink(tmp)
    # Check if it's a quadprog error - don't stop, just warn
    if (grepl("quadprog|package", e$message, ignore.case = TRUE)) {
      message("Note: Using layout='circle' for compatibility. Some advanced layouts require packages not available in WebR.")
      return(NULL)
    }
    stop(e)
  })))

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

export const useTNAWebR = (): UseTNAWebRReturn => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isInstallingPackages, setIsInstallingPackages] = useState(false);
  const [packagesInstalled, setPackagesInstalled] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Initializing WebR...');
  const [error, setError] = useState<string | null>(null);

  const webRRef = useRef<WebR | null>(null);
  const initializingRef = useRef(false);

  // Install TNA packages
  const installTNAPackages = useCallback(async (webR: WebR) => {
    setIsInstallingPackages(true);
    setLoadingStatus('Installing R packages...');

    const installedPackages: string[] = [];
    const failedPackages: string[] = [];

    try {
      // First try to install quadprog and other dependencies that might be missing
      for (const pkg of FALLBACK_PACKAGES) {
        setLoadingStatus(`Installing ${pkg}...`);
        debug.webr(`[TNA WebR] Attempting to install dependency: ${pkg}`);

        try {
          await webR.installPackages([pkg], { quiet: true });
          installedPackages.push(pkg);
          debug.webr(`[TNA WebR] Successfully installed: ${pkg}`);
        } catch (installErr) {
          debug.webr(`[TNA WebR] Could not install ${pkg} (may not be in WebR repo):`, installErr);
          failedPackages.push(pkg);
        }
      }

      // Install main packages one by one for better status updates
      for (const pkg of TNA_PACKAGES) {
        setLoadingStatus(`Installing ${pkg}...`);
        debug.webr(`[TNA WebR] Installing package: ${pkg}`);

        try {
          await webR.installPackages([pkg], { quiet: true });
          installedPackages.push(pkg);
          debug.webr(`[TNA WebR] Successfully installed: ${pkg}`);
        } catch (installErr) {
          debug.webr(`[TNA WebR] Warning: Could not install ${pkg}:`, installErr);
          failedPackages.push(pkg);
        }
      }

      // Load all successfully installed packages
      setLoadingStatus('Loading packages...');
      const loadScript = `
        suppressWarnings(suppressMessages({
          ${installedPackages.map(pkg =>
            `tryCatch(library(${pkg}, quietly = TRUE), error = function(e) NULL)`
          ).join('\n          ')}
        }))
      `;

      await webR.evalRVoid(loadScript);
      debug.webr('[TNA WebR] Packages loaded');

      // Log summary
      debug.webr(`[TNA WebR] Installed: ${installedPackages.join(', ')}`);
      if (failedPackages.length > 0) {
        debug.webr(`[TNA WebR] Failed to install: ${failedPackages.join(', ')}`);
      }

      // Install the ggplot_tna helper function
      setLoadingStatus('Setting up TNA environment...');
      await webR.evalRVoid(GGPLOT_TNA_HELPER);
      debug.webr('[TNA WebR] Helper functions installed');

      setPackagesInstalled(true);
      return true;
    } catch (err) {
      debug.error('[TNA WebR] Package installation error:', err);
      throw err;
    } finally {
      setIsInstallingPackages(false);
    }
  }, []);

  // Initialize WebR with TNA packages
  const initWebR = useCallback(async () => {
    if (initializingRef.current || webRRef.current) return;

    initializingRef.current = true;
    setIsLoading(true);
    setError(null);
    setLoadingStatus('Initializing WebR...');

    debug.webr('[TNA WebR] Starting initialization...');

    try {
      const webR = new WebR();
      debug.webr('[TNA WebR] WebR instance created, calling init()...');
      await webR.init();
      debug.webr('[TNA WebR] WebR initialized successfully');

      // Set up default options
      await webR.evalRVoid(`
        options(
          width = 80,
          warn = 1,
          digits = 7
        )
      `);
      debug.webr('[TNA WebR] Default options set');

      webRRef.current = webR;

      // Install TNA packages
      await installTNAPackages(webR);

      setIsReady(true);
      setLoadingStatus('Ready');
      debug.webr('[TNA WebR] Ready to execute R code');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize WebR';
      setError(errorMessage);
      debug.error('[TNA WebR] Initialization error:', err);
    } finally {
      setIsLoading(false);
      initializingRef.current = false;
    }
  }, [installTNAPackages]);

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

  // Parse output for plots
  const parseOutput = (output: string): WebROutput[] => {
    const outputs: WebROutput[] = [];

    // Check for plot markers
    const plotRegex = /__PLOT_BASE64__(.+?)__END_PLOT__/g;
    let match;
    let lastIndex = 0;

    while ((match = plotRegex.exec(output)) !== null) {
      // Add any text before the plot
      if (match.index > lastIndex) {
        const textBefore = output.substring(lastIndex, match.index).trim();
        if (textBefore) {
          outputs.push({ type: 'stdout', content: textBefore });
        }
      }

      // Add the plot
      outputs.push({ type: 'plot', content: match[1] });
      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text after the last plot
    if (lastIndex < output.length) {
      const remaining = output.substring(lastIndex).trim();
      if (remaining) {
        outputs.push({ type: 'stdout', content: remaining });
      }
    }

    // If no plots found, just return the whole output
    if (outputs.length === 0 && output.trim()) {
      outputs.push({ type: 'stdout', content: output });
    }

    return outputs;
  };

  // Execute R code with plot capture
  const executeCode = useCallback(async (code: string): Promise<ExecutionResult> => {
    debug.webr('[TNA WebR] executeCode called, isReady:', isReady, 'hasWebR:', !!webRRef.current);

    if (!webRRef.current || !isReady) {
      debug.webr('[TNA WebR] Not ready, returning error');
      return {
        success: false,
        outputs: [],
        error: 'WebR is not ready',
      };
    }

    setIsExecuting(true);

    try {
      const webR = webRRef.current;
      debug.webr('[TNA WebR] Executing code:', code.substring(0, 100) + '...');

      // Check if code contains plot commands
      const isPlotCode = code.includes('plot(') || code.includes('ggplot_tna(');

      let rCode: string;

      // Helper to filter out quadprog-related error messages from output
      const filterCode = `
        .filter_quadprog <- function(x) {
          lines <- strsplit(x, "\\n")[[1]]
          filtered <- lines[!grepl("quadprog|there is no package", lines, ignore.case = TRUE)]
          paste(filtered, collapse = "\\n")
        }
      `;

      if (isPlotCode && !code.includes('ggplot_tna(')) {
        // Wrap plot() calls in capture_plot to capture as base64 PNG
        rCode = `
          ${filterCode}
          .filter_quadprog(paste(capture.output({
            suppressWarnings(suppressMessages(tryCatch({
              capture_plot(quote({ ${code.replace(/`/g, "\\`")} }))
            },
            error = function(e) {
              msg <- conditionMessage(e)
              if (!grepl("quadprog|there is no package", msg, ignore.case = TRUE)) {
                cat("Error:", msg, "\\n")
              }
            },
            warning = function(w) { invokeRestart("muffleWarning") }
            )))
          }), collapse = "\\n"))
        `;
      } else if (code.includes('ggplot_tna(')) {
        // ggplot_tna already handles plot capture - don't wrap in extra suppressions
        rCode = `
          ${filterCode}
          .filter_quadprog(paste(capture.output({
            tryCatch({
              ${code.replace(/`/g, "\\`")}
            },
            error = function(e) {
              msg <- conditionMessage(e)
              if (!grepl("quadprog|there is no package", msg, ignore.case = TRUE)) {
                cat("Error:", msg, "\\n")
              }
            },
            warning = function(w) { invokeRestart("muffleWarning") }
            )
          }), collapse = "\\n"))
        `;
      } else {
        // Regular code - evaluate and print result
        rCode = `
          ${filterCode}
          .filter_quadprog(paste(capture.output({
            suppressWarnings(suppressMessages(tryCatch({
              .exprs <- parse(text = ${JSON.stringify(code)})
              .last_result <- NULL
              for (.expr in .exprs) {
                .last_result <- eval(.expr)
              }
              if (!is.null(.last_result)) {
                print(.last_result)
              }
            },
            error = function(e) {
              msg <- conditionMessage(e)
              if (!grepl("quadprog|there is no package", msg, ignore.case = TRUE)) {
                cat("Error:", msg, "\\n")
              }
            },
            warning = function(w) { invokeRestart("muffleWarning") }
            )))
          }), collapse = "\\n"))
        `;
      }

      const result = await webR.evalRString(rCode);

      debug.webr('[TNA WebR] Execution result length:', result?.length);

      const outputs = parseOutput(result || '');

      // Check if there was a real error in the output (not quadprog-related)
      const hasError = result.includes('Error:') &&
        !result.toLowerCase().includes('quadprog') &&
        !result.toLowerCase().includes('there is no package');

      return {
        success: !hasError,
        outputs,
        error: hasError ? result : undefined,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Execution failed';
      debug.error('[TNA WebR] Execution error:', err);

      return {
        success: false,
        outputs: [{ type: 'stderr', content: errorMessage }],
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
    setPackagesInstalled(false);
    setError(null);
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
