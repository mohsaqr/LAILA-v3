const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];

/** Extension from a filename ("a.pdf" → "pdf") or a mime/bare type. */
export const extOf = (fileName?: string | null, fileType?: string | null): string => {
  // Strip any query string / fragment first so a URL-like name ("a.png?v=2")
  // yields "png", not "png?v=2".
  const cleanName = (fileName ?? '').split(/[?#]/)[0];
  const fromName = cleanName.includes('.') ? cleanName.split('.').pop() ?? '' : '';
  if (fromName) return fromName.toLowerCase();
  const ft = (fileType ?? '').toLowerCase();
  if (ft.includes('/')) return ft.split('/').pop() ?? '';
  return ft.replace(/^\./, '');
};

/**
 * Whether a file can be viewed inline in the browser (image or PDF), and how.
 * Returns null for anything that should just be downloaded. Used to decide
 * between a "View" (open in new tab) and a "Download" action on file cards.
 */
export const previewKind = (
  fileName?: string | null,
  fileType?: string | null,
): 'image' | 'pdf' | null => {
  const mime = (fileType ?? '').toLowerCase();
  const ext = extOf(fileName, fileType);
  if (mime.startsWith('image/') || IMAGE_EXTS.includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  return null;
};
