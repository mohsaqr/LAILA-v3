/**
 * Integration test for the loader: a real plugin directory on disk, a real
 * `require()` into this process, a real `register(api)` call.
 *
 * Unit tests with a mocked module loader would prove nothing about the claim
 * that matters here — that foreign code genuinely runs in-process and can
 * register routes, hooks and jobs through the host API. So these tests write
 * actual `.cjs` and `.mjs` files to a temp directory, point `PLUGIN_DIR` at it,
 * and load them.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

vi.mock('../utils/logger.js', () => {
  const noop = () => {};
  return { createLogger: () => ({ error: noop, warn: noop, info: noop, debug: noop }) };
});
vi.mock('../utils/prisma.js', () => ({
  default: {
    plugin: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    pluginMigration: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
  },
}));
vi.mock('../services/llm.service.js', () => ({ llmService: { chat: vi.fn() } }));
vi.mock('../services/activityLog.service.js', () => ({
  activityLogService: { logActivity: vi.fn() },
}));

import prisma from '../utils/prisma.js';
import { pluginPath, importServerEntry, loadPlugin, loadAllPlugins, PluginLoadError } from './loader.js';
import { pluginRegistry } from './registry.js';
import { pluginEvents } from './events.js';
import { PLUGIN_API_VERSION, type Capability } from './manifest.js';

const PID = 'org.example.integration';

let dir: string;
const originalPluginDir = process.env.PLUGIN_DIR;

/** Write a plugin directory and return the DB record the loader takes. */
async function writePlugin(opts: {
  serverSource?: string;
  serverFile?: string;
  capabilities?: Capability[];
  laila?: string;
  settings?: Record<string, unknown>;
}) {
  const root = path.join(dir, PID);
  await fs.mkdir(path.join(root, 'server'), { recursive: true });
  await fs.mkdir(path.join(root, 'client'), { recursive: true });
  await fs.writeFile(path.join(root, 'client', 'plugin.js'), 'export const Block = () => null;');

  const manifest: Record<string, unknown> = {
    id: PID,
    name: 'Integration Plugin',
    version: '1.0.0',
    apiVersion: PLUGIN_API_VERSION,
    client: { entry: 'client/plugin.js' },
    extends: [
      { point: 'lecture.block', id: 'demo', label: 'Demo', component: 'Block' },
    ],
    capabilities: opts.capabilities ?? [],
    ...(opts.laila ? { laila: opts.laila } : {}),
  };

  if (opts.serverSource) {
    const file = opts.serverFile ?? 'server/index.cjs';
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), opts.serverSource);
    manifest.server = { entry: file };
  }

  await fs.writeFile(path.join(root, 'laila-plugin.json'), JSON.stringify(manifest));
  return {
    id: PID,
    manifest: JSON.stringify(manifest),
    settings: opts.settings ? JSON.stringify(opts.settings) : null,
  };
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'laila-plugins-'));
  process.env.PLUGIN_DIR = dir;
  await pluginRegistry.clear();
  pluginEvents.reset();
});

afterEach(async () => {
  await pluginRegistry.clear();
  await fs.rm(dir, { recursive: true, force: true });
  if (originalPluginDir === undefined) delete process.env.PLUGIN_DIR;
  else process.env.PLUGIN_DIR = originalPluginDir;
});

describe('pluginPath', () => {
  it('builds a path inside the plugin directory', () => {
    expect(pluginPath(PID, 'client/plugin.js')).toBe(path.join(dir, PID, 'client/plugin.js'));
  });

  it('refuses an invalid id rather than touching the filesystem', () => {
    expect(() => pluginPath('../../etc')).toThrow(/invalid plugin id/i);
    expect(() => pluginPath('nodots')).toThrow(/invalid plugin id/i);
  });

  it('refuses a sub-path that escapes', () => {
    expect(() => pluginPath(PID, '../../../etc/passwd')).toThrow(/escapes/);
  });
});

