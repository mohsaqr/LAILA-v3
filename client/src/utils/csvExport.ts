/** Trigger a browser file download from in-memory data. */
function downloadFile(content: string, filename: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Export an array of objects as CSV. */
export function exportRowsAsCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escapeCSV(row[h])).join(',')),
  ];
  downloadFile(lines.join('\n'), filename);
}

/** Export a matrix (number[][]) with row and column labels. */
export function exportMatrixAsCSV(matrix: number[][], labels: string[], filename: string) {
  const header = ['', ...labels].join(',');
  const rows = matrix.map((row, i) =>
    [escapeCSV(labels[i]), ...row.map(v => v.toFixed(4))].join(','),
  );
  downloadFile([header, ...rows].join('\n'), filename);
}

/** Export centrality data { labels, measures } as CSV. */
export function exportCentralityAsCSV(
  data: { labels: string[]; measures: Record<string, number[]> },
  filename: string,
) {
  const measureNames = Object.keys(data.measures);
  const header = ['Node', ...measureNames].join(',');
  const rows = data.labels.map((label, i) =>
    [escapeCSV(label), ...measureNames.map(m => (data.measures[m]![i] ?? 0).toFixed(4))].join(','),
  );
  downloadFile([header, ...rows].join('\n'), filename);
}

/** Export edge list as CSV. */
export function exportEdgesAsCSV(
  edges: { from: string; to: string; weight: number }[],
  filename: string,
) {
  const header = 'from,to,weight';
  const rows = edges.map(e => `${escapeCSV(e.from)},${escapeCSV(e.to)},${e.weight}`);
  downloadFile([header, ...rows].join('\n'), filename);
}
