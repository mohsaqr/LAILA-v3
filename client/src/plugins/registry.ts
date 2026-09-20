/**
 * The client-side registry of loaded plugin extensions.
 *
 * Holds, for each extension point, the components a plugin contributed — keyed
 * by `plugin:<pluginId>:<extensionId>`, the same key a `LectureSection.type` or
 * a `CustomLab.labType` carries in the database. That shared key is what lets
 * the plugin system be additive: a renderer looks its type up here only after
 * the built-in switch has failed to match, so every existing section type keeps
 * its original path untouched.
 *
 * A plain module-level store rather than React context, for two reasons: the
 * loader runs before the tree mounts, and non-React code (the TipTap schema,
 * the lab router) needs to read it too.
 */

import type { ComponentType } from 'react';
import type { PluginApi } from './api';

/** Extension points, mirroring `EXTENSION_POINTS` on the server. */
export type ExtensionPoint = 'lecture.block' | 'lab' | 'dashboard.widget' | 'course.tool';

/** One setting field the host renders generically for an extension. */
export interface PluginSettingField {
  key: string;
  label: string;
  help?: string;
  type: 'string' | 'text' | 'number' | 'boolean' | 'select' | 'color' | 'url';
  options?: { value: string; label: string }[];
  default?: string | number | boolean;
  required?: boolean;
  min?: number;
  max?: number;
}

/** The props every plugin component receives. */
export interface PluginComponentProps {
  /** The host API, already bound to this plugin and this placement. */
  laila: PluginApi;
  /** Teacher-authored configuration for this placement. */
  config: Record<string, unknown>;
  /** True in the authoring view, false for a student. */
  editing: boolean;
}

export interface LoadedExtension {
  pluginId: string;
  pluginName: string;
  point: ExtensionPoint;
  /** `plugin:<pluginId>:<extensionId>` */
  key: string;
  id: string;
  label: string;
  description?: string;
  icon?: string;
  path?: string;
  settings: PluginSettingField[];
  /** The student/reader view. */
  Component: ComponentType<PluginComponentProps>;
  /** The authoring view, when the plugin ships one. */
  Editor?: ComponentType<PluginComponentProps>;
}

class ClientPluginRegistry {
  private byKey = new Map<string, LoadedExtension>();
  /** Bumped on every change so React can re-render through a subscription. */
  private version = 0;
  private listeners = new Set<() => void>();

  register(ext: LoadedExtension): void {
    this.byKey.set(ext.key, ext);
    this.emit();
  }

  /** Drop everything a plugin registered — used when it is disabled. */
  unregisterPlugin(pluginId: string): void {
    let changed = false;
    for (const [key, ext] of this.byKey) {
      if (ext.pluginId === pluginId) {
        this.byKey.delete(key);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  get(key: string): LoadedExtension | undefined {
    return this.byKey.get(key);
  }

  /** Every extension at a point, sorted by label for a stable picker order. */
  at(point: ExtensionPoint): LoadedExtension[] {
    return [...this.byKey.values()]
      .filter((e) => e.point === point)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  all(): LoadedExtension[] {
    return [...this.byKey.values()];
  }

  clear(): void {
    this.byKey.clear();
    this.emit();
  }

  // --- useSyncExternalStore plumbing ---------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /**
   * A number, not the map: `useSyncExternalStore` compares snapshots with
   * Object.is, and returning the live map (or a fresh array) would either never
   * change or change on every render and loop forever.
   */
  getSnapshot = (): number => this.version;

  private emit(): void {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }
}

export const pluginRegistry = new ClientPluginRegistry();
