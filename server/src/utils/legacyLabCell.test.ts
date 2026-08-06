import { describe, it, expect } from 'vitest';
import { splitLegacyCell, mergeDescription } from './legacyLabCell.js';

/**
 * The fixture is a verbatim cell from lab 9 ("Karate Club: igraph Layouts",
 * authored 2026-03-25), which is exactly the shape this converter exists for.
 */
const REAL_CELL = `library(igraph)

# ============================================================
# Layout: Random  (layout_randomly)
# ============================================================
# Each node is placed at a uniformly random position on the
# unit square. No optimisation is applied — positions are
# independent of the edges.
#
# STRENGTHS:
#   - Extremely fast (no computation at all).
#   - Useful for benchmarking: any layout that looks worse
#     than random has a bug.
# ============================================================

g <- make_graph("Zachary")

set.seed(42)
lay <- layout_randomly(g)
plot(g, layout = lay)`;

describe('splitLegacyCell on a real legacy cell', () => {
  const out = splitLegacyCell(REAL_CELL);

  it('reports that it changed something', () => {
    expect(out.changed).toBe(true);
  });

  it('keeps every line of runnable code, in order', () => {
    expect(out.code).toBe(
      'library(igraph)\n\ng <- make_graph("Zachary")\n\nset.seed(42)\nlay <- layout_randomly(g)\nplot(g, layout = lay)'
    );
  });

  it('does not leave a single comment marker in the code', () => {
    expect(out.code).not.toContain('#');
  });

  it('lifts the prose out without comment markers', () => {
    expect(out.prose).toContain('Layout: Random  (layout_randomly)');
    expect(out.prose).toContain('Each node is placed at a uniformly random position on the');
    expect(out.prose.split('\n').every((l) => !l.trimStart().startsWith('#'))).toBe(true);
  });

  it('drops the ==== rules but keeps the author\'s nested indentation', () => {
    expect(out.prose).not.toContain('====');
    expect(out.prose).toContain('  - Extremely fast (no computation at all).');
    expect(out.prose).toContain('    than random has a bug.');
  });

  it('turns bare `#` separators into blank lines rather than dropping them', () => {
    expect(out.prose).toContain('independent of the edges.\n\nSTRENGTHS:');
  });
});

describe('what it refuses to touch', () => {
  it('leaves a cell with no comments alone', () => {
    const code = 'g <- make_graph("Zachary")\nplot(g)';
    const out = splitLegacyCell(code);
    expect(out).toEqual({ prose: '', code, changed: false });
  });

  it('leaves a short inline comment with the code it explains', () => {
    const code = 'set.seed(42)  \n# fix the seed so the layout is reproducible\nlay <- layout_randomly(g)';
    const out = splitLegacyCell(code);
    expect(out.changed).toBe(false);
    expect(out.code).toBe(code);
  });

  it('leaves a three-line comment alone but lifts a four-line one', () => {
    const three = '# one\n# two\n# three\ncode()';
    expect(splitLegacyCell(three).changed).toBe(false);

    const four = '# one\n# two\n# three\n# four\ncode()';
    const out = splitLegacyCell(four);
    expect(out.changed).toBe(true);
    expect(out.code).toBe('code()');
    expect(out.prose).toBe('one\ntwo\nthree\nfour');
  });

  it('leaves a block of pure decoration alone — there is no prose to move', () => {
    const code = '# ======\n# ------\n# ======\n# ------\nplot(g)';
    const out = splitLegacyCell(code);
    expect(out.changed).toBe(false);
    expect(out.code).toBe(code);
  });

  it('leaves commented-out CODE alone — it is disabled code, not documentation', () => {
    // A real cell from lab 24: an install command the student can uncomment.
    // Converting it moved the code into the description and left an empty
    // editor, destroying the thing the cell existed for.
    const code = [
      '#install.packages(',
      '#  c("car", "rio", "see", "dplyr", "tidyr",',
      '#    "broom", "report", "correlation", "performance")',
      '#)',
    ].join('\n');
    const out = splitLegacyCell(code);
    expect(out.changed).toBe(false);
    expect(out.code).toBe(code);
    expect(out.prose).toBe('');
  });

  it('never empties a cell — if nothing would be left, it does not convert', () => {
    const out = splitLegacyCell('# just\n# prose\n# and\n# nothing else');
    expect(out.changed).toBe(false);
    expect(out.code.trim()).not.toBe('');
  });

  it('handles an empty or undefined cell without throwing', () => {
    expect(splitLegacyCell('').changed).toBe(false);
    expect(splitLegacyCell(undefined as never).code).toBe('');
  });

  it('moves only the FIRST block, leaving later commentary with its code', () => {
    const code = '# a\n# b\n# c\n# d\nfirst()\n\n# later note\n# still the note\n# and more\n# and more again\nsecond()';
    const out = splitLegacyCell(code);
    expect(out.prose).toBe('a\nb\nc\nd');
    expect(out.code).toContain('# later note');
    expect(out.code).toContain('second()');
  });
});

describe('running it twice changes nothing the second time', () => {
  it('is idempotent on code', () => {
    const once = splitLegacyCell(REAL_CELL);
    const twice = splitLegacyCell(once.code);
    expect(twice.changed).toBe(false);
    expect(twice.code).toBe(once.code);
  });

  it('is idempotent on the description', () => {
    const once = splitLegacyCell(REAL_CELL);
    const merged = mergeDescription('layout_randomly — the baseline', once.prose);
    expect(mergeDescription(merged, once.prose)).toBe(merged);
  });
});

describe('mergeDescription', () => {
  it('keeps the existing one-liner on top', () => {
    expect(mergeDescription('A summary', 'The detail')).toBe('A summary\n\nThe detail');
  });

  it('handles either side being empty', () => {
    expect(mergeDescription('', 'The detail')).toBe('The detail');
    expect(mergeDescription('A summary', '')).toBe('A summary');
    expect(mergeDescription(null, 'The detail')).toBe('The detail');
    expect(mergeDescription(undefined, 'The detail')).toBe('The detail');
  });

  it('does not stack the same text twice', () => {
    expect(mergeDescription('The detail', 'The detail')).toBe('The detail');
  });
});
