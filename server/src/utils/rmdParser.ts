/**
 * Minimal R Markdown (.Rmd) / Quarto (.qmd) parser for the CodeLab importer.
 *
 * The model is deliberately tiny: a fenced block that opens with ```{r ...} or
 * ```r is an R CODE chunk (until the next bare ``` line); everything else is
 * TEXT. Only R chunks are treated as code — any other fenced block (```python,
 * ```{sql}, a plain ```) is left inside the surrounding text and never becomes
 * a runnable cell. Quarto `#| key: value` option lines at the top of a chunk
 * are dropped. Inline `r ...`, echo/eval, and fence layout options are ignored.
 */

export type RmdCell = { type: 'code' | 'markdown'; content: string };
export type ParsedRmd = { title?: string; cells: RmdCell[] };

/** Cap a title and drop light markdown/quote noise so it reads as a label. */
const clipTitle = (s: string): string => {
  const clean = s.replace(/[`*_]/g, '').replace(/^["']|["']$/g, '').trim();
  return clean.length > 60 ? clean.slice(0, 57).trimEnd() + '…' : clean;
};

/**
 * A short, human label for an imported cell so the notebook is scannable:
 * a text cell takes its first heading (or first line); a code cell takes its
 * first comment line. Empty when there's nothing meaningful to name it.
 */
export function cellTitle(cell: RmdCell): string {
  const lines = cell.content.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';
  if (cell.type === 'markdown') {
    const heading = lines.find(l => /^#{1,6}\s+\S/.test(l));
    return clipTitle((heading ?? lines[0]).replace(/^#{1,6}\s+/, ''));
  }
  const comment = lines.find(l => /^#+\s*\S/.test(l));
  return comment ? clipTitle(comment.replace(/^#+\s*/, '')) : '';
}

/** Any fence line: 3+ backticks or tildes, capturing the delimiter + info string. */
const FENCE_LINE = /^\s*(`{3,}|~{3,})\s*(.*?)\s*$/;
/** A bare closing backtick fence (3+ backticks, nothing after). */
const CLOSE_BACKTICKS = /^\s*`{3,}\s*$/;

/** True when a fence's info string marks an R chunk: `{r ...}` or bare `r`/`R`. */
const isRInfo = (info: string): boolean =>
  /^\{[rR](?:[\s,}].*)?\}$/.test(info) || /^[rR]$/.test(info);

/** Strip leading/trailing blank lines without touching interior indentation. */
const trimBlankLines = (text: string): string =>
  text.replace(/^\s*\n/, '').replace(/\n\s*$/, '').replace(/^\n+|\n+$/g, '');

/**
 * Drop Quarto chunk-option lines (`#| key: value`) from the top of a chunk.
 * They are valid R comments so they would run harmlessly, but they are cell
 * metadata rather than code, so the imported cell is cleaner without them.
 */
const stripChunkOptions = (code: string): string => {
  const lines = code.split('\n');
  let k = 0;
  while (k < lines.length && /^\s*#\|/.test(lines[k])) k++;
  return lines.slice(k).join('\n');
};

/**
 * Parse an .Rmd string into an ordered list of text / R-code cells, plus the
 * document title if a YAML `title:` is present in the frontmatter.
 */
export function parseRmd(raw: string): ParsedRmd {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let i = 0;
  let title: string | undefined;

  // Optional YAML frontmatter: a leading `---` block. We only pull `title` out
  // of it; the rest is dropped so it doesn't render as noise.
  if (lines[0]?.trim() === '---') {
    let end = -1;
    for (let j = 1; j < lines.length; j++) {
      if (lines[j].trim() === '---') { end = j; break; }
    }
    if (end !== -1) {
      for (let j = 1; j < end; j++) {
        const m = lines[j].match(/^\s*title\s*:\s*(.+?)\s*$/i);
        if (m) {
          title = m[1].replace(/^["']|["']$/g, '').trim() || undefined;
          break;
        }
      }
      i = end + 1;
    }
  }

  const cells: RmdCell[] = [];
  let textBuf: string[] = [];

  const flushText = () => {
    const text = trimBlankLines(textBuf.join('\n'));
    if (text) cells.push({ type: 'markdown', content: text });
    textBuf = [];
  };

  while (i < lines.length) {
    const fence = lines[i].match(FENCE_LINE);
    if (!fence) {
      textBuf.push(lines[i]);
      i++;
      continue;
    }

    const delim = fence[1];
    const info = fence[2];

    // Only an exactly-triple-backtick fence whose info marks R is a code cell.
    if (delim === '```' && isRInfo(info)) {
      flushText();
      i++; // consume the opening fence
      const codeBuf: string[] = [];
      while (i < lines.length && !CLOSE_BACKTICKS.test(lines[i])) {
        codeBuf.push(lines[i]);
        i++;
      }
      i++; // consume the closing fence (no-op if we hit EOF)
      cells.push({ type: 'code', content: trimBlankLines(stripChunkOptions(codeBuf.join('\n'))) });
      continue;
    }

    // Any other fenced block (```python, a plain ```, a 4-backtick doc fence,
    // ~~~) is TEXT. Consume it whole — up to a matching closing fence (same
    // char, length >= opening) — so R-looking lines INSIDE it never become
    // runnable cells.
    const closeChar = delim[0];
    const closeRe = new RegExp('^\\s*\\' + closeChar + '{' + delim.length + ',}\\s*$');
    textBuf.push(lines[i]);
    i++;
    while (i < lines.length && !closeRe.test(lines[i])) {
      textBuf.push(lines[i]);
      i++;
    }
    if (i < lines.length) {
      textBuf.push(lines[i]); // include the closing fence in the text
      i++;
    }
  }
  flushText();

  return { title, cells };
}
