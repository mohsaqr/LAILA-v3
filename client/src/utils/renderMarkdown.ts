/**
 * Simple markdown to HTML converter.
 * Handles: headers, bold, italic, code blocks, inline code, links, images,
 * lists, GFM tables, line breaks.
 */

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const splitRow = (line: string): string[] => {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map(c => c.trim());
};

const buildTable = (header: string[], rows: string[][]): string => {
  const th = header
    .map(h => `<th class="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left font-semibold">${escapeHtml(h)}</th>`)
    .join('');
  const body = rows
    .map(
      r =>
        '<tr>' +
        header
          .map((_, i) => `<td class="border border-gray-300 dark:border-gray-600 px-2 py-1">${escapeHtml(r[i] ?? '')}</td>`)
          .join('') +
        '</tr>',
    )
    .join('');
  // Single line (no interior newlines) so the later \n handling can't split it.
  return `<table class="min-w-full border-collapse my-4 text-sm"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
};

/**
 * Pull GFM tables out to placeholders before the main pipeline, so the HTML
 * we build for them isn't mangled by escaping or the newline->br step. The
 * placeholder token has no markdown-special chars so the pipeline ignores it.
 */
const extractTables = (text: string, store: string[]): string => {
  const lines = text.split('\n');
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isSeparator = (l: string) =>
    l.includes('-') && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l);

  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (isRow(lines[i]) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const header = splitRow(lines[i]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      store.push(buildTable(header, rows));
      // Private-use unicode sentinel — text a user could realistically type
      // (like "@@TBL0@@") must never collide with it.
      out.push(`${store.length - 1}`);
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out.join('\n');
};

export function renderMarkdown(text: string): string {
  const tables: string[] = [];
  const withPlaceholders = extractTables(text, tables);

  let html = withPlaceholders
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code>$2</code></pre>')
    // Inline code
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
    // Images (must precede links so ![alt](src) isn't caught as a link)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" class="max-w-full rounded my-2"/>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
    // Numbered lists
    .replace(/^\d+\.\s+(.*$)/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Bullet lists
    .replace(/^\s*[-*]\s+(.*$)/gm, '<li class="ml-4">$1</li>')
    // Paragraphs and line breaks
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/\n/g, '<br/>');

  // Wrap in paragraph if not starting with special element
  if (!html.startsWith('<h') && !html.startsWith('<pre') && !html.startsWith('<li')) {
    html = '<p class="mb-4">' + html + '</p>';
  }

  // Wrap consecutive list items
  html = html.replace(/(<li[^>]*>.*?<\/li>(<br\/>)?)+/g, '<ul class="list-disc mb-4">$&</ul>');

  // Unwrap a lone table placeholder from its paragraph, then swap in the real
  // table HTML (kept out of the pipeline above so it stayed intact).
  html = html.replace(/<p[^>]*>\s*(\d+)\s*<\/p>/g, '$1');
  html = html.replace(/(\d+)/g, (_, n) => tables[Number(n)] ?? '');

  return html;
}
