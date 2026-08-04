import type { LabCell } from '../components/labs/authoring/cell';

/**
 * Render a lab notebook as an R Markdown (.Rmd) document.
 *
 * The point is a file that opens in RStudio and *runs*: code cells become
 * ```{r} chunks, not ```r fences. Only the braced form gets a run arrow in
 * RStudio — the bare form is inert decoration. The server's importer
 * (`server/src/utils/rmdParser.ts`) accepts both, so what this writes can also
 * be imported straight back into a lab.
 *
 * Outputs are deliberately not embedded. An .Rmd describes how to produce
 * results; RStudio regenerates them on knit, and pasted-in output would be
 * stale the moment the reader changes a line.
 */

/** Quote a string for a YAML scalar without pulling in a YAML library. */
const yamlQuote = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * Pick a fence long enough to contain the code.
 *
 * A cell whose code itself contains a ``` line — pasted markdown, a string
 * literal, a roxygen example — would otherwise close the chunk early and
 * corrupt everything after it.
 */
const fenceFor = (code: string): string => {
  let longest = 0;
  for (const line of code.split('\n')) {
    const m = /^\s*(`{3,})/.exec(line);
    if (m) longest = Math.max(longest, m[1].length);
  }
  return '`'.repeat(Math.max(3, longest + 1));
};

export interface NotebookToRmdOptions {
  /** Becomes the YAML title. */
  labName: string;
  /** cellId → the code currently in the editor, which may differ from cell.code. */
  drafts?: Record<number, string>;
  /** `r` chunks for an R lab; a Python lab exports python chunks instead. */
  language?: 'r' | 'python';
}

export const notebookToRmd = (cells: LabCell[], opts: NotebookToRmdOptions): string => {
  const { labName, drafts = {}, language = 'r' } = opts;
  const chunkLang = language === 'python' ? 'python' : 'r';

  const parts: string[] = [
    ['---', `title: ${yamlQuote(labName || 'Lab')}`, 'output: html_document', '---'].join('\n'),
  ];

  cells.forEach(cell => {
    const title = cell.title?.trim();
    const prose = cell.prose?.trim();
    const code = (drafts[cell.id] ?? cell.code ?? '').trim();

    // The title becomes a heading rather than a chunk label: knitr treats
    // duplicate chunk labels as a fatal error, and titles are not unique
    // (a scratch copy is literally "<title> (copy)").
    if (title) parts.push(`## ${title}`);
    if (prose) parts.push(prose);

    if (cell.cellType === 'markdown') return;
    if (!code) return;

    const fence = fenceFor(code);
    parts.push(`${fence}{${chunkLang}}\n${code}\n${fence}`);
  });

  return parts.join('\n\n') + '\n';
};
