/**
 * End-to-end check on the SDK: build the example plugin and verify the
 * artifact is one this server would accept and this client could run.
 *
 * The property that matters most is negative — the client bundle must NOT
 * contain React. Two React copies in one page breaks every hook, and the
 * symptom ("invalid hook call") points at the plugin author's code rather than
 * at the packaging mistake that caused it. A build regression here would be
 * silent until someone installed a plugin.
 *
 * Skipped when plugin-sdk's dependencies are not installed, so the suite still
 * runs in a checkout where only server/ has been npm-installed.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { createRequire } from 'module';
import JSZip from 'jszip';
import { readBundle } from '../services/plugin.service.js';
import { parseManifest } from './manifest.js';
import { assertPrefixed, readMigrations, tableName } from './db.js';

const repoRoot = path.resolve(__dirname, '../../..');
const sdkEntry = path.join(repoRoot, 'plugin-sdk/src/build.mjs');
const exampleRoot = path.join(repoRoot, 'plugin-examples/reflection-prompt');
const PID = 'org.laila.reflection-prompt';

/** The SDK needs esbuild + jszip resolvable from its own directory. */
const sdkInstalled = (): boolean => {
  try {
    const req = createRequire(sdkEntry);
    req.resolve('esbuild');
    req.resolve('jszip');
    return true;
  } catch {
    return false;
  }
};

const canBuild = sdkInstalled();

describe.skipIf(!canBuild)('SDK build of the example plugin', () => {
  let buffer: Buffer;

  beforeAll(async () => {
    const { buildPlugin } = (await import(sdkEntry)) as {
      buildPlugin: (o: { root: string; minify?: boolean }) => Promise<{ zipPath: string }>;
    };
    const { zipPath } = await buildPlugin({ root: exampleRoot });
    buffer = await fs.readFile(zipPath);
  }, 60_000);

  it('produces a bundle this server accepts', async () => {
    const { entries, manifestJson } = await readBundle(buffer);
    const manifest = parseManifest(JSON.parse(manifestJson));
    expect(manifest.id).toBe(PID);
    const names = entries.map((e) => e.rel).sort();
    expect(names).toContain('laila-plugin.json');
    expect(names).toContain('server/index.cjs');
    expect(names).toContain('client/plugin.js');
    expect(names).toContain('migrations/001_init.postgres.sql');
    expect(names).toContain('migrations/001_init.sqlite.sql');
  });

  it('shares the host React instead of bundling a second copy', async () => {
    const zip = await JSZip.loadAsync(buffer);
    const client = await zip.file('client/plugin.js')!.async('string');

    expect(client).toContain('__LAILA_PLUGIN_HOST__');
    // esbuild minifies modules["react"] to modules.react, so accept either.
    expect(client).toMatch(/modules(\.react\b|\["react"\])/);
    expect(client).toMatch(/modules\["react\/jsx-runtime"\]/);

    // React's own internals must be absent. If any of these appear, the
    // externalisation broke and every hook in every plugin will throw.
    for (const fingerprint of [
      'ReactCurrentDispatcher',
      'react.production.min.js',
      'Invalid hook call',
      '__SECRET_INTERNALS_DO_NOT_USE',
    ]) {
      expect(client, `client bundle must not contain React internals (${fingerprint})`).not.toContain(
        fingerprint,
      );
    }
    // A bundle with React inside would be two orders of magnitude larger.
    expect(client.length).toBeLessThan(50_000);
  });

  it('exports exactly the components the manifest names', async () => {
    const zip = await JSZip.loadAsync(buffer);
    const client = await zip.file('client/plugin.js')!.async('string');
    const manifest = parseManifest(JSON.parse(await zip.file('laila-plugin.json')!.async('string')));
    for (const ext of manifest.extends ?? []) {
      expect(client, `must export ${ext.component}`).toContain(ext.component);
      if (ext.editor) expect(client, `must export ${ext.editor}`).toContain(ext.editor);
    }
  });

  it('emits CommonJS for the server half, because the host is CJS', async () => {
    const zip = await JSZip.loadAsync(buffer);
    const server = await zip.file('server/index.cjs')!.async('string');
    expect(server).toMatch(/module\.exports|exports\./);
    expect(server).toContain('register');
    // An `import ... from` at the top level would mean ESM output, which the
    // host's require() path could not load.
    expect(server).not.toMatch(/^\s*import\s+\{/m);
  });
});

// These need no build, so they always run.
describe('example plugin migrations', () => {
  it('pass the prefix guard on both dialects', async () => {
    for (const dialect of ['postgres', 'sqlite'] as const) {
      const migs = await readMigrations(path.join(exampleRoot, 'migrations'), dialect);
      expect(migs.length).toBeGreaterThan(0);
      migs.forEach((m) => {
        const objects = assertPrefixed(PID, m.sql);
        expect(objects.length).toBeGreaterThan(0);
      });
    }
  });

  it('create the table api.db.table() resolves to', async () => {
    const expected = tableName(PID, 'reflections');
    const migs = await readMigrations(path.join(exampleRoot, 'migrations'), 'postgres');
    expect(migs[0].sql).toContain(expected);
  });
});
