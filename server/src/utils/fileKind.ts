/**
 * Working out what an uploaded file actually is.
 *
 * `LectureSection.fileType` and `LectureAttachment.fileType` are written by the
 * *client*, and the clients disagree about what belongs there: some store the
 * browser's MIME type (`SectionListEditor.tsx` writes `file.type`), some store a
 * bare extension (`FileBlock.tsx` writes `file.name.split('.').pop()`). The
 * upload route knows the authoritative `req.file.mimetype` but only returns it
 * in JSON — the DB row is written by a separate call that may discard it.
 *
 * Nothing normalises the column, and back-filling it would rewrite live rows on
 * a guess. So every reader has to cope with both shapes, and does it here rather
 * than open-coding the same three-way check.
 */

/** A PDF, whether `fileType` holds `application/pdf`, `pdf`, or nothing useful. */
export const isPdfFile = (
  fileType?: string | null,
  fileName?: string | null,
): boolean => {
  if (fileType === 'application/pdf') return true;
  if (fileType?.toLowerCase().includes('pdf')) return true;
  if (fileName?.toLowerCase().endsWith('.pdf')) return true;
  return false;
};

/**
 * The lower-case extension, preferring the filename and falling back to the
 * trailing segment of a MIME type. Empty string when neither yields one.
 *
 * The filename wins because it is what the user uploaded; a MIME type may be
 * the browser's guess, and for unknown types browsers send
 * `application/octet-stream`, which describes nothing.
 */
export const fileExtensionOf = (
  fileName?: string | null,
  fileType?: string | null,
): string => {
  const fromName = fileName?.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (fromName) return fromName;

  const mime = fileType?.toLowerCase().trim();
  if (!mime) return '';
  // `application/pdf` → `pdf`; a bare `pdf` stays `pdf`.
  const tail = mime.includes('/') ? mime.split('/').pop() ?? '' : mime;
  return tail.replace(/^\./, '');
};
