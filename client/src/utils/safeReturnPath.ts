/**
 * Reduce a proposed post-login destination to something that can only ever
 * point back into this app.
 *
 * The login form is the classic open-redirect sink: an attacker who can choose
 * where sign-in lands you can bounce you to a look-alike site with a real
 * session in hand. So the rule here is allow-list shaped — a value must be a
 * plain in-app absolute path or it is discarded for the dashboard. Nothing is
 * "cleaned up" and then trusted.
 *
 * Two spellings of "leave the site" have to be caught:
 *
 *   //evil.example    protocol-relative; browsers treat it as absolute
 *   /\evil.example    same thing, because a browser normalises `\` to `/` in
 *                     the authority position
 *
 * The second is the react-router advisory GHSA-wrjc-x8rr-h8h6 (the
 * CVE-2025-68470 bypass). It is unpatched in the 6.x line — the fix is in 7.18,
 * a major upgrade — so this guard does not depend on the router being fixed.
 */
export const DEFAULT_RETURN_PATH = '/dashboard';

/**
 * True if the string carries a C0 control character or DEL.
 *
 * Written as a code-point test rather than a regex on purpose: a character
 * class spelled with escapes is easy to mangle into something that silently
 * matches ordinary characters (an earlier draft of this file compiled to
 * "space or hyphen", which would have rejected half the routes in the app).
 * Comparing numbers cannot drift that way.
 */
const hasControlChar = (value: string): boolean =>
  Array.from(value).some((ch) => {
    const code = ch.codePointAt(0)!;
    return code < 0x20 || code === 0x7f;
  });

export const safeReturnPath = (
  pathname?: string | null,
  search?: string | null
): string => {
  if (!pathname) return DEFAULT_RETURN_PATH;

  // Every backslash becomes a forward slash BEFORE the prefix test, so a mixed
  // spelling like `/\/evil.example` cannot smuggle an authority past a check
  // that is only looking for two forward slashes.
  const normalised = pathname.replace(/\\/g, '/');

  // Must be an absolute in-app path, and must not begin an authority.
  if (!normalised.startsWith('/') || normalised.startsWith('//')) {
    return DEFAULT_RETURN_PATH;
  }

  // A path carrying a control character is not trusted rather than stripped:
  // there is no legitimate in-app route that contains one.
  if (hasControlChar(normalised + (search ?? ''))) {
    return DEFAULT_RETURN_PATH;
  }

  return `${normalised}${search ?? ''}`;
};
