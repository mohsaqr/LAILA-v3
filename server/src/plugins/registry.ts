/**
 * The in-memory record of what is loaded right now.
 *
 * Separate from the `Plugin` table on purpose: the table is what an admin
 * *asked for*, the registry is what the process *actually has*. They diverge
 * whenever a plugin is enabled in the database but failed to load — which is
 * exactly the state an admin needs to see, and which a single source of truth
 * would hide.
 */

import type { Router } from 'express';
import type { PluginManifest, ExtensionPoint } from './manifest.js';
import type { PluginHostApi, PluginRegistration } from './hostApi.js';
import { teardownRegistration } from './hostApi.js';
import { pluginEvents } from './events.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('plugins:registry');

export type PluginStatus = 'active' | 'disabled' | 'error' | 'incompatible';

export interface LoadedPlugin {
  manifest: PluginManifest;
  /** Absolute path of the plugin's directory. */
  dir: string;
  api: PluginHostApi;
  registration: PluginRegistration;
  status: PluginStatus;
  /** Populated when status is 'error' or 'incompatible'. */
  error?: string;
  loadedAt: Date;
  /** Hook failures since load, so a flapping plugin is visible. */
  errorCount: number;
}

/** One extension, flattened with its owning plugin for lookup. */
export interface RegisteredExtension {
  pluginId: string;
  pluginName: string;
  point: ExtensionPoint;
  /** `plugin:<pluginId>:<id>` — what a content row stores. */
  key: string;
  id: string;
  label: string;
  description?: string;
  icon?: string;
  component: string;
  editor?: string;
  path?: string;
  settings?: PluginManifest['settings'];
}

class PluginRegistry {
  private plugins = new Map<string, LoadedPlugin>();

  constructor() {
    // Hook failures are attributed back to the plugin so the admin UI can show
    // "this plugin has failed 12 times since boot" rather than burying it in
    // the log.
    pluginEvents.setErrorReporter((pluginId, hook, error) => {
      const p = this.plugins.get(pluginId);
      if (!p) return;
      p.errorCount += 1;
      p.error = `${hook}: ${error instanceof Error ? error.message : String(error)}`;
    });
  }

  add(plugin: LoadedPlugin): void {
    this.plugins.set(plugin.manifest.id, plugin);
  }

  get(id: string): LoadedPlugin | undefined {
    return this.plugins.get(id);
  }

  all(): LoadedPlugin[] {
    return [...this.plugins.values()];
  }

  active(): LoadedPlugin[] {
    return this.all().filter((p) => p.status === 'active');
  }

  has(id: string): boolean {
    return this.plugins.has(id);
  }

  /**
   * Remove a plugin from the registry, stopping its jobs and detaching its
   * hooks. The module itself stays in Node's require cache — see `loader.ts`
   * on why that is unavoidable and what it means.
   */
  async remove(id: string): Promise<void> {
    const p = this.plugins.get(id);
    if (!p) return;
    if (p.registration.deactivate) {
      try {
        await p.registration.deactivate();
      } catch (err) {
        log.error({ plugin: id, err }, 'plugin deactivate() threw');
      }
    }
    teardownRegistration(id, p.registration);
    this.plugins.delete(id);
    log.info({ plugin: id }, 'plugin unloaded');
  }

  /** Every extension registered at a point, across every active plugin. */
  extensions(point?: ExtensionPoint): RegisteredExtension[] {
    return this.active().flatMap((p) =>
      (p.manifest.extends ?? [])
        .filter((e) => !point || e.point === point)
        .map((e) => ({
          pluginId: p.manifest.id,
          pluginName: p.manifest.name,
          point: e.point,
          key: `plugin:${p.manifest.id}:${e.id}`,
          id: e.id,
          label: e.label,
          description: e.description,
          icon: e.icon,
          component: e.component,
          editor: e.editor,
          path: e.path,
          settings: e.settings,
        })),
    );
  }

  /** Look one extension up by the key a content row stores. */
  extension(key: string): RegisteredExtension | undefined {
    return this.extensions().find((e) => e.key === key);
  }

  /** The routers to mount, in a stable order so route precedence is predictable. */
  routers(): { pluginId: string; router: Router }[] {
    return this.active()
      .filter((p) => p.registration.router)
      .map((p) => ({ pluginId: p.manifest.id, router: p.registration.router! }))
      .sort((a, b) => a.pluginId.localeCompare(b.pluginId));
  }

  /** Record a load failure without evicting what the admin configured. */
  markError(id: string, error: string, status: PluginStatus = 'error'): void {
    const p = this.plugins.get(id);
    if (p) {
      p.status = status;
      p.error = error;
      p.errorCount += 1;
    }
  }

  /** Tests and a full reload. */
  async clear(): Promise<void> {
    await Promise.all(this.all().map((p) => this.remove(p.manifest.id)));
    this.plugins.clear();
  }
}

export const pluginRegistry = new PluginRegistry();
