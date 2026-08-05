import { describe, it, expect } from 'vitest';
import { R_CONSOLE_HELPERS, evalAllCall, evalPlotCall } from './rRunner';

/**
 * These tests cover the JS half: that a cell reaches R intact, as a string, and
 * cannot disturb the wrapper built around it.
 *
 * The R half — that `.laila_eval_all` reproduces console auto-printing — cannot
 * be asserted here, because there is no R in the test environment. It was
 * verified against real R by extracting `R_CONSOLE_HELPERS` and sourcing it:
 *
 *   npx esbuild src/hooks/rRunner.ts --format=esm --outfile=/tmp/r.mjs
 *   node -e "import('/tmp/r.mjs').then(m => process.stdout.write(m.R_CONSOLE_HELPERS))" > /tmp/helpers.R
 *   Rscript -e 'source("/tmp/helpers.R"); .laila_eval_all("1+1\n2+2\nx <- 42")'
 *   #> [1] 2
 *   #> [1] 4     <- and nothing for the assignment
 */

/** The argument as it appears in the generated call. */
const argOf = (call: string) => call.slice(call.indexOf('(') + 1, call.lastIndexOf(')'));

describe('evalAllCall', () => {
  it('passes the cell as an R string literal, not as inlined source', () => {
    const call = evalAllCall('1 + 1');

    expect(call).toBe('.laila_eval_all("1 + 1")');
  });

  it('round-trips the cell exactly', () => {
    const code = 'df$`my col` <- "a\\"b"\nsummary(df) # note';

    // JSON string syntax is a subset of R's, so the literal R will parse is the
    // one JSON.parse gives back here.
    expect(JSON.parse(argOf(evalAllCall(code)))).toBe(code);
  });

  it.each([
    ['a trailing comment', 'f() # trailing note'],
    ['a comment containing a brace', 'x <- 1 # closes with } here'],
    ['a hash inside a string', 'lab <- "#hashtag"'],
    ['backticks', 'df$`my col` <- 1'],
    ['multiple lines', 'a <- 1\nb <- 2\nplot(a, b)'],
    ['an unbalanced brace in a string', 'x <- "}"'],
  ])('cannot break the surrounding wrapper with %s', (_label, code) => {
    const call = evalAllCall(code);

    // The whole cell collapses to ONE line. This is the structural reason the
    // old brace-balance hazard is gone: a wrapper can only be damaged by code
    // pasted into it, and nothing is pasted in any more.
    expect(call).not.toContain('\n');
    // Whatever the cell contains — braces, hashes, quotes — it reaches R as a
    // single string literal, so none of it is syntax the wrapper can trip over.
    expect(call).toMatch(/^\.laila_eval_all\(".*"\)$/);
    expect(JSON.parse(argOf(call))).toBe(code);
  });

  it('handles an empty cell', () => {
    expect(evalAllCall('')).toBe('.laila_eval_all("")');
  });
});

describe('evalPlotCall', () => {
  it('calls the device-wrapped runner', () => {
    expect(evalPlotCall('plot(1:10)')).toBe('.laila_eval_plot("plot(1:10)")');
  });
});

describe('R_CONSOLE_HELPERS', () => {
  it('defines both runners', () => {
    expect(R_CONSOLE_HELPERS).toContain('.laila_eval_all <- function(code)');
    expect(R_CONSOLE_HELPERS).toContain('.laila_eval_plot <- function(code)');
  });

  it('auto-prints on the visibility flag rather than on non-NULL-ness', () => {
    // The bug this replaced printed the last value whenever it was not NULL,
    // so a cell ending in `x <- 42` printed `[1] 42`. Only withVisible knows
    // what R meant to be seen.
    expect(R_CONSOLE_HELPERS).toContain('withVisible');
    expect(R_CONSOLE_HELPERS).toContain('if (.r$visible) print(.r$value)');
  });

  it('evaluates in the global environment so cells share state', () => {
    // Implicit before, because webR evaluates there by default — but this runs
    // inside a function now, where the default would be the function's frame
    // and every assignment would vanish when the cell ended.
    expect(R_CONSOLE_HELPERS).toContain('eval(.e, globalenv())');
  });

  it('emits the plot marker the output parser looks for', () => {
    expect(R_CONSOLE_HELPERS).toContain('__PLOT_BASE64__');
    expect(R_CONSOLE_HELPERS).toContain('__END_PLOT__');
  });
});
