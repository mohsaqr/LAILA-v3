/**
 * Pulling a plugin's server half into this process.
 *
 * ## Module format
 *
 * LAILA's server compiles to **CommonJS** (`tsc` with no `"type": "module"`),
 * so a plugin entry is loaded with `require()`. A plugin shipping real ESM is
 * still supported through a dynamic `import()` that TypeScript must not
 * downlevel — hence `esmImport` below. Node's own `require(esm)` support only
 * landed in 22.12 and `package.json` declares `>=20.6`, so it cannot be relied
 * on yet.
 *
 * ## The require cache
 *
 * Disabling a plugin stops its jobs, detaches its hooks and unmounts its
 * router, but **cannot unload its code**: Node has no `require.unload`, and
 * deleting the cache entry only makes the *next* `require` re-read the file
 * while every closure already handed out keeps the old module alive. So:
 *
 *   - disable/enable inside one process is honest about being *deactivation*,
 *     not unloading, and the plugin's own `deactivate()` is called so it can
 *     release what the host cannot see;
 *   - **upgrading** a plugin's code requires a restart, and the install path
 *     says so in its response rather than pretending the new version is live.
 *
 * Pretending otherwise is how a plugin system ends up serving two versions of
 * the same module at once.
 */

import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
import prisma from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { parseManifest, type PluginManifest } from './manifest.js';
import { satisfies } from './version.js';
import { createHostApi, type PluginHostApi } from './hostApi.js';
import { pluginRegistry, type LoadedPlugin } from './registry.js';
import { runMigrations } from './db.js';

const log = createLogger('plugins:loader');

/**
 * Where installed plugins live. Outside `dist/` deliberately: `tsc` has
 * `rootDir: ./src`, so anything under it would be compiled as host source, and
 * a plugin directory inside the build output would be wiped by a clean build.
 */
export function pluginDir(): string {
  return process.env.PLUGIN_DIR || path.resolve(process.cwd(), 'plugins');
}

export const pluginPath = (id: string, ...rest: string[]): string => {
  // The id is validated by the manifest schema (no slashes, no dots as path
  // segments), but this builds a filesystem path from data that arrived in a
  // zip, so it is re-checked here rather than trusted twice removed.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/.test(id)) {
    throw new Error(`Refusing to build a path for an invalid plugin id: "${id}"`);
  }
  const base = path.join(pluginDir(), id);
  const full = path.join(base, ...rest);
  // Defence in depth: a `rest` containing `..` must not escape the plugin dir.
  if (!full.startsWith(base + path.sep) && full !== base) {
    throw new Error(`Path escapes the plugin directory: ${rest.join('/')}`);
  }
  return full;
};

/**
 * A dynamic `import()` TypeScript will not rewrite into `require()`.
 *
 * With `module: NodeNext` emitting CJS, a literal `import(x)` becomes a
 * `require`-based helper, which throws `ERR_REQUIRE_ESM` on a real ES module.
 * Constructing the function keeps a genuine import expression in the output.
 */
const esmImport = new Function('specifier', 'return import(specifier)') as (
  s: string,
) => Promise<Record<string, unknown>>;

const nodeRequire = createRequire(__filename);

/** What a plugin's server entry may export. */
export interface PluginServerModule {
  register?: (api: PluginHostApi) => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
  default?: {
    register?: (api: PluginHostApi) => void | Promise<void>;
    deactivate?: () => void | Promise<void>;
  };
}

/**
 * Load a plugin's server entry, CommonJS first and ESM as a fallback.
 *
 * @throws {Error} when the file is missing or neither format loads
 */
export async function importServerEntry(file: string): Promise<PluginServerModule> {
  try {
    return nodeRequire(file) as PluginServerModule;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ERR_REQUIRE_ESM') throw err;
    // A real ES module: load it the only way a CJS host can.
    const ns = await esmImport(`file://${file}`);
    return ns as PluginServerModule;
  }
}

/** Pick `register`/`deactivate` off either a named or a default export. */
function entryPoints(mod: PluginServerModule): {
  register?: (api: PluginHostApi) => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
} {
  return {
    register: mod.register ?? mod.default?.register,
    deactivate: mod.deactivate ?? mod.default?.deactivate,
  };
}

export interface LoadOptions {
  /** The running LAILA version, checked against the manifest's `laila` range. */
  hostVersion: string;
  /** Skip migrations — used when the caller has just run them at install. */
  skipMigrations?: boolean;
}

export class PluginLoadError extends Error {
  readonly pluginId: string;
  readonly incompatible: boolean;
  constructor(pluginId: string, message: string, incompatible = false) {
    super(message);
    this.name = 'PluginLoadError';
    this.pluginId = pluginId;
    this.incompatible = incompatible;
  }
}

/**
 * Load one plugin from its database row and its directory on disk.
 *
 * The manifest is re-parsed from the **stored** copy rather than re-read from
 * disk, so a bundle edited after install cannot quietly gain a capability the
 * admin never consented to. The files on disk still supply the code — this is
 * a consent record, not an integrity guarantee.
 *
 * @returns the registry entry, already added to the registry
 * @throws {PluginLoadError} with `incompatible` set when the host version left
 *   the manifest's declared range
 */
