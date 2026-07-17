/**
 * Find the R packages a notebook loads, so the lab runtime can install exactly
 * what's needed instead of relying on a hardcoded per-lab list.
 *
 * Scans code for `library(pkg)` / `require(pkg)` (quoted or bare), ignoring
 * calls that sit in a line comment. Order-preserving, de-duplicated.
 */
const CALL = /\b(?:library|require)\s*\(\s*(?:package\s*=\s*)?["']?([A-Za-z][A-Za-z0-9._]*)["']?/g;

export function detectRPackages(codeCells: string[]): string[] {
  const found = new Set<string>();
  for (const cell of codeCells) {
    if (!cell) continue;
    for (const rawLine of cell.split('\n')) {
      // Drop a trailing line comment so `# library(old)` doesn't count.
      const line = rawLine.replace(/#.*$/, '');
      for (const match of line.matchAll(CALL)) {
        found.add(match[1]);
      }
    }
  }
  return [...found];
}
