/**
 * What an instructor may attach to an assignment.
 *
 * These MUST stay in step with `ASSIGNMENT_FILE_EXTENSIONS` and
 * `ASSIGNMENT_FILE_MAX_BYTES` in `server/src/routes/upload.routes.ts`. The
 * server is what actually enforces them; everything here exists only so the
 * file picker offers the right formats and an oversized file is rejected before
 * it spends the user's bandwidth. Widening this list alone does nothing.
 */

/** `accept` attribute for the file input. */
export const ASSIGNMENT_FILE_ACCEPT =
  '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.zip,.rar,.7z';

/** 3MB — mirrors the multer limit. */
export const ASSIGNMENT_FILE_MAX_BYTES = 3 * 1024 * 1024;

/** Rendered into the "max {{limit}} per file" hint and the too-large toast. */
export const ASSIGNMENT_FILE_MAX_LABEL = '3 MB';

/**
 * Human-readable format summary for the upload hint. Not exhaustive by design —
 * listing all seventeen extensions is noise; the picker filters accurately.
 */
export const ASSIGNMENT_FILE_FORMATS_LABEL = 'PDF, Word, PowerPoint, Excel, CSV, TXT, images, ZIP';

/** Bytes → a short "820 KB" / "2.4 MB" label. */
export const formatFileSize = (bytes?: number | null): string => {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Lowercased extension without the dot, for `AssignmentAttachment.fileType`. */
export const fileExtension = (fileName: string): string =>
  (fileName.split('.').pop() || '').toLowerCase();
