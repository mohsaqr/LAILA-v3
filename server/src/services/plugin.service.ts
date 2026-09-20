/**
 * Installing, enabling, upgrading and removing plugins.
 *
 * The bundle is a zip that arrived over HTTP. Everything in it is hostile
 * input until proven otherwise, so unpacking enforces four limits that a
 * malicious or merely broken archive would otherwise cross:
 *
 *   - **path traversal** — an entry named `../../server/.env` writes wherever
 *     the Node process can. Every entry is resolved and checked to land inside
 *     the target directory.
 *   - **zip bombs** — a 2 MB archive can expand to gigabytes. Both the total
 *     uncompressed size and the per-file size are capped, measured while
 *     unpacking rather than trusted from the central directory.
 *   - **entry count** — hundreds of thousands of tiny files exhaust inodes and
 *     stall the event loop.
 *   - **manifest first** — nothing is written to the plugins directory until
 *     the manifest has parsed and validated. A bundle that is not a plugin
 *     never touches disk.
 *
 * Installation is staged: the bundle unpacks into a temporary directory, and
 * only a fully validated result is moved into place. A failure part-way leaves
 * the previous version untouched.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import JSZip from 'jszip';
import prisma from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { AppError } from '../middleware/error.middleware.js';
import {
  parseManifest,
  ManifestError,
  capabilitySet,
  type PluginManifest,
  type Capability,
} from '../plugins/manifest.js';
import { satisfies } from '../plugins/version.js';
import { pluginDir, pluginPath, loadPlugin, unloadPlugin } from '../plugins/loader.js';
import { pluginRegistry } from '../plugins/registry.js';
import { runMigrations, dropPluginTables } from '../plugins/db.js';
import { pluginEvents } from '../plugins/events.js';
import { compareVersions } from '../plugins/version.js';

const log = createLogger('plugins:install');

export const MANIFEST_FILE = 'laila-plugin.json';
/** Total uncompressed bytes a bundle may expand to. */
export const MAX_UNPACKED_BYTES = 64 * 1024 * 1024;
/** Largest single file inside a bundle. */
export const MAX_FILE_BYTES = 16 * 1024 * 1024;
/** Most entries a bundle may contain. */
export const MAX_ENTRIES = 2_000;

export interface InstallResult {
  manifest: PluginManifest;
  /** True when this replaced an existing installation. */
  upgraded: boolean;
  previousVersion: string | null;
  migrationsApplied: string[];
  /**
   * True when the code changed but the old module is still resident, so the
   * new server half only takes effect after a restart. Client-only plugins and
   * first installs are live immediately.
   */
  restartRequired: boolean;
  warnings: string[];
}

/** A zip entry that survived validation. */
interface SafeEntry {
  /** Path relative to the plugin root, always forward-slashed. */
  rel: string;
  content: Buffer;
}

export class PluginInstallError extends AppError {
  readonly issues: string[];
  constructor(message: string, issues: string[] = [], status = 400) {
    super(message, status);
    Object.defineProperty(this, 'name', { value: 'PluginInstallError', configurable: true });
    this.issues = issues;
  }
}

/**
 * Resolve a zip entry name against a root, refusing anything that escapes.
 *
 * Rejects absolute paths, drive letters, `..` segments and backslashes before
 * resolution, then re-checks the resolved path — belt and braces, because each
 * check alone has known bypasses on some platform.
 */
export function safeEntryPath(root: string, entryName: string): string {
  const name = entryName.replace(/\\/g, '/');
  if (!name || name.startsWith('/') || /^[A-Za-z]:/.test(name)) {
    throw new PluginInstallError(`Bundle entry has an absolute path: "${entryName}"`);
  }
  if (name.split('/').includes('..')) {
    throw new PluginInstallError(`Bundle entry escapes its directory: "${entryName}"`);
  }
  if (name.includes('\0')) {
    throw new PluginInstallError(`Bundle entry name contains a NUL byte`);
  }
  const resolved = path.resolve(root, name);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new PluginInstallError(`Bundle entry escapes its directory: "${entryName}"`);
  }
  return resolved;
}

/**
 * Read every file out of the archive, enforcing the limits above.
 *
 * @returns the entries, and the manifest's raw JSON text
 */
