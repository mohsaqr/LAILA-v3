/**
 * Fetching plugin bundles and registering what they export.
 *
 * The bundle is an ES module served from **LAILA's own origin**
 * (`/api/plugins/<id>/assets/...`), which is the detail that makes the whole
 * no-iframe design work: `script-src 'self'` already permits it, so a plugin
 * ships real UI without widening the instance's CSP by a single origin.
 *
 * `import()` is used directly rather than injecting a `<script>` tag, because
 * a module's exports are what we need and a tag would only give us side
 * effects on a global. The `/* @vite-ignore *\/` comment stops Vite from
 * trying to resolve a runtime-computed URL at build time.
 */

import { apiClient } from '../api/client';
import { installPluginHost } from './host';
import { pluginRegistry, type ExtensionPoint, type PluginSettingField } from './registry';
import type { ComponentType } from 'react';
import type { PluginComponentProps } from './registry';

/** One entry of `GET /api/plugins/client/manifest`. */
interface ClientManifestEntry {
  id: string;
  name: string;
  version: string;
  entry: string;
  styles: string[];
  extensions: {
    point: ExtensionPoint;
    id: string;
    key: string;
    label: string;
    description?: string;
    icon?: string;
    component: string;
    editor?: string;
    path?: string;
    settings: PluginSettingField[];
  }[];
}

export interface PluginLoadReport {
  loaded: string[];
  failed: { id: string; error: string }[];
}

/** Bundles already imported, so a re-run does not re-fetch or re-register. */
const importedBundles = new Map<string, Record<string, unknown>>();
/** Stylesheet URLs already added, for the same reason. */
const injectedStyles = new Set<string>();

let hostInstalled = false;

/**
 * Add a plugin's stylesheet.
 *
 * Left in the document when a plugin is disabled: removing it mid-session
 * would unstyle any of its components still mounted, and the next full page
 * load is where the cleanup naturally happens. A plugin's CSS is namespaced by
 * convention, not enforcement — the same trust model as its JavaScript.
 */
function injectStyle(href: string): void {
  if (injectedStyles.has(href)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.lailaPlugin = 'true';
  document.head.appendChild(link);
  injectedStyles.add(href);
}

/**
 * Import one plugin's bundle and register its extensions.
 *
 * @throws {Error} when the bundle fails to import, or names a component it
 *   does not export — both are packaging faults the admin needs to see, not
 *   silent no-ops that leave a lesson with a blank space where a block was.
 */
async function loadOne(entry: ClientManifestEntry): Promise<void> {
  let mod = importedBundles.get(entry.id);
  if (!mod) {
    mod = (await import(/* @vite-ignore */ entry.entry)) as Record<string, unknown>;
    importedBundles.set(entry.id, mod);
  }
  entry.styles.forEach(injectStyle);

  const missing: string[] = [];
  for (const ext of entry.extensions) {
    const Component = mod[ext.component] as ComponentType<PluginComponentProps> | undefined;
    if (typeof Component !== 'function') {
      missing.push(ext.component);
      continue;
    }
    const Editor = ext.editor
      ? (mod[ext.editor] as ComponentType<PluginComponentProps> | undefined)
      : undefined;
    if (ext.editor && typeof Editor !== 'function') {
      missing.push(ext.editor);
      continue;
    }

    pluginRegistry.register({
      pluginId: entry.id,
      pluginName: entry.name,
      point: ext.point,
      key: ext.key,
      id: ext.id,
      label: ext.label,
      description: ext.description,
      icon: ext.icon,
      path: ext.path,
      settings: ext.settings ?? [],
      Component,
      Editor,
    });
  }

  if (missing.length) {
    throw new Error(
      `bundle does not export ${missing.map((m) => `"${m}"`).join(', ')} — ` +
        `check the component names in laila-plugin.json`,
    );
  }
}

/**
 * Load every active plugin's client half.
 *
 * One plugin's failure never stops the others: a broken bundle costs its own
 * blocks and nothing else, exactly as a failed server-side load costs only
 * that plugin. The report is returned so the caller can log or surface it.
 *
 * Safe to call more than once; already-imported bundles are reused.
 */
export async function loadClientPlugins(): Promise<PluginLoadReport> {
  const report: PluginLoadReport = { loaded: [], failed: [] };

  // The shared-library registry must exist before any bundle is imported: a
  // plugin's very first statement may read from it.
  if (!hostInstalled) {
    installPluginHost();
    hostInstalled = true;
  }

  let entries: ClientManifestEntry[];
  try {
    const res = await apiClient.get('/plugins/client/manifest');
    entries = (res.data?.data?.plugins ?? []) as ClientManifestEntry[];
  } catch (err) {
    // No plugins is the overwhelmingly common case and an unreachable manifest
    // must never stop the app rendering. Report and carry on.
    return {
      loaded: [],
      failed: [{ id: '(manifest)', error: err instanceof Error ? err.message : String(err) }],
    };
  }

  await Promise.all(
    entries.map(async (entry) => {
      try {
        await loadOne(entry);
        report.loaded.push(entry.id);
      } catch (err) {
        report.failed.push({
          id: entry.id,
          error: err instanceof Error ? err.message : String(err),
        });
        // A half-registered plugin is worse than an absent one: drop whatever
        // did register so a lesson never renders one of its blocks and not
        // another.
        pluginRegistry.unregisterPlugin(entry.id);
      }
    }),
  );

  if (report.failed.length && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn('[laila] some plugins failed to load', report.failed);
  }

  return report;
}

/** Test seam: forget every imported bundle and registration. */
export function resetClientPlugins(): void {
  importedBundles.clear();
  injectedStyles.clear();
  pluginRegistry.clear();
  hostInstalled = false;
}
