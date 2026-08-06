/**
 * Splitting prose out of legacy lab cells.
 *
 * Labs authored before the unified notebook (client/src/components/labs) were
 * written for a template PICKER: you saw one template at a time, so each one
 * repeated its own `library(...)` preamble and carried its entire explanation
 * as a `#` comment block. The notebook stacks every template as a cell, so all
 * that prose now shows up as walls of commented-out code.
 *
 * A LabTemplate already has a `description` field, which the notebook renders
 * as the instructions above the editor. This moves the comment block there —
 * where it was always meant to live — and leaves the runnable code behind.
 *
 * Deliberately conservative: it moves ONE block per cell, never reorders code,
 * and never touches a cell it cannot confidently parse.
 */

export interface LegacyCellSplit {
  /** The extracted prose, comment markers stripped. Empty if nothing matched. */
  prose: string;
  /** The cell's code with that block removed. Unchanged if nothing matched. */
  code: string;
  /** False when the cell did not look like a legacy doc-comment cell. */
  changed: boolean;
}

const isComment = (line: string) => line.trim().startsWith('#');

/** `# =========` / `# ---------` — a horizontal rule, not prose. */
const isRule = (line: string) => /^\s*#\s*[=\-*_]{3,}\s*$/.test(line);

/** `#` alone, or `# ` with nothing after it — a blank line inside a block. */
const isBlankComment = (line: string) => /^\s*#\s*$/.test(line);

/**
 * Strip the comment marker while preserving the author's inner indentation,
 * which legacy blocks use to nest bullets under headings.
 */
const stripMarker = (line: string): string => {
  const m = line.match(/^\s*#(.*)$/);
  if (!m) return line;
  const rest = m[1];
  // Drop exactly one leading space (the conventional `# ` gap). Anything
  // further is the author's own indentation and is kept.
  return rest.startsWith(' ') ? rest.slice(1) : rest;
};

/**
 * @param minBlockLines Runs shorter than this are treated as ordinary code
 *   comments explaining the next line, not as documentation. Four is chosen so
 *   a two- or three-line "why" comment stays with the code it explains.
 */
export function splitLegacyCell(source: string, minBlockLines = 4): LegacyCellSplit {
  if (!source || !source.includes('#')) {
    return { prose: '', code: source ?? '', changed: false };
  }

  const lines = source.split('\n');

  // Find the first maximal run of consecutive comment lines that is long
  // enough to be documentation rather than an inline aside.
  let start = -1;
  let end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!isComment(lines[i])) continue;
    let j = i;
    while (j < lines.length && isComment(lines[j])) j++;
    if (j - i >= minBlockLines) {
      start = i;
      end = j; // exclusive
      break;
    }
    i = j; // skip the run we just rejected
  }

  if (start === -1) return { prose: '', code: source, changed: false };

  const block = lines.slice(start, end);

  const prose = block
    .filter((l) => !isRule(l))
    .map((l) => (isBlankComment(l) ? '' : stripMarker(l)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // A block of nothing but rules and blanks carries no prose — leave it alone
  // rather than deleting decoration the author may have wanted.
  if (!prose) return { prose: '', code: source, changed: false };

  const code = [...lines.slice(0, start), ...lines.slice(end)]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // A cell that is NOTHING but comments is not a documented code cell — it is
  // either pure prose, or code the author deliberately commented out for the
  // student to uncomment. Emptying it destroys the second case, which is how
  // this converter turned a disabled `install.packages(...)` into prose and
  // left a blank editor behind. Leave both alone.
  if (!code) return { prose: '', code: source, changed: false };

  return { prose, code, changed: true };
}

/**
 * Merge extracted prose with whatever the cell's description already held.
 *
 * The existing description is usually a one-line summary the notebook shows as
 * the cell's instructions; it stays on top so the cell still reads the same at
 * a glance, with the detail beneath it.
 */
export function mergeDescription(existing: string | null | undefined, prose: string): string {
  const head = (existing ?? '').trim();
  if (!head) return prose;
  if (!prose) return head;
  // Already merged (idempotency): don't stack the same text twice.
  if (head.includes(prose) || prose.includes(head)) return prose.length > head.length ? prose : head;
  return `${head}\n\n${prose}`;
}