export async function readBundle(buffer: Buffer): Promise<{
  entries: SafeEntry[];
  manifestJson: string;
}> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    throw new PluginInstallError(
      `Not a readable zip archive: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const files = Object.values(zip.files).filter((f) => !f.dir);
  if (files.length > MAX_ENTRIES) {
    throw new PluginInstallError(
      `Bundle has ${files.length} entries, over the ${MAX_ENTRIES} limit`,
    );
  }

  // A bundle may be wrapped in a single top-level directory (the shape `git
  // archive` and most zip tools produce). Detect and strip it, so both layouts
  // install identically instead of one failing with "no manifest".
  const names = files.map((f) => f.name.replace(/\\/g, '/'));
  const topLevels = new Set(names.map((n) => n.split('/')[0]));
  const hasRootManifest = names.includes(MANIFEST_FILE);
  const strip =
    !hasRootManifest && topLevels.size === 1 ? `${[...topLevels][0]}/` : '';

  const entries: SafeEntry[] = [];
  let total = 0;

  for (const file of files) {
    const raw = file.name.replace(/\\/g, '/');
    const rel = strip && raw.startsWith(strip) ? raw.slice(strip.length) : raw;
    if (!rel) continue;

    // Validate the name against a dummy root before spending memory on it.
    safeEntryPath(os.tmpdir(), rel);

    const content = await file.async('nodebuffer');
    if (content.length > MAX_FILE_BYTES) {
      throw new PluginInstallError(
        `"${rel}" is ${content.length} bytes, over the ${MAX_FILE_BYTES}-byte per-file limit`,
      );
    }
    total += content.length;
    if (total > MAX_UNPACKED_BYTES) {
      throw new PluginInstallError(
        `Bundle expands past the ${MAX_UNPACKED_BYTES}-byte limit — refusing to continue`,
      );
    }
    entries.push({ rel, content });
  }

  const manifestEntry = entries.find((e) => e.rel === MANIFEST_FILE);
  if (!manifestEntry) {
    throw new PluginInstallError(`Bundle has no ${MANIFEST_FILE} at its root`);
  }

  return { entries, manifestJson: manifestEntry.content.toString('utf8') };
}

/** Check that every path the manifest points at is actually in the bundle. */
function assertReferencedFilesExist(manifest: PluginManifest, entries: SafeEntry[]): void {
  const present = new Set(entries.map((e) => e.rel));
  const missing: string[] = [];
  const check = (p: string | undefined) => {
    if (p && !present.has(p)) missing.push(p);
  };
  check(manifest.server?.entry);
  check(manifest.client?.entry);
  manifest.client?.styles?.forEach(check);

  // Directories are present implicitly, via the files inside them.
  const dirUsed = (d: string | undefined) =>
    d && ![...present].some((p) => p.startsWith(`${d}/`)) ? d : null;
  const missingDirs = [dirUsed(manifest.migrations), dirUsed(manifest.locales)].filter(
    (d): d is string => !!d,
  );

  if (missing.length || missingDirs.length) {
    throw new PluginInstallError(
      'The manifest points at files that are not in the bundle',
      [...missing, ...missingDirs.map((d) => `${d}/ (empty or missing)`)],
    );
  }
}

async function writeEntries(root: string, entries: SafeEntry[]): Promise<void> {
  for (const entry of entries) {
    const dest = safeEntryPath(root, entry.rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, entry.content);
  }
}

export interface InstallOptions {
  /** The running LAILA version, checked against the manifest's `laila` range. */
  hostVersion: string;
  /** Who is installing; recorded for the audit trail. */
  userId: number;
  /** Enable immediately after install. */
  enable?: boolean;
  /**
   * Accept a downgrade or a re-install of the same version. Off by default:
   * re-running an install with an older bundle is nearly always a mistake.
   */
  allowDowngrade?: boolean;
}

