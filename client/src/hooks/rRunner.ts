/**
 * Console semantics for the in-browser R runners.
 *
 * A notebook cell holding several expressions should print each one that R
 * considers *visible*, exactly as typing them into an R console would:
 *
 *     1 + 1        -> [1] 2
 *     2 + 2        -> [1] 4
 *     x <- 42      -> (nothing; assignment is invisible)
 *
 * Every runner here used to do the opposite. Two shapes were in use, and both
 * printed only ONE result per cell:
 *
 *   - `capture.output({ <cell> })` — capture.output evaluates a `{` block as a
 *     single call, so it prints only the block's value, i.e. the last
 *     expression. Everything above it is discarded.
 *   - a hand-rolled `for (e in exprs) .last <- eval(e)` loop that kept only
 *     `.last` and printed it. Same outcome, plus a second bug: it printed the
 *     last value whether or not R meant it to be seen, so a cell ending in
 *     `x <- 42` printed `[1] 42`.
 *
 * `withVisible()` is the missing piece — it reports the visibility flag that
 * auto-printing is built on, which is otherwise lost the moment a value is
 * assigned to a variable.
 *
 * The cell is passed to R as a *string* and parsed there, rather than pasted
 * into generated R source. That removes a whole class of failures around
 * interpolating arbitrary user code: trailing `# comments` swallowing the
 * wrapper's own closing brace (what `rCodeBlock.asRBlock` exists to work
 * around), and backticks needing to be escaped by hand.
 */

/**
 * R helper definitions. Evaluate once per session, at init, alongside the
 * other helpers — and again after a reset, which builds a fresh webR.
 *
 * `.laila_eval_plot` needs `base64enc` at call time (not at definition time);
 * it is in every lab's package list.
 */
export const R_CONSOLE_HELPERS = `
# Evaluate a cell one top-level expression at a time, auto-printing each
# visible result the way the R console does.
#
# Evaluating in globalenv() keeps assignments alive across cells. That is what
# already happened implicitly — webR evaluates in the global environment by
# default — but this runs inside a function, so it has to be said explicitly.
#
# An error stops the cell, leaving whatever was printed before it. That matches
# a sourced script, and matches what these runners did before.
.laila_eval_all <- function(code) {
  for (.e in parse(text = code)) {
    .r <- withVisible(eval(.e, globalenv()))
    if (.r$visible) print(.r$value)
  }
  invisible(NULL)
}

# As above, with a PNG device open for the whole cell, so base graphics built
# across several calls (plot(); abline(); legend()) land on one image. The
# image is emitted last, via on.exit, so a cell that errors part-way through
# still shows the plot it had already drawn.
.laila_eval_plot <- function(code) {
  .tmp <- tempfile(fileext = ".png")
  grDevices::png(.tmp, width = 800, height = 600, res = 100)
  on.exit({
    tryCatch(grDevices::dev.off(), error = function(e) NULL)
    if (file.exists(.tmp) && file.info(.tmp)$size > 0) {
      cat("__PLOT_BASE64__",
          base64enc::base64encode(readBin(.tmp, "raw", file.info(.tmp)$size)),
          "__END_PLOT__", sep = "")
    }
    unlink(.tmp)
  }, add = TRUE)
  .laila_eval_all(code)
}
`;

/**
 * Call `.laila_eval_all` on a cell.
 *
 * JSON string syntax is a subset of R's, so `JSON.stringify` produces a valid
 * R string literal — the escapes R needs (`\\"`, `\\\\`, `\\n`, `\\t`, `\\uXXXX`)
 * are exactly the ones JSON emits.
 */
export const evalAllCall = (code: string): string =>
  `.laila_eval_all(${JSON.stringify(code)})`;

/** Call `.laila_eval_plot` on a cell — same, with a PNG device open. */
export const evalPlotCall = (code: string): string =>
  `.laila_eval_plot(${JSON.stringify(code)})`;
