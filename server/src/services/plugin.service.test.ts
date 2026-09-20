import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';
import os from 'os';
import path from 'path';
import {
  readBundle,
  safeEntryPath,
  PluginInstallError,
  MANIFEST_FILE,
  MAX_ENTRIES,
  MAX_FILE_BYTES,
  MAX_UNPACKED_BYTES,
} from './plugin.service.js';
import { PLUGIN_API_VERSION } from '../plugins/manifest.js';

vi.mock('../utils/logger.js', () => {
  const noop = () => {};
  return { createLogger: () => ({ error: noop, warn: noop, info: noop, debug: noop }) };
});
vi.mock('../utils/prisma.js', () => ({ default: { plugin: {}, pluginMigration: {} } }));

const validManifest = {
  id: 'org.example.drag-match',
  name: 'Drag & Match',
  version: '1.0.0',
  apiVersion: PLUGIN_API_VERSION,
  client: { entry: 'client/plugin.js' },
  extends: [
    { point: 'lecture.block', id: 'drag-match', label: 'Drag & Match', component: 'Block' },
  ],
};

/**
 * Build a zip in memory from a path → contents map.
 *
 * DEFLATE, not JSZip's default STORE: a zip-bomb fixture that is not actually
 * compressed proves nothing about the unpacker.
 */
const zipOf = async (files: Record<string, string | Buffer>): Promise<Buffer> => {
  const zip = new JSZip();
  Object.entries(files).forEach(([name, body]) => zip.file(name, body));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};

/**
 * Build a zip containing a literally-named entry, bypassing JSZip's own path
 * normalisation.
 *
 * `zip.file('../../x')` silently resolves the `..` away, so a bundle built the
 * normal way can never carry a traversing name — which would make the guard
 * look tested when it was not. A real attacker writes the central directory by
 * hand; this reaches into JSZip's entry map to the same effect.
 */
const zipWithRawName = async (rawName: string, others: Record<string, string>): Promise<Buffer> => {
  const zip = new JSZip();
  Object.entries(others).forEach(([name, body]) => zip.file(name, body));
  zip.file('placeholder', 'x');
  const entry = (zip.files as Record<string, { name: string }>).placeholder;
  entry.name = rawName;
  (zip.files as Record<string, unknown>)[rawName] = entry;
  delete (zip.files as Record<string, unknown>).placeholder;
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};

const goodBundle = () =>
  zipOf({
    [MANIFEST_FILE]: JSON.stringify(validManifest),
    'client/plugin.js': 'export const Block = () => null;',
  });

describe('safeEntryPath', () => {
  const root = path.join(os.tmpdir(), 'root');

  it('resolves an ordinary nested entry inside the root', () => {
    expect(safeEntryPath(root, 'client/plugin.js')).toBe(path.join(root, 'client/plugin.js'));
  });

  // Each of these writes outside the plugin directory if it gets through.
  it.each([
    '../../server/.env',
    '../escape.js',
    '/etc/passwd',
    'C:\\Windows\\system32\\x.dll',
    '..\\..\\win.js',
    'a/../../../b.js',
    'a/./../../b.js',
  ])('refuses %s', (entry) => {
    expect(() => safeEntryPath(root, entry)).toThrow(PluginInstallError);
  });

  it('refuses a NUL byte in the name', () => {
    expect(() => safeEntryPath(root, 'a\0b.js')).toThrow(/NUL/);
  });

  it('refuses an empty name', () => {
    expect(() => safeEntryPath(root, '')).toThrow(PluginInstallError);
  });

  // A name that merely starts with the root's characters is not inside it:
  // /tmp/rootevil must not pass a naive startsWith check.
  it('is not fooled by a sibling directory sharing the prefix', () => {
    expect(() => safeEntryPath(root, '../rootevil/x.js')).toThrow(PluginInstallError);
  });
});

