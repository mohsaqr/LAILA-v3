/**
 * Helpers for the `/uploads/...` URL space the course package moves around.
 *
 * Uploaded files are served from `<cwd>/uploads` (see index.ts) and referenced
 * everywhere by their public URL. These helpers map between the two and find
 * every such URL inside an arbitrary blob of text — a column value, a lecture's
 * TipTap HTML, or the JSON-serialised package itself.
 */
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

/**
 * Sub-trees of `/uploads/` that are derived caches rather than content.
 * `slides/<base>/` is rendered from a .pptx on first view and regenerates
 * itself after the .pptx gets a new name, so packaging it would only ship a
 * stale copy under an unreachable path.
 */
const DERIVED_PREFIXES = ['/uploads/slides/'];

/**
 * Every distinct `/uploads/...` URL in `text`, in first-seen order, excluding
 * derived caches. A URL ends at whitespace, a quote, an HTML/JSON delimiter, a
 * backslash (the escape in JSON-in-JSON), or an entity ampersand — upload
 * file names never contain those (upload.routes.ts strips them).
 */
export const findUploadUrls = (text: string): string[] => {
  const seen = new Set<string>();
  const re = /\/uploads\/[^\s"'<>()\\&,]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // A URL may legitimately end in a letter but a sentence may glue
    // punctuation onto it; trailing dots/semicolons are never part of a name.
    const url = m[0].replace(/[.;:]+$/, '');
    if (DERIVED_PREFIXES.some((p) => url.startsWith(p))) continue;
    seen.add(url);
  }
  return [...seen];
};

/**
 * On-disk path for an upload URL, refusing anything that escapes the uploads
 * directory. Returns null (rather than throwing) for a malformed URL so that a
 * stray string in old content degrades to "file not found", not a 500.
 */
export const resolveUploadPath = (url: string): string | null => {
  if (!url.startsWith('/uploads/')) return null;
  let rel: string;
  try {
    rel = decodeURIComponent(url.slice('/uploads/'.length));
  } catch {
    return null;
  }
  const full = path.resolve(UPLOADS_DIR, rel);
  if (full === UPLOADS_DIR || !full.startsWith(UPLOADS_DIR + path.sep)) return null;
  return full;
};

/**
 * A fresh upload URL for a copy of `originalUrl`: same sub-directory, same
 * extension, same human stem, new UUID — the exact shape upload.routes.ts
 * produces, so every consumer that strips the UUID for display keeps working.
 */
export const newUploadUrlFor = (originalUrl: string): string => {
  const dir = path.posix.dirname(originalUrl);
  const ext = path.posix.extname(originalUrl);
  const stem = path.posix.basename(originalUrl, ext).replace(/^[0-9a-f-]{36}-?/i, '') || 'file';
  return `${dir}/${randomUUID()}-${stem}${ext}`;
};

/**
 * Replace every URL in `map` inside `text`. Longest URLs first so a URL that is
 * a prefix of another (`/uploads/a` vs `/uploads/a.pdf`) cannot corrupt it.
 */
export const rewriteUploadUrls = (text: string, map: ReadonlyMap<string, string>): string => {
  const urls = [...map.keys()].sort((a, b) => b.length - a.length);
  return urls.reduce((acc, from) => acc.split(from).join(map.get(from) as string), text);
};
