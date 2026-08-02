/**
 * Recover a human-readable filename from an uploaded file's URL.
 *
 * Uploads are stored as `<uuid>-<original stem><ext>` (see the `storage` config
 * in `server/src/routes/upload.routes.ts`), so the display name is whatever is
 * left once the 36-character uuid and its separating dash are removed.
 *
 * Files uploaded BEFORE that format existed are named `<uuid><ext>` and carry
 * no original name at all — stripping the uuid leaves a bare ".png". There is
 * nothing to recover for those, so they fall back to `file-<n><ext>`, which at
 * least reads as a file rather than as a broken label.
 */
export const displayFileName = (url: string, index = 0): string => {
  const rawName = url.split('/').pop() || `file-${index + 1}`;
  const stripped = rawName.replace(/^[\w-]{36}/, '').replace(/^-/, '');

  // Nothing but an extension (or nothing at all) means the name was never
  // stored. Anything else is a real name we can show.
  if (!stripped || stripped.startsWith('.')) {
    const ext = stripped.startsWith('.') ? stripped : '';
    return `file-${index + 1}${ext}`;
  }

  try {
    return decodeURIComponent(stripped) || rawName;
  } catch {
    // A lone '%' in the name makes decodeURIComponent throw; show it as stored.
    return stripped;
  }
};