describe('readBundle', () => {
  it('reads a well-formed bundle', async () => {
    const { entries, manifestJson } = await readBundle(await goodBundle());
    expect(JSON.parse(manifestJson).id).toBe('org.example.drag-match');
    expect(entries.map((e) => e.rel).sort()).toEqual(['client/plugin.js', MANIFEST_FILE]);
  });

  it('rejects something that is not a zip', async () => {
    await expect(readBundle(Buffer.from('this is not a zip'))).rejects.toThrow(
      /Not a readable zip/,
    );
  });

  it('rejects a zip with no manifest at the root', async () => {
    const buf = await zipOf({ 'client/plugin.js': 'x' });
    await expect(readBundle(buf)).rejects.toThrow(/no laila-plugin\.json/);
  });

  // `git archive` and most GUI zip tools wrap everything in one folder; both
  // layouts should install rather than one failing confusingly.
  it('strips a single wrapping directory', async () => {
    const buf = await zipOf({
      [`drag-match-1.0.0/${MANIFEST_FILE}`]: JSON.stringify(validManifest),
      'drag-match-1.0.0/client/plugin.js': 'x',
    });
    const { entries, manifestJson } = await readBundle(buf);
    expect(JSON.parse(manifestJson).id).toBe('org.example.drag-match');
    expect(entries.map((e) => e.rel).sort()).toEqual(['client/plugin.js', MANIFEST_FILE]);
  });

  it('does not strip when the manifest is already at the root', async () => {
    const buf = await zipOf({
      [MANIFEST_FILE]: JSON.stringify(validManifest),
      'client/plugin.js': 'x',
    });
    const { entries } = await readBundle(buf);
    expect(entries.some((e) => e.rel === MANIFEST_FILE)).toBe(true);
  });

  it('does not strip when there are several top-level entries', async () => {
    const buf = await zipOf({
      [`a/${MANIFEST_FILE}`]: JSON.stringify(validManifest),
      'b/other.js': 'x',
    });
    await expect(readBundle(buf)).rejects.toThrow(/no laila-plugin\.json/);
  });

  // Verified against jszip 3.10 in this session: loadAsync NORMALISES entry
  // names, so '../../../server/.env' arrives as 'server/.env' and a traversing
  // name never reaches safeEntryPath through this library. The guard stays as
  // defence in depth — it is the thing that would still hold if the zip
  // library were swapped — so the property asserted here is the one that
  // actually matters to a caller: nothing readBundle returns can escape.
  it.each([
    '../../../server/.env',
    '/etc/cron.d/backdoor',
    '..\\..\\windows\\x.dll',
  ])('never yields an escaping path for the hostile entry %s', async (evil) => {
    const buf = await zipWithRawName(evil, {
      [MANIFEST_FILE]: JSON.stringify(validManifest),
    });
    const root = path.join(os.tmpdir(), 'plugin-root');
    let entries;
    try {
      ({ entries } = await readBundle(buf));
    } catch (e) {
      // Rejecting outright is also a correct outcome.
      expect(e).toBeInstanceOf(PluginInstallError);
      return;
    }
    entries.forEach((entry) => {
      expect(entry.rel.startsWith('/')).toBe(false);
      expect(entry.rel.split('/')).not.toContain('..');
      // The decisive check: where it would actually be written.
      const dest = safeEntryPath(root, entry.rel);
      expect(dest.startsWith(root + path.sep)).toBe(true);
    });
  });

  it('refuses too many entries', async () => {
    const files: Record<string, string> = { [MANIFEST_FILE]: JSON.stringify(validManifest) };
    for (let i = 0; i <= MAX_ENTRIES; i++) files[`f/${i}.txt`] = 'x';
    await expect(readBundle(await zipOf(files))).rejects.toThrow(/over the .* limit/);
  });

  it('refuses a single oversized file', async () => {
    const buf = await zipOf({
      [MANIFEST_FILE]: JSON.stringify(validManifest),
      'big.bin': Buffer.alloc(MAX_FILE_BYTES + 1, 0),
    });
    await expect(readBundle(buf)).rejects.toThrow(/per-file limit/);
  });

  // The classic zip bomb: highly compressible content that is small on disk
  // and enormous in memory. The cap is measured while unpacking, not read from
  // the archive's own (attacker-controlled) metadata.
  it('refuses a bundle that expands past the total limit', async () => {
    const chunk = Buffer.alloc(MAX_FILE_BYTES, 0); // compresses to almost nothing
    const files: Record<string, string | Buffer> = {
      [MANIFEST_FILE]: JSON.stringify(validManifest),
    };
    const needed = Math.ceil(MAX_UNPACKED_BYTES / MAX_FILE_BYTES) + 1;
    for (let i = 0; i < needed; i++) files[`bomb/${i}.bin`] = chunk;
    const buf = await zipOf(files);
    // Proof it really is a bomb: tiny on the wire, over the cap when expanded.
    expect(buf.length).toBeLessThan(MAX_UNPACKED_BYTES);
    await expect(readBundle(buf)).rejects.toThrow(/refusing to continue/);
  }, 30_000);

  it('accepts a bundle right at the entry limit', async () => {
    const files: Record<string, string> = { [MANIFEST_FILE]: JSON.stringify(validManifest) };
    for (let i = 0; i < MAX_ENTRIES - 1; i++) files[`f/${i}.txt`] = 'x';
    await expect(readBundle(await zipOf(files))).resolves.toBeTruthy();
  });
});
