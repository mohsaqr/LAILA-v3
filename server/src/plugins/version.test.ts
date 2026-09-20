import { describe, it, expect } from 'vitest';
import { parseVersion, compareVersions, satisfies } from './version.js';

describe('parseVersion', () => {
  it('parses a plain release', () => {
    expect(parseVersion('3.16.0')).toEqual({ major: 3, minor: 16, patch: 0, prerelease: [] });
  });

  it('accepts a leading v and build metadata', () => {
    expect(parseVersion('v1.2.3+build.5')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: [],
    });
  });

  it('splits prerelease identifiers', () => {
    expect(parseVersion('1.0.0-rc.2')?.prerelease).toEqual(['rc', '2']);
  });

  it('returns null for a non-version', () => {
    expect(parseVersion('3.16')).toBeNull();
    expect(parseVersion('latest')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('orders by major, minor, then patch', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
    expect(compareVersions('1.2.0', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('1.2.10', '1.2.9')).toBeGreaterThan(0);
    expect(compareVersions('3.16.0', '3.16.0')).toBe(0);
  });

  it('ranks a release above its prereleases', () => {
    expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0-rc.1', '1.0.0')).toBeLessThan(0);
  });

  it('orders prerelease identifiers per semver 11.4', () => {
    expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBeLessThan(0);
    expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.beta')).toBeLessThan(0);
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.11')).toBeLessThan(0);
    expect(compareVersions('1.0.0-rc.1', '1.0.0-beta.11')).toBeGreaterThan(0);
  });

  // The whole point of throwing: a silent 0 would make garbage compare equal
  // to every real version, and a plugin gate would wave it through.
  it('throws rather than treating garbage as equal', () => {
    expect(() => compareVersions('latest', '1.0.0')).toThrow(/Not a semver/);
    expect(() => compareVersions('1.0.0', '')).toThrow(/Not a semver/);
  });

  it('is a total order (antisymmetric and transitive on a sample)', () => {
    // Math.sign(-0) is -0, and toBe uses Object.is, where -0 !== 0. Normalise
    // to plain -1/0/1 so the assertion tests ordering, not signed zero.
    const sign = (n: number) => (n < 0 ? -1 : n > 0 ? 1 : 0);
    const sorted = ['1.0.0-alpha', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0', '1.0.1', '1.1.0', '2.0.0'];
    sorted.forEach((a, i) => {
      sorted.forEach((b, j) => {
        const c = compareVersions(a, b);
        if (i < j) expect(c).toBeLessThan(0);
        else if (i > j) expect(c).toBeGreaterThan(0);
        else expect(c).toBe(0);
        // antisymmetry
        expect(sign(compareVersions(b, a))).toBe(sign(-c));
      });
    });
  });
});

describe('satisfies', () => {
  it('handles each comparator', () => {
    expect(satisfies('3.16.0', '>=3.16.0')).toBe(true);
    expect(satisfies('3.15.9', '>=3.16.0')).toBe(false);
    expect(satisfies('3.16.1', '>3.16.0')).toBe(true);
    expect(satisfies('3.16.0', '>3.16.0')).toBe(false);
    expect(satisfies('3.16.0', '<=3.16.0')).toBe(true);
    expect(satisfies('3.16.0', '<4.0.0')).toBe(true);
    expect(satisfies('3.16.0', '3.16.0')).toBe(true);
    expect(satisfies('3.16.0', '=3.16.0')).toBe(true);
    expect(satisfies('3.16.1', '3.16.0')).toBe(false);
  });

  it('ANDs several comparators', () => {
    expect(satisfies('3.16.0', '>=3.16.0 <4.0.0')).toBe(true);
    expect(satisfies('4.0.0', '>=3.16.0 <4.0.0')).toBe(false);
    expect(satisfies('3.16.0', '>=3.16.0, <4.0.0')).toBe(true);
  });

  it('caret allows minor and patch drift above 1.0.0', () => {
    expect(satisfies('1.5.2', '^1.2.0')).toBe(true);
    expect(satisfies('2.0.0', '^1.2.0')).toBe(false);
    expect(satisfies('1.1.9', '^1.2.0')).toBe(false);
  });

  it('caret narrows below 1.0.0', () => {
    expect(satisfies('0.2.9', '^0.2.3')).toBe(true);
    expect(satisfies('0.3.0', '^0.2.3')).toBe(false);
    expect(satisfies('0.0.3', '^0.0.3')).toBe(true);
    expect(satisfies('0.0.4', '^0.0.3')).toBe(false);
  });

  it('tilde allows patch drift only', () => {
    expect(satisfies('1.2.9', '~1.2.0')).toBe(true);
    expect(satisfies('1.3.0', '~1.2.0')).toBe(false);
    expect(satisfies('1.1.9', '~1.2.0')).toBe(false);
  });

  it('throws on an unparseable range instead of matching everything', () => {
    expect(() => satisfies('3.16.0', 'any')).toThrow(/Unparseable/);
    expect(() => satisfies('3.16.0', '')).toThrow(/Empty version range/);
    expect(() => satisfies('3.16.0', '>=banana')).toThrow(/Unparseable/);
  });
});
