/**
 * Wraps user R code as a `{ ... }` block for interpolation into an eval wrapper.
 *
 * The braces MUST sit on their own lines. R comments run to end-of-line, so a
 * cell whose last line ends in `# note` swallows any closing brace placed after
 * it on the same line — the wrapper's `},` disappears and the following
 * `error = function(e) ...` is orphaned, producing a parse error that points at
 * generated code the author never wrote.
 */
export const asRBlock = (code: string): string => `{\n${code}\n}`;
