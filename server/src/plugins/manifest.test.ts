import { describe, it, expect } from 'vitest';
import {
  parseManifest,
  ManifestError,
  PLUGIN_API_VERSION,
  extensionKey,
  parseExtensionKey,
  capabilitySet,
} from './manifest.js';

/** A minimal valid manifest; tests spread over it to make one thing wrong. */
const base = () => ({
  id: 'org.example.drag-match',
  name: 'Drag & Match',
  version: '1.2.0',
  apiVersion: PLUGIN_API_VERSION,
  client: { entry: 'client/plugin.js' },
  extends: [
    {
      point: 'lecture.block' as const,
      id: 'drag-match',
      label: 'Drag & Match',
      component: 'DragMatchBlock',
    },
  ],
});

/** Collect the issue lines from a thrown ManifestError. */
const issuesOf = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ManifestError) return e.issues.length ? e.issues : [e.message];
    throw e;
  }
  throw new Error('expected parseManifest to throw');
};

describe('parseManifest', () => {
  it('accepts a minimal client-only plugin', () => {
    const m = parseManifest(base());
    expect(m.id).toBe('org.example.drag-match');
    expect(m.extends?.[0].component).toBe('DragMatchBlock');
  });

  it('accepts a full manifest', () => {
    const m = parseManifest({
      ...base(),
      description: 'Drag items onto their matches.',
      author: { name: 'Example Org', email: 'dev@example.org', url: 'https://example.org' },
      license: 'MIT',
      homepage: 'https://example.org/drag-match',
      laila: '>=3.16.0 <4.0.0',
      server: { entry: 'server/index.cjs' },
      client: { entry: 'client/plugin.js', styles: ['client/plugin.css'] },
      capabilities: ['store', 'db', 'http', 'events', 'grades:write', 'network'],
      migrations: 'migrations',
      locales: 'locales',
      network: ['https://api.example.org'],
      settings: [
        { key: 'maxPairs', label: 'Maximum pairs', type: 'number', default: 8, min: 2, max: 40 },
        {
          key: 'mode',
          label: 'Mode',
          type: 'select',
          options: [
            { value: 'strict', label: 'Strict' },
            { value: 'lenient', label: 'Lenient' },
          ],
          default: 'strict',
        },
      ],
    });
    expect(capabilitySet(m).has('db')).toBe(true);
    expect(m.settings).toHaveLength(2);
  });

  describe('identity', () => {
    it('requires a reverse-DNS id', () => {
      expect(issuesOf(() => parseManifest({ ...base(), id: 'dragmatch' }))[0]).toMatch(/reverse-DNS/);
      expect(issuesOf(() => parseManifest({ ...base(), id: 'Org.Example.X' }))[0]).toMatch(
        /reverse-DNS/,
      );
    });

    it('rejects an id that would escape its directory', () => {
      expect(() => parseManifest({ ...base(), id: '../../etc.passwd' })).toThrow(ManifestError);
      expect(() => parseManifest({ ...base(), id: 'a/b.c' })).toThrow(ManifestError);
    });

    it('requires semver', () => {
      expect(issuesOf(() => parseManifest({ ...base(), version: '1.2' }))[0]).toMatch(/semver/);
    });

    it('refuses a bundle built for another host API version', () => {
      expect(() => parseManifest({ ...base(), apiVersion: PLUGIN_API_VERSION + 1 })).toThrow(
        /host API version/,
      );
    });
  });

  describe('bundle paths', () => {
    it('rejects traversal, absolute paths and backslashes', () => {
      for (const entry of ['../../etc/passwd', '/etc/passwd', '..\\win.js', 'a/../../b.js']) {
        expect(
          () => parseManifest({ ...base(), client: { entry } }),
          `expected "${entry}" to be rejected`,
        ).toThrow(ManifestError);
      }
    });

    it('accepts an ordinary nested path', () => {
      expect(parseManifest({ ...base(), client: { entry: 'dist/client/plugin.js' } }).client?.entry)
        .toBe('dist/client/plugin.js');
    });
  });

  describe('capability cross-checks', () => {
    it('requires `db` to declare migrations', () => {
      expect(issuesOf(() => parseManifest({ ...base(), migrations: 'migrations' }))[0]).toMatch(
        /"db" capability/,
      );
      expect(() =>
        parseManifest({ ...base(), migrations: 'migrations', capabilities: ['db'] }),
      ).not.toThrow();
    });

    it('requires `network` to declare origins', () => {
      expect(
        issuesOf(() => parseManifest({ ...base(), network: ['https://api.example.org'] }))[0],
      ).toMatch(/"network" capability/);
    });

    it('rejects an unknown capability', () => {
      expect(() => parseManifest({ ...base(), capabilities: ['root'] })).toThrow(ManifestError);
    });
  });

  describe('extensions', () => {
    it('rejects extensions without a client entry to resolve them', () => {
      const { client: _client, ...noClient } = base();
      expect(issuesOf(() => parseManifest(noClient))[0]).toMatch(/client\.entry/);
    });

    it('rejects a duplicate extension id', () => {
      const m = base();
      expect(
        issuesOf(() => parseManifest({ ...m, extends: [m.extends[0], { ...m.extends[0] }] }))[0],
      ).toMatch(/duplicate extension/);
    });

    it('allows the same id at different extension points', () => {
      const m = base();
      expect(() =>
        parseManifest({
          ...m,
          extends: [m.extends[0], { ...m.extends[0], point: 'lab' as const }],
        }),
      ).not.toThrow();
    });

    it('requires a path on a course.tool', () => {
      const m = base();
      expect(
        issuesOf(() =>
          parseManifest({
            ...m,
            extends: [{ ...m.extends[0], point: 'course.tool' as const }],
          }),
        )[0],
      ).toMatch(/needs a `path`/);
    });

    it('requires component names to be JS identifiers', () => {
      const m = base();
      expect(() =>
        parseManifest({ ...m, extends: [{ ...m.extends[0], component: 'my-block' }] }),
      ).toThrow(ManifestError);
    });

    it('rejects an unknown extension point', () => {
      const m = base();
      expect(() =>
        parseManifest({ ...m, extends: [{ ...m.extends[0], point: 'course.sidebar' }] }),
      ).toThrow(ManifestError);
    });

    it('requires options on a select setting', () => {
      const m = base();
      expect(
        issuesOf(() =>
          parseManifest({
            ...m,
            settings: [{ key: 'mode', label: 'Mode', type: 'select' }],
          }),
        )[0],
      ).toMatch(/needs options/);
    });
  });

  it('requires at least one half', () => {
    const { client: _c, extends: _e, ...bare } = base();
    expect(issuesOf(() => parseManifest(bare))[0]).toMatch(/server or a client half/);
  });

  // strict() everywhere: a typo'd key is a packaging bug the author should see
  // at install, not a setting that silently does nothing forever.
  it('rejects unknown keys', () => {
    expect(() => parseManifest({ ...base(), permissions: ['store'] })).toThrow(ManifestError);
    expect(() => parseManifest({ ...base(), server: { entry: 'a.js', watch: true } })).toThrow(
      ManifestError,
    );
  });

  it('reports every problem at once', () => {
    const issues = issuesOf(() => parseManifest({ ...base(), id: 'bad', version: 'x' }));
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.join('\n')).toMatch(/id:/);
    expect(issues.join('\n')).toMatch(/version:/);
  });
});

describe('extensionKey', () => {
  it('round-trips', () => {
    const key = extensionKey('org.example.drag-match', 'drag-match');
    expect(key).toBe('plugin:org.example.drag-match:drag-match');
    expect(parseExtensionKey(key)).toEqual({
      pluginId: 'org.example.drag-match',
      extensionId: 'drag-match',
    });
  });

  // Every built-in section type must keep parsing as "not a plugin", or the
  // renderer would send text/video/quiz blocks down the plugin path.
  it('returns null for built-in section types', () => {
    for (const t of ['text', 'video', 'quiz', 'chatbot', 'file', 'url', 'embed', 'assignment']) {
      expect(parseExtensionKey(t)).toBeNull();
    }
    expect(parseExtensionKey('plugin:only-two')).toBeNull();
    expect(parseExtensionKey('plugin:a:b:c')).toBeNull();
  });
});
