/**
 * Hand the browser a generated file without a server round-trip.
 *
 * Shared by the per-cell Markdown export and the whole-notebook .Rmd download.
 */
export const downloadText = (filename: string, text: string, mime = 'text/markdown') => {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/** Turn a human title into a safe, readable file name stem. */
export const toFileSlug = (title: string, fallback: string): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || fallback;
};