class PluginService {
  /**
   * Install or upgrade a plugin from a bundle.
   *
   * @param buffer the uploaded `.laila-plugin.zip`
   * @throws {PluginInstallError} on any validation failure; nothing is written
   */
  async install(buffer: Buffer, opts: InstallOptions): Promise<InstallResult> {
    const bundleHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const { entries, manifestJson } = await readBundle(buffer);

    let manifest: PluginManifest;
    try {
      manifest = parseManifest(JSON.parse(manifestJson));
    } catch (e) {
      if (e instanceof ManifestError) throw new PluginInstallError(e.message, e.issues);
      throw new PluginInstallError(
        `${MANIFEST_FILE} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    if (manifest.laila && !satisfies(opts.hostVersion, manifest.laila)) {
      throw new PluginInstallError(
        `"${manifest.name}" needs LAILA ${manifest.laila}; this instance is ${opts.hostVersion}`,
      );
    }

    assertReferencedFilesExist(manifest, entries);

    const existing = await prisma.plugin.findUnique({ where: { id: manifest.id } });
    const warnings: string[] = [];

    if (existing && !opts.allowDowngrade) {
      const order = compareVersions(manifest.version, existing.version);
      if (order < 0) {
        throw new PluginInstallError(
          `Bundle is version ${manifest.version}, older than the installed ${existing.version}. ` +
            `Pass allowDowngrade to install it anyway.`,
        );
      }
      if (order === 0 && existing.bundleHash !== bundleHash) {
        warnings.push(
          `Version ${manifest.version} was already installed from a different bundle — ` +
            `the contents changed without the version changing.`,
        );
      }
    }

    // Stage into a temp directory so a failure cannot leave a half-written
    // plugin where the loader would find it at the next boot.
    const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'laila-plugin-'));
    const target = pluginPath(manifest.id);
    try {
      await writeEntries(staging, entries);
      await fs.mkdir(pluginDir(), { recursive: true });

      // Deactivate before the files move: the old jobs must not run against
      // the new version's tables mid-swap.
      if (pluginRegistry.has(manifest.id)) {
        await unloadPlugin(manifest.id);
      }

      // Replace atomically enough: move the old aside, move the new in, then
      // drop the old. A crash between the two renames leaves `.old` behind,
      // which is recoverable by hand; a partial copy would not be.
      const backup = `${target}.replacing-${Date.now()}`;
      const hadPrevious = await fs
        .access(target)
        .then(() => true)
        .catch(() => false);
      if (hadPrevious) await fs.rename(target, backup);
      try {
        await fs.rename(staging, target);
      } catch (err) {
        if (hadPrevious) await fs.rename(backup, target);
        throw err;
      }
      if (hadPrevious) await fs.rm(backup, { recursive: true, force: true });

      const capabilities = JSON.stringify([...capabilitySet(manifest)]);
      const enable = opts.enable ?? false;

      await prisma.plugin.upsert({
        where: { id: manifest.id },
        create: {
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          apiVersion: manifest.apiVersion,
          description: manifest.description ?? null,
          authorName: manifest.author?.name ?? null,
          homepage: manifest.homepage ?? null,
          manifest: JSON.stringify(manifest),
          capabilities,
          enabled: enable,
          status: enable ? 'active' : 'disabled',
          bundleHash,
          installedById: opts.userId,
        },
        update: {
          name: manifest.name,
          version: manifest.version,
          apiVersion: manifest.apiVersion,
          description: manifest.description ?? null,
          authorName: manifest.author?.name ?? null,
          homepage: manifest.homepage ?? null,
          manifest: JSON.stringify(manifest),
          capabilities,
          bundleHash,
          // An upgrade clears the previous failure: the new code deserves a
          // fresh verdict rather than inheriting the old one's error state.
          status: existing?.enabled ? 'active' : 'disabled',
          lastError: null,
          lastErrorAt: null,
          errorCount: 0,
        },
      });

      let migrationsApplied: string[] = [];
      if (manifest.migrations) {
        const result = await runMigrations(
          manifest.id,
          pluginPath(manifest.id, manifest.migrations),
        );
        migrationsApplied = result.applied;
      }

      // A first install can load immediately. An upgrade cannot: Node keeps the
      // previous module resident, so `require` would hand back the old code.
      const restartRequired = !!existing && !!manifest.server;
      if ((enable || existing?.enabled) && !restartRequired) {
        const record = await prisma.plugin.findUniqueOrThrow({ where: { id: manifest.id } });
        await loadPlugin(record, { hostVersion: opts.hostVersion, skipMigrations: true });
      }
      if (restartRequired) {
        warnings.push(
          'The server half was upgraded. Node keeps the previous module loaded, so restart the ' +
            'server to run the new version.',
        );
      }

      log.info(
        {
          plugin: manifest.id,
          version: manifest.version,
          upgraded: !!existing,
          capabilities: [...capabilitySet(manifest)],
          by: opts.userId,
        },
        'plugin installed',
      );

      return {
        manifest,
        upgraded: !!existing,
        previousVersion: existing?.version ?? null,
        migrationsApplied,
        restartRequired,
        warnings,
      };
    } finally {
      await fs.rm(staging, { recursive: true, force: true });
    }
  }

  /** Every installed plugin, with its live status merged in. */
  async list(): Promise<
    {
      id: string;
      name: string;
      version: string;
      description: string | null;
      authorName: string | null;
      homepage: string | null;
      enabled: boolean;
      status: string;
      capabilities: Capability[];
      extensions: { point: string; id: string; label: string }[];
      lastError: string | null;
      errorCount: number;
      loaded: boolean;
      installedAt: Date;
    }[]
  > {
    const rows = await prisma.plugin.findMany({ orderBy: { name: 'asc' } });
    return rows.map((row) => {
      const live = pluginRegistry.get(row.id);
      let extensions: { point: string; id: string; label: string }[] = [];
      let capabilities: Capability[] = [];
      try {
        const m = JSON.parse(row.manifest) as PluginManifest;
        extensions = (m.extends ?? []).map((e) => ({ point: e.point, id: e.id, label: e.label }));
        capabilities = JSON.parse(row.capabilities) as Capability[];
      } catch {
        // A row whose manifest will not parse still belongs in the list — that
        // is precisely the plugin an admin needs to see and remove.
        extensions = [];
      }
      return {
        id: row.id,
        name: row.name,
        version: row.version,
        description: row.description,
        authorName: row.authorName,
        homepage: row.homepage,
        enabled: row.enabled,
        // The registry is the truth about what is running; the row is what was
        // asked for. Where they disagree, show the running state.
        status: live?.status ?? row.status,
        capabilities,
        extensions,
        lastError: live?.error ?? row.lastError,
        errorCount: live?.errorCount ?? row.errorCount,
        loaded: !!live,
        installedAt: row.installedAt,
      };
    });
  }

  async get(id: string) {
    const row = await prisma.plugin.findUnique({ where: { id } });
    if (!row) throw new AppError('Plugin not found', 404);
    return row;
  }

  /** Enable a plugin and load it into the running process. */
  async enable(id: string, hostVersion: string): Promise<{ warnings: string[] }> {
    const row = await this.get(id);
    const warnings: string[] = [];
    if (row.enabled && pluginRegistry.has(id)) return { warnings };

    await prisma.plugin.update({ where: { id }, data: { enabled: true } });
    try {
      const fresh = await prisma.plugin.findUniqueOrThrow({ where: { id } });
      await loadPlugin(fresh, { hostVersion });
      await prisma.plugin.update({
        where: { id },
        data: { status: 'active', lastError: null, lastErrorAt: null },
      });
      await pluginEvents.emit('plugin.enabled', { pluginId: id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.plugin.update({
        where: { id },
        data: {
          enabled: false,
          status: 'error',
          lastError: message,
          lastErrorAt: new Date(),
          errorCount: { increment: 1 },
        },
      });
      throw new AppError(`Plugin "${id}" failed to load: ${message}`, 400);
    }
    return { warnings };
  }

  /** Disable a plugin: hooks off, jobs stopped, router unmounted. */
  async disable(id: string): Promise<void> {
    await this.get(id);
    await unloadPlugin(id);
    await prisma.plugin.update({
      where: { id },
      data: { enabled: false, status: 'disabled' },
    });
    await pluginEvents.emit('plugin.disabled', { pluginId: id });
    log.info({ plugin: id }, 'plugin disabled');
  }

  /**
   * Remove a plugin.
   *
   * @param dropData when true, also drops the plugin's own SQL tables. Off by
   *   default: uninstalling to upgrade is far more common than uninstalling to
   *   forget, and dropping by default makes that mistake unrecoverable. The
   *   rows in `plugin_store` and `plugin_data` cascade either way, so the flag
   *   governs only the tables the plugin's migrations created.
   */
  async uninstall(id: string, dropData = false): Promise<{ droppedTables: string[] }> {
    await this.get(id);
    await unloadPlugin(id);

    const droppedTables = dropData ? await dropPluginTables(id) : [];

    // Cascades take plugin_store, plugin_data and plugin_migrations with it.
    await prisma.plugin.delete({ where: { id } });

    const dir = pluginPath(id);
    await fs.rm(dir, { recursive: true, force: true });

    log.warn({ plugin: id, dropData, droppedTables }, 'plugin uninstalled');
    return { droppedTables };
  }

  /** Replace a plugin's instance settings. */
  async updateSettings(id: string, settings: Record<string, unknown>): Promise<void> {
    const row = await this.get(id);
    const manifest = JSON.parse(row.manifest) as PluginManifest;
    const known = new Set((manifest.settings ?? []).map((s) => s.key));
    const unknown = Object.keys(settings).filter((k) => !known.has(k));
    if (unknown.length) {
      throw new AppError(
        `Plugin "${id}" has no setting named ${unknown.map((u) => `"${u}"`).join(', ')}`,
        400,
      );
    }
    await prisma.plugin.update({
      where: { id },
      data: { settings: JSON.stringify(settings) },
    });
    // The live api reads settings from the object captured at load, so a change
    // needs a reload to take effect. Disable/enable is the cheap way to do it
    // without the require-cache problem, since settings are data, not code.
    if (pluginRegistry.has(id)) {
      await unloadPlugin(id);
      const fresh = await prisma.plugin.findUniqueOrThrow({ where: { id } });
      if (fresh.enabled) {
        await loadPlugin(fresh, {
          hostVersion: process.env.npm_package_version || '0.0.0',
          skipMigrations: true,
        });
      }
    }
  }
}

export const pluginService = new PluginService();
