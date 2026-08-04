import { describe, it, expect } from 'vitest';
import { asRBlock } from './rCodeBlock';

/**
 * Strips R comments the way the R parser does — everything from an unquoted `#`
 * to end of line. Used here to prove a wrapper survives a cell that ends in a
 * comment, without needing webR to run.
 */
const stripComments = (src: string) =>
  src
    .split('\n')
    .map(line => {
      let inString: string | null = null;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inString) {
          if (ch === inString && line[i - 1] !== '\\') inString = null;
        } else if (ch === '"' || ch === "'") {
          inString = ch;
        } else if (ch === '#') {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join('\n');

const balanced = (src: string) => {
  const code = stripComments(src);
  let depth = 0;
  for (const ch of code) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
};

/** The shape of the wrapper both R hooks build around a cell. */
const wrap = (code: string) => `
  paste(capture.output({
    tryCatch(
      ${asRBlock(code)},
      error = function(e) cat("Error:", conditionMessage(e), "\\n")
    )
  }), collapse = "\\n")
`;

describe('asRBlock', () => {
  it('puts both braces on their own lines', () => {
    const lines = asRBlock('x <- 1').split('\n');
    expect(lines[0]).toBe('{');
    expect(lines[lines.length - 1]).toBe('}');
  });

  it('survives a cell whose last line ends in a comment', () => {
    // The reported failure: a trailing comment swallowed the wrapper's `},`,
    // orphaning `error = function(e) ...` and producing a parse error pointing
    // at generated code the author never wrote.
    const code = [
      'sessions <- events |>',
      '  group_by(user) |>',
      '  mutate(session_id = paste0(user, "_", "Session_", session_nr)) # Step 6: Add unique session id',
    ].join('\n');

    expect(balanced(wrap(code))).toBe(true);
  });

  it('would have failed with the old same-line form', () => {
    // Guards the guard: proves `balanced` actually detects the bug it claims to.
    const code = 'f() # trailing note';
    const oldForm = `tryCatch(\n  { ${code} },\n  error = function(e) NULL\n)`;
    expect(balanced(oldForm)).toBe(false);
  });

  it('is unfazed by a comment containing a brace', () => {
    expect(balanced(wrap('x <- 1 # closes with } here'))).toBe(true);
  });

  it('leaves a hash inside a string alone', () => {
    expect(balanced(wrap('lab <- "#hashtag"'))).toBe(true);
  });

  it('handles an empty cell', () => {
    expect(balanced(wrap(''))).toBe(true);
  });

  it('does not alter the code it wraps', () => {
    const code = 'df$`my col` <- 1';
    expect(asRBlock(code)).toContain(code);
  });
});