describe('loading a real CommonJS plugin', () => {
  it('runs register() and exposes what it registered', async () => {
    const record = await writePlugin({
      capabilities: ['http', 'events', 'jobs'],
      serverSource: `
        exports.register = (api) => {
          const router = api.router();
          router.get('/ping', (req, res) => res.json({ pong: true, plugin: api.id }));
          api.on('course.deleted', (payload) => {
            globalThis.__integrationSawCourse = payload.courseId;
          });
          api.schedule('housekeeping', 60000, () => {});
          globalThis.__integrationRegistered = api.version;
        };
        exports.deactivate = () => { globalThis.__integrationDeactivated = true; };
      `,
    });

    const loaded = await loadPlugin(record, { hostVersion: '3.16.0' });

    expect(loaded.status).toBe('active');
    expect((globalThis as Record<string, unknown>).__integrationRegistered).toBe('1.0.0');
    // A real Express router, mounted and callable.
    expect(loaded.registration.router).toBeTruthy();
    expect(loaded.registration.jobs).toHaveLength(1);
    expect(loaded.registration.jobs[0].name).toBe('housekeeping');

    // The hook it registered is live on the shared bus.
    await pluginEvents.emit('course.deleted', { courseId: 99 });
    expect((globalThis as Record<string, unknown>).__integrationSawCourse).toBe(99);

    // And the registry can find its extension by the key a content row stores.
    expect(pluginRegistry.extension(`plugin:${PID}:demo`)?.label).toBe('Demo');
    expect(pluginRegistry.routers()).toHaveLength(1);
  });

  it('tears everything down on remove, including the plugin deactivate hook', async () => {
    const record = await writePlugin({
      capabilities: ['events', 'jobs'],
      serverSource: `
        exports.register = (api) => {
          api.on('course.deleted', () => { globalThis.__integrationCount = (globalThis.__integrationCount || 0) + 1; });
          api.schedule('j', 60000, () => {});
        };
        exports.deactivate = () => { globalThis.__integrationDeactivated = true; };
      `,
    });
    (globalThis as Record<string, unknown>).__integrationCount = 0;
    (globalThis as Record<string, unknown>).__integrationDeactivated = false;

    await loadPlugin(record, { hostVersion: '3.16.0' });
    await pluginEvents.emit('course.deleted', { courseId: 1 });
    expect((globalThis as Record<string, unknown>).__integrationCount).toBe(1);

    await pluginRegistry.remove(PID);

    expect((globalThis as Record<string, unknown>).__integrationDeactivated).toBe(true);
    await pluginEvents.emit('course.deleted', { courseId: 2 });
    expect((globalThis as Record<string, unknown>).__integrationCount).toBe(1);
    expect(pluginRegistry.routers()).toHaveLength(0);
  });

  it('accepts register() on a default export', async () => {
    const record = await writePlugin({
      serverSource: `module.exports = { default: { register: () => { globalThis.__integrationDefault = true; } } };`,
    });
    await loadPlugin(record, { hostVersion: '3.16.0' });
    expect((globalThis as Record<string, unknown>).__integrationDefault).toBe(true);
  });

  it('loads a client-only plugin with no server half', async () => {
    const record = await writePlugin({});
    const loaded = await loadPlugin(record, { hostVersion: '3.16.0' });
    expect(loaded.status).toBe('active');
    expect(loaded.registration.router).toBeNull();
  });
});

describe('loading a real ES module plugin', () => {
  // The host compiles to CommonJS, so a real ESM entry can only be reached
  // through the non-downlevelled dynamic import in loader.ts. If TypeScript
  // ever rewrites that back into require(), this test fails with
  // ERR_REQUIRE_ESM — which is exactly the regression worth catching.
  it('falls back to dynamic import for an .mjs entry', async () => {
    const record = await writePlugin({
      serverFile: 'server/index.mjs',
      serverSource: `export const register = (api) => { globalThis.__integrationEsm = api.id; };`,
    });
    await loadPlugin(record, { hostVersion: '3.16.0' });
    expect((globalThis as Record<string, unknown>).__integrationEsm).toBe(PID);
  });
});

