/**
 * The `laila` object handed to every plugin component.
 *
 * Same discipline as the server's host API: the plugin id and the placement
 * are closed over, never arguments, so there is no call a plugin can make to
 * read or write another plugin's data — or another student's. Every write goes
 * to an endpoint that takes the user from the JWT and ignores any userId in
 * the body.
 *
 * Everything returns a plain object. No axios instance, no query client, no
 * store handle crosses this boundary: handing those out would freeze LAILA's
 * internal choices into the plugin contract.
 */

import { apiClient } from '../api/client';

/** Which placement of an extension a component is rendering for. */
export interface PluginInstance {
  kind: 'section' | 'lab' | 'tool' | 'course';
  id: number | string;
}

/** The viewer, as much as a plugin needs to know. */
export interface PluginContext {
  userId: number;
  fullname: string;
  role: 'student' | 'instructor' | 'admin';
  locale: string;
  theme: 'light' | 'dark';
  courseId: number | null;
  instanceKey: string;
}

/** A student's stored state for one placement. */
export interface PluginState {
  data: Record<string, unknown>;
  score: number | null;
  maxScore: number | null;
  completed: boolean;
  updatedAt: string | null;
}

export interface PluginApi {
  readonly pluginId: string;
  readonly extensionId: string;
  readonly context: PluginContext;

  /** Read this student's stored state for this placement. */
  getState(): Promise<PluginState>;
  /**
   * Write this student's state.
   *
   * Partial: fields left out are not touched, so marking a block complete does
   * not blank the answers stored a moment earlier.
   */
  setState(next: Partial<Omit<PluginState, 'updatedAt'>>): Promise<PluginState>;

  /** Read the teacher-authored configuration for this placement. */
  getConfig<T = Record<string, unknown>>(): Promise<T>;
  /** Save the configuration. Instructor-only; the server enforces it. */
  setConfig(config: Record<string, unknown>): Promise<void>;

  /**
   * Call one of the plugin's own server routes, relative to its router — so
   * `call('/report')` reaches what the server half mounted at `/report`.
   */
  call<T = unknown>(
    path: string,
    init?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown },
  ): Promise<T>;

  /** Translate, with the plugin's own locale files merged in. */
  t(key: string, fallback?: string): string;
}

export interface CreatePluginApiOptions {
  pluginId: string;
  extensionId: string;
  context: PluginContext;
  /** Merged translations for the active language, from the plugin's bundle. */
  translations?: Record<string, string>;
}

const instanceKeyOf = (instance: PluginInstance): string => `${instance.kind}:${instance.id}`;

/**
 * Build the API for one component instance.
 *
 * @param opts the plugin, extension and viewer this component belongs to
 * @param instance which placement — becomes the `instanceKey` every read and
 *   write is scoped by
 */
export function createPluginApi(
  opts: CreatePluginApiOptions,
  instance: PluginInstance,
): PluginApi {
  const { pluginId, extensionId, context, translations = {} } = opts;
  const instanceKey = instanceKeyOf(instance);
  const base = `/plugins/${pluginId}`;

  return {
    pluginId,
    extensionId,
    context: { ...context, instanceKey },

    async getState() {
      const res = await apiClient.get(`${base}/state/${extensionId}`, {
        params: { instanceKey },
      });
      const record = res.data?.data;
      // A student who has never touched the block has no row; an empty state
      // is the honest answer, not an error the plugin has to special-case.
      return {
        data: record?.data ?? {},
        score: record?.score ?? null,
        maxScore: record?.maxScore ?? null,
        completed: record?.completed ?? false,
        updatedAt: record?.updatedAt ?? null,
      };
    },

    async setState(next) {
      const res = await apiClient.put(`${base}/state/${extensionId}`, {
        instanceKey,
        courseId: context.courseId,
        ...next,
      });
      const record = res.data?.data;
      return {
        data: record?.data ?? {},
        score: record?.score ?? null,
        maxScore: record?.maxScore ?? null,
        completed: record?.completed ?? false,
        updatedAt: record?.updatedAt ?? null,
      };
    },

    async getConfig<T>() {
      const res = await apiClient.get(`${base}/config/${extensionId}`, {
        params: { instanceKey },
      });
      return (res.data?.data ?? {}) as T;
    },

    async setConfig(config) {
      await apiClient.put(`${base}/config/${extensionId}`, { instanceKey, config });
    },

    async call<T>(
      path: string,
      init?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown },
    ) {
      // A leading slash is what an author will write; normalise rather than
      // producing a double slash that some proxies collapse and others do not.
      const rel = path.startsWith('/') ? path : `/${path}`;
      const method = init?.method ?? 'GET';
      const res = await apiClient.request<T>({
        url: `${base}/api${rel}`,
        method,
        data: init?.body,
      });
      return res.data;
    },

    t(key, fallback) {
      return translations[key] ?? fallback ?? key;
    },
  };
}
