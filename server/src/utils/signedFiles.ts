import crypto from 'crypto';
import path from 'path';

/**
 * Signed-URL capability for private files (assignment submissions).
 *
 * WHY. Submission files hold PII (student names, graded work). They used to sit
 * in the world-readable /uploads static mount, protected only by an unguessable
 * UUID filename — a URL leaked via chat, logs, or a shared screen was fetchable
 * by anyone, forever. But the app authenticates with a Bearer JWT in a header,
 * and files are opened with plain <a href>/<img src>, which cannot carry that
 * header. So header-auth on the file route is not an option.
 *
 * The scheme: private files live OUTSIDE the static mount. An authenticated,
 * authorized API response (which already checks the caller may see the
 * submission) mints a short-lived signed URL for the file. The download route
 * validates only the signature + expiry — the signed URL IS the capability, and
 * its short life bounds the exposure of a leaked link to minutes, not forever.
 */

// HMAC key. JWT_SECRET is already required at boot and is not a cookie secret,
// so reusing it keeps the config surface small. Read lazily: the module must
// not throw at import time (before dotenv runs). See CLAUDE.md env gotcha.
function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is required to sign file URLs');
  return s;
}

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** Reject anything that is not a bare filename (no traversal, no separators). */
export function isSafeFilename(filename: string): boolean {
  return (
    typeof filename === 'string' &&
    filename.length > 0 &&
    filename === path.basename(filename) &&
    !filename.includes('..') &&
    !filename.includes('/') &&
    !filename.includes('\\')
  );
}

function computeSig(filename: string, exp: number): string {
  return crypto.createHmac('sha256', secret()).update(`${filename}.${exp}`).digest('hex');
}

/**
 * Build a signed, time-limited download URL for a private submission file.
 * Returned as a root-relative path so the client resolves it against the app
 * origin (nginx proxies /api) without any change to resolveFileUrl.
 */
export function signSubmissionUrl(filename: string, ttlMs: number = DEFAULT_TTL_MS, now: number = Date.now()): string {
  if (!isSafeFilename(filename)) {
    throw new Error('Unsafe filename');
  }
  const exp = now + ttlMs;
  const sig = computeSig(filename, exp);
  return `/api/files/submission/${encodeURIComponent(filename)}?exp=${exp}&sig=${sig}`;
}

/**
 * Validate a signed download request. Constant-time signature comparison; the
 * caller supplies the current time so this stays testable without a clock.
 */
export function verifySubmissionSignature(
  filename: string,
  exp: number | string | undefined,
  sig: string | undefined,
  now: number = Date.now()
): boolean {
  if (!isSafeFilename(filename) || !sig || exp === undefined) return false;
  const expNum = typeof exp === 'string' ? parseInt(exp, 10) : exp;
  if (!Number.isFinite(expNum) || expNum < now) return false;
  const expected = computeSig(filename, expNum);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