export async function loadPlugin(
  record: { id: string; manifest: string; settings: string | null },
  opts: LoadOptions,
): Promise<LoadedPlugin> {
  const dir = pluginPath(record.id);

  let manifest: PluginManifest;
  try {
    manifest = parseManifest(JSON.parse(record.manifest));
  } catch (e) {
    throw new PluginLoadError(
      record.id,
      `stored manifest is unreadable: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (manifest.laila && !satisfies(opts.hostVersion, manifest.laila)) {
    throw new PluginLoadError(
      record.id,
      `needs LAILA ${manifest.laila}, this instance is ${opts.hostVersion}`,
      true,
    );
  }

  try {
    await fs.access(dir);
  } catch {
    throw new PluginLoadError(record.id, `directory is missing: ${dir}`);
  }

  let settings: Record<string, unknown> = {};
  if (record.settings) {
    try {
      settings = JSON.parse(record.settings) as Record<string, unknown>;
    } catch {
      // Losing settings is recoverable and the admin can re-enter them; refusing
      // to load the plugin over it is not proportionate. It is logged loudly.
      log.error({ plugin: record.id }, 'plugin settings are not valid JSON; loading with defaults');
    }
  }

  if (manifest.migrations && !opts.skipMigrations) {
    const result = await runMigrations(record.id, pluginPath(record.id, manifest.migrations));
    if (result.applied.length) {
      log.info({ plugin: record.id, applied: result.applied }, 'plugin migrations applied at load');
    }
  }

  const { api, registration } = createHostApi(manifest, opts.hostVersion, settings);

  if (manifest.server) {
    const entry = pluginPath(record.id, manifest.server.entry);
    const mod = await importServerEntry(entry);
    const { register, deactivate } = entryPoints(mod);
    if (!register) {
      throw new PluginLoadError(
        record.id,
        `server entry "${manifest.server.entry}" exports no register() function`,
      );
    }
    registration.deactivate = deactivate;
    await register(api);
  }

  const loaded: LoadedPlugin = {
    manifest,
    dir,
    api,
    registration,
    status: 'active',
    loadedAt: new Date(),
    errorCount: 0,
  };
  pluginRegistry.add(loaded);
  log.info(
    {
      plugin: record.id,
      version: manifest.version,
      extensions: manifest.extends?.length ?? 0,
      hasServer: !!manifest.server,
      routes: !!registration.router,
    },
    'plugin loaded',
  );
  return loaded;
}

export interface LoadAllResult {
  loaded: string[];
  failed: { id: string; error: string }[];
}

/**
 * Load every enabled plugin at boot.
 *
 * One plugin's failure never stops the others, and never stops the server: a
 * broken plugin is recorded with `status: 'error'` and its message surfaced in
 * the admin UI. A boot that refuses to come up because of a third-party plugin
 * is a worse outcome than a boot with one feature missing.
 */
export async function loadAllPlugins(hostVersion: string): Promise<LoadAllResult> {
  const result: LoadAllResult = { loaded: [], failed: [] };

  // The plugin tables may not exist yet: a deploy ships code before an
  // operator applies the migration, and LAILA must come up regardless. A
  // missing table means "no plugins", not "no LAILA" — every other feature is
  // unaffected, and the next boot after the migration picks them up.
  let records: { id: string; manifest: string; settings: string | null }[];
  try {
    records = await prisma.plugin.findMany({
      where: { enabled: true },
      orderBy: { id: 'asc' },
    });
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'plugin tables are unavailable (has the migration been applied?); continuing without plugins',
    );
    return result;
  }

  for (const record of records) {
    try {
      await loadPlugin(record, { hostVersion });
      result.loaded.push(record.id);
      await prisma.plugin
        .update({ where: { id: record.id }, data: { status: 'active', lastError: null } })
        .catch((e) => log.warn({ plugin: record.id, err: String(e) }, 'could not record plugin status'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof PluginLoadError && err.incompatible ? 'incompatible' : 'error';
      result.failed.push({ id: record.id, error: message });
      log.error({ plugin: record.id, err: message, status }, 'plugin failed to load');
      try {
        await prisma.plugin.update({
          where: { id: record.id },
          data: {
            status,
            lastError: message,
            lastErrorAt: new Date(),
            errorCount: { increment: 1 },
          },
        });
      } catch (writeErr) {
        // Bookkeeping about a failure must never become a second failure.
        log.error({ plugin: record.id, err: String(writeErr) }, 'could not record plugin error');
      }
    }
  }

  log.info(
    { loaded: result.loaded.length, failed: result.failed.length },
    'plugin loading complete',
  );
  return result;
}

/**
 * Deactivate a plugin in the running process.
 *
 * Honest about its limit: hooks detach, jobs stop and the router goes, but the
 * module stays resident (see the note at the top of this file).
 */
export async function unloadPlugin(id: string): Promise<void> {
  await pluginRegistry.remove(id);
}