describe('load failures', () => {
  it('reports a server entry that exports no register()', async () => {
    const record = await writePlugin({ serverSource: `exports.somethingElse = 1;` });
    await expect(loadPlugin(record, { hostVersion: '3.16.0' })).rejects.toThrow(
      /exports no register/,
    );
  });

  it('propagates an error thrown inside register()', async () => {
    const record = await writePlugin({
      serverSource: `exports.register = () => { throw new Error('plugin blew up'); };`,
    });
    await expect(loadPlugin(record, { hostVersion: '3.16.0' })).rejects.toThrow('plugin blew up');
  });

  it('marks a version-incompatible plugin as incompatible, not merely broken', async () => {
    const record = await writePlugin({ laila: '>=9.0.0' });
    await expect(loadPlugin(record, { hostVersion: '3.16.0' })).rejects.toMatchObject({
      incompatible: true,
    });
  });

  it('loads when the host satisfies the declared range', async () => {
    const record = await writePlugin({ laila: '>=3.16.0 <4.0.0' });
    await expect(loadPlugin(record, { hostVersion: '3.16.0' })).resolves.toBeTruthy();
  });

  it('reports a missing directory', async () => {
    const record = await writePlugin({});
    await fs.rm(path.join(dir, PID), { recursive: true, force: true });
    await expect(loadPlugin(record, { hostVersion: '3.16.0' })).rejects.toThrow(/directory is missing/);
  });

  // The stored manifest is the consent record: a bundle edited on disk after
  // install must not be able to grant itself a capability.
  it('uses the stored manifest, not the one on disk', async () => {
    const record = await writePlugin({ capabilities: [] });
    const onDisk = path.join(dir, PID, 'laila-plugin.json');
    const tampered = JSON.parse(await fs.readFile(onDisk, 'utf8'));
    tampered.capabilities = ['db', 'network'];
    tampered.network = ['https://exfil.example.com'];
    await fs.writeFile(onDisk, JSON.stringify(tampered));

    const loaded = await loadPlugin(record, { hostVersion: '3.16.0' });
    expect(loaded.manifest.capabilities ?? []).toEqual([]);
    // And the capability is genuinely refused at the API, not just absent.
    expect(() => loaded.api.db.table('x')).toThrow(/did not declare/);
  });

  it('survives settings that are not valid JSON', async () => {
    const record = { ...(await writePlugin({})), settings: '{not json' };
    const loaded = await loadPlugin(record, { hostVersion: '3.16.0' });
    expect(loaded.status).toBe('active');
    expect(loaded.api.settings()).toEqual({});
  });
});

describe('importServerEntry', () => {
  it('throws a readable error for a missing file', async () => {
    await expect(importServerEntry(path.join(dir, 'nope.cjs'))).rejects.toThrow();
  });

  it('surfaces a syntax error in the plugin rather than swallowing it', async () => {
    const file = path.join(dir, 'broken.cjs');
    await fs.writeFile(file, 'this is not ( valid javascript');
    await expect(importServerEntry(file)).rejects.toThrow();
  });
});

describe('PluginLoadError', () => {
  it('carries the plugin id and the incompatible flag', () => {
    const err = new PluginLoadError('a.b', 'nope', true);
    expect(err.pluginId).toBe('a.b');
    expect(err.incompatible).toBe(true);
    expect(err.name).toBe('PluginLoadError');
  });
});

describe('boot resilience', () => {
  // The deploy ordering that makes this matter: code ships to production
  // before an operator applies the migration, so at that moment the plugin
  // tables do not exist. LAILA must come up anyway — an unhandled rejection
  // here would terminate the process under Node's default policy.
  it('comes up with no plugins when the plugin table is missing', async () => {
    vi.mocked(prisma.plugin.findMany).mockRejectedValueOnce(
      Object.assign(new Error('The table `public.plugins` does not exist'), { code: 'P2021' }),
    );

    const result = await loadAllPlugins('3.16.0');

    expect(result).toEqual({ loaded: [], failed: [] });
    expect(pluginRegistry.all()).toEqual([]);
  });

  it('does not reject when recording a plugin failure also fails', async () => {
    const record = await writePlugin({ serverSource: 'exports.somethingElse = 1;' });
    vi.mocked(prisma.plugin.findMany).mockResolvedValueOnce([record] as never);
    vi.mocked(prisma.plugin.update).mockRejectedValue(new Error('column last_error missing'));

    const result = await loadAllPlugins('3.16.0');

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].id).toBe(PID);
  });
});
