/**
 * Subscribe to the plugin registry from React.
 *
 * `useSyncExternalStore` rather than `useState` + an effect, because plugins
 * finish loading *after* the tree has mounted: a component that read the
 * registry once would show an empty block picker until the next navigation.
 * This is exactly the tearing problem the hook exists for.
 */

import { useSyncExternalStore, useMemo } from 'react';
import { pluginRegistry, type ExtensionPoint, type LoadedExtension } from './registry';

/**
 * Every loaded extension at a point, re-rendering when plugins load or unload.
 *
 * @param point which extension point to list
 * @returns the extensions, sorted by label
 */
export function usePluginExtensions(point: ExtensionPoint): LoadedExtension[] {
  // The store's snapshot is a version number, not the list: returning a fresh
  // array from getSnapshot would fail Object.is on every call and loop.
  const version = useSyncExternalStore(
    pluginRegistry.subscribe,
    pluginRegistry.getSnapshot,
    // Server snapshot — the SPA never SSRs, but the hook requires it and a
    // missing one throws during any future prerender.
    pluginRegistry.getSnapshot,
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => pluginRegistry.at(point), [point, version]);
}

/** One extension by key, or undefined when its plugin is not loaded. */
export function usePluginExtension(key: string | null | undefined): LoadedExtension | undefined {
  const version = useSyncExternalStore(
    pluginRegistry.subscribe,
    pluginRegistry.getSnapshot,
    pluginRegistry.getSnapshot,
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (key ? pluginRegistry.get(key) : undefined), [key, version]);
}
