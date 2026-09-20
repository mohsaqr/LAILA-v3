/**
 * The shared-dependency registry a plugin bundle imports from.
 *
 * ## Why this exists
 *
 * A plugin's UI has to be **real React inside LAILA's own component tree** —
 * able to use hooks, context, the theme, and to render into the page rather
 * than a boxed-off frame. That rules out an iframe, and it rules out the
 * plugin bundling its own copy of React: two React instances in one page means
 * hooks throw ("invalid hook call"), context reads `undefined`, and portals
 * land in the wrong tree.
 *
 * So the host publishes exactly one copy of each shared library here, and a
 * plugin bundle is built with those libraries marked *external* and rewritten
 * to read from this object. The SDK's build step does that rewriting, so a
 * plugin author writes an ordinary `import { useState } from 'react'`.
 *
 * ## Why it is a global rather than an import
 *
 * The plugin bundle is fetched at runtime from a URL the host computes, so it
 * cannot resolve a bare specifier against LAILA's node_modules — there is no
 * bundler involved at that point. A global is the only channel a dynamically
 * imported ES module and its host reliably share.
 *
 * ## Versioning
 *
 * `apiVersion` here must match the server's `PLUGIN_API_VERSION`. A plugin
 * built against a different major is refused by the server at install, so by
 * the time a bundle reaches this file the versions already agree; the field is
 * carried anyway so a plugin can feature-detect at runtime.
 */

import * as React from 'react';
import * as ReactJSXRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';

/** Must match `PLUGIN_API_VERSION` in `server/src/plugins/manifest.ts`. */
export const CLIENT_API_VERSION = 1;

/** The global the SDK's import shim reads. */
export const HOST_GLOBAL = '__LAILA_PLUGIN_HOST__';

export interface PluginHostGlobal {
  apiVersion: number;
  /** Shared libraries, keyed by the bare specifier a plugin would import. */
  modules: Record<string, unknown>;
}

/**
 * Publish the host's shared libraries.
 *
 * Called once, before any plugin bundle is imported. Idempotent: calling it
 * again replaces the registry with an identical one rather than throwing, so a
 * hot reload in dev does not wedge the page.
 *
 * The list is deliberately short. Every entry here becomes a compatibility
 * promise — a library published today cannot be removed without breaking every
 * plugin that imported it — so it covers what a UI plugin genuinely cannot
 * supply for itself (React and its runtime, which must be singletons) and
 * stops there. A plugin wanting a charting library bundles its own.
 */
export function installPluginHost(): PluginHostGlobal {
  const host: PluginHostGlobal = {
    apiVersion: CLIENT_API_VERSION,
    modules: {
      // React must be a singleton: a second copy breaks hooks and context.
      react: React,
      'react/jsx-runtime': ReactJSXRuntime,
      // The automatic JSX transform emits jsx-dev-runtime in development.
      // Pointing it at the production runtime keeps a plugin built in dev mode
      // from failing to resolve; the two have compatible signatures.
      'react/jsx-dev-runtime': ReactJSXRuntime,
      'react-dom': ReactDOM,
    },
  };
  (window as unknown as Record<string, unknown>)[HOST_GLOBAL] = host;
  return host;
}

/**
 * Resolve a shared module for a plugin.
 *
 * Exported for the SDK shim and for tests. Throws rather than returning
 * undefined: a plugin importing something the host does not publish must fail
 * loudly at load, not with `undefined is not a function` three clicks later.
 */
export function resolveHostModule(specifier: string): unknown {
  const host = (window as unknown as Record<string, PluginHostGlobal | undefined>)[HOST_GLOBAL];
  if (!host) {
    throw new Error(
      `LAILA plugin host is not installed; installPluginHost() must run before a plugin loads`,
    );
  }
  const mod = host.modules[specifier];
  if (!mod) {
    throw new Error(
      `LAILA does not share "${specifier}" with plugins. ` +
        `Bundle it into your plugin instead of importing it from the host.`,
    );
  }
  return mod;
}
