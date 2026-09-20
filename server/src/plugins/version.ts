/**
 * Just enough semver for the plugin system: compare two versions, and test a
 * version against the kind of range a manifest's `laila` field carries.
 *
 * Deliberately not a dependency. The `semver` package is 2,000 lines solving
 * a problem we have in one place, and the subset below (comparators, `^`, `~`,
 * space- or comma-joined ANDs) is the subset a plugin manifest can express —
 * `manifest.ts` caps the field at 32 characters precisely so this stays true.
 * Anything it cannot parse is reported, never silently treated as "matches".
 */

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  /** Dot-separated identifiers, empty for a release. */
  prerelease: string[];
}

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** Parse a semver string, or return null when it is not one. */
export function parseVersion(raw: string): ParsedVersion | null {
  const m = VERSION_RE.exec(raw.trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split('.') : [],
  };
}

/**
 * Compare prerelease identifier lists per semver §11.4: numeric identifiers
 * compare numerically, alphanumeric ones lexically, numeric sorts below
 * alphanumeric, and a longer list wins when all shared fields are equal.
 */
function comparePrerelease(a: string[], b: string[]): number {
  // A release outranks any prerelease of the same version (§11.3).
  if (!a.length && !b.length) return 0;
  if (!a.length) return 1;
  if (!b.length) return -1;

  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d < 0 ? -1 : 1;
    } else if (xn !== yn) {
      return xn ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Standard comparator: negative when `a` sorts before `b`, zero when equal.
 *
 * @throws {Error} when either side is not a semver string — a silent 0 here
 *   would make an unparseable version compare equal to everything.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa) throw new Error(`Not a semver version: "${a}"`);
  if (!pb) throw new Error(`Not a semver version: "${b}"`);
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
  return comparePrerelease(pa.prerelease, pb.prerelease);
}

const COMPARATOR_RE = /^(>=|<=|>|<|\^|~|=)?\s*(.+)$/;

/** Upper bound (exclusive) of a `^` range: the next non-zero-preserving major. */
function caretCeiling(v: ParsedVersion): ParsedVersion {
  // Below 1.0.0 semver gives no compatibility promise across minors, so `^`
  // narrows: ^0.2.3 allows <0.3.0, ^0.0.3 allows <0.0.4.
  if (v.major !== 0) return { major: v.major + 1, minor: 0, patch: 0, prerelease: [] };
  if (v.minor !== 0) return { major: 0, minor: v.minor + 1, patch: 0, prerelease: [] };
  return { major: 0, minor: 0, patch: v.patch + 1, prerelease: [] };
}

const fmt = (v: ParsedVersion): string => `${v.major}.${v.minor}.${v.patch}`;

/** Test one comparator, e.g. ">=3.16.0" or "^1.2.0". */
function satisfiesOne(version: string, comparator: string): boolean {
  const m = COMPARATOR_RE.exec(comparator.trim());
  if (!m) throw new Error(`Unparseable version range: "${comparator}"`);
  const [, op = '=', rest] = m;
  const target = parseVersion(rest);
  if (!target) throw new Error(`Unparseable version range: "${comparator}"`);

  switch (op) {
    case '>=':
      return compareVersions(version, rest) >= 0;
    case '>':
      return compareVersions(version, rest) > 0;
    case '<=':
      return compareVersions(version, rest) <= 0;
    case '<':
      return compareVersions(version, rest) < 0;
    case '=':
      return compareVersions(version, rest) === 0;
    case '~':
      // Patch-level drift: >=x.y.z <x.(y+1).0
      return (
        compareVersions(version, rest) >= 0 &&
        compareVersions(version, fmt({ ...target, minor: target.minor + 1, patch: 0 })) < 0
      );
    case '^':
      return (
        compareVersions(version, rest) >= 0 &&
        compareVersions(version, fmt(caretCeiling(target))) < 0
      );
    default:
      throw new Error(`Unsupported range operator: "${op}"`);
  }
}

/**
 * Does `version` satisfy `range`?
 *
 * Supports a single comparator or several ANDed together, separated by spaces
 * or commas: `">=3.16.0 <4.0.0"`. There is no `||` — a plugin that needs
 * disjoint host ranges is telling us something the manifest should not hide.
 *
 * @param version the host version, e.g. "3.16.0"
 * @param range the manifest's `laila` field
 * @returns true when every comparator holds
 * @throws {Error} when the range cannot be parsed
 */
export function satisfies(version: string, range: string): boolean {
  const parts = range
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) throw new Error('Empty version range');
  return parts.every((p) => satisfiesOne(version, p));
}
