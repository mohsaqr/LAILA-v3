/**
 * The content key a plugin-provided extension carries: `plugin:<id>:<ext>`.
 *
 * Mirrors `extensionKey` / `parseExtensionKey` in
 * `server/src/plugins/manifest.ts`. Kept in its own tiny module so a renderer
 * can ask "is this type a plugin's?" without importing the registry, the
 * loader, or anything that pulls React in — the TipTap schema and a couple of
 * plain helpers need it too.
 *
 * The decisive property, covered by tests on both sides: every built-in type
 * (`text`, `video`, `quiz`, …) parses as **not** a plugin, so adding this
 * system changed the path of exactly zero existing rows.
 */

export interface ParsedPluginKey {
  pluginId: string;
  extensionId: string;
}

export const pluginKey = (pluginId: string, extensionId: string): string =>
  `plugin:${pluginId}:${extensionId}`;

/** Returns null for anything that is not a plugin extension key. */
export const parsePluginKey = (key: string | null | undefined): ParsedPluginKey | null => {
  if (!key) return null;
  const parts = key.split(':');
  if (parts.length !== 3 || parts[0] !== 'plugin') return null;
  if (!parts[1] || !parts[2]) return null;
  return { pluginId: parts[1], extensionId: parts[2] };
};
