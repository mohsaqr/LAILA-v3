/**
 * The `api` object a plugin's `register(api)` receives.
 *
 * Everything a plugin is *supported* in doing goes through here. Three
 * properties shape the design:
 *
 *   1. **Bound, not passed.** The plugin id is closed over, never an argument.
 *      There is no call a plugin can make to read another plugin's store rows,
 *      write another plugin's tables, or mount a route outside its own prefix.
 *   2. **Capability-gated.** Touching a subsystem the manifest did not declare
 *      throws {@link CapabilityError} immediately, with the manifest line to
 *      add. The failure is loud and at first use, not a mysterious empty
 *      result later.
 *   3. **Ids in, plain objects out.** No Prisma model, no Express `app`, no
 *      raw `prisma` client crosses this boundary. Handing those out would
 *      freeze internal shapes into the plugin contract forever.
 *
 * None of this is a sandbox — see the security note in `manifest.ts`. It is
 * the difference between a plugin that keeps working across LAILA upgrades and
 * one that breaks the first time a service is refactored.
 */

import express, { Router } from 'express';
import prisma from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { llmService } from '../services/llm.service.js';
import { activityLogService, type ActivityVerb, type ObjectType } from '../services/activityLog.service.js';
import type { PluginManifest, Capability } from './manifest.js';
import { capabilitySet } from './manifest.js';
import {
  pluginEvents,
  type PluginEventMap,
  type PluginEventName,
  type PluginFilterMap,
  type PluginFilterName,
} from './events.js';
import {
  createStoreApi,
  createDataApi,
  type PluginStoreApi,
  type PluginDataApi,
} from './store.js';
import { tableName, dialect, assertPrefixed, type SqlDialect } from './db.js';

export class CapabilityError extends Error {
  readonly capability: Capability;
  readonly pluginId: string;
  constructor(pluginId: string, capability: Capability) {
    super(
      `Plugin "${pluginId}" used a capability it did not declare: "${capability}". ` +
        `Add it to "capabilities" in laila-plugin.json.`,
    );
    this.name = 'CapabilityError';
    this.capability = capability;
    this.pluginId = pluginId;
  }
}

/** A scheduled job a plugin registered. */
export interface PluginJob {
  name: string;
  intervalMs: number;
  handler: () => void | Promise<void>;
  timer?: NodeJS.Timeout;
}

/** Everything a plugin registered, kept so disabling it can undo all of it. */
export interface PluginRegistration {
  router: Router | null;
  jobs: PluginJob[];
  /** Unsubscribe functions from every `on`/`filter` call. */
  teardown: (() => void)[];
  /** The plugin's own `deactivate()`, if it exported one. */
  deactivate?: () => void | Promise<void>;
}

export interface PluginHostApi {
  /** This plugin's id and version, so log lines and rows can be attributed. */
  readonly id: string;
  readonly version: string;
  /** The running LAILA version. */
  readonly hostVersion: string;
  /** A pino child logger tagged with the plugin id. */
  readonly log: {
    info: (obj: unknown, msg?: string) => void;
    warn: (obj: unknown, msg?: string) => void;
    error: (obj: unknown, msg?: string) => void;
    debug: (obj: unknown, msg?: string) => void;
  };

  /** Instance settings, as configured by an admin. Requires nothing. */
  settings<T = Record<string, unknown>>(): T;

  /** JSON key-value storage. Requires `store`. */
  readonly store: PluginStoreApi;
  /** Per-user extension data. Requires `store`. */
  readonly data: PluginDataApi;

  /** Raw SQL against the plugin's own tables. Requires `db`. */
  readonly db: {
    readonly dialect: SqlDialect;
    /** The real, prefixed name of one of this plugin's logical tables. */
    table(logical: string): string;
    /** Parameterised SELECT. Placeholders are `$1`/`?` per dialect. */
    query<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]>;
    /** Parameterised INSERT/UPDATE/DELETE. Returns rows affected. */
    execute(sql: string, ...params: unknown[]): Promise<number>;
  };

  /** Lifecycle hooks. Requires `events`. */
  on<N extends PluginEventName>(
    name: N,
    handler: (payload: PluginEventMap[N]) => void | Promise<void>,
    priority?: number,
  ): void;
  filter<N extends PluginFilterName>(
    name: N,
    handler: (
      value: PluginFilterMap[N][0],
      context: PluginFilterMap[N][1],
    ) => PluginFilterMap[N][0] | Promise<PluginFilterMap[N][0]>,
    priority?: number,
  ): void;

  /**
   * An Express router mounted at `/api/plugins/<id>`. Requires `http`.
   * Called more than once, it returns the same router.
   */
  router(): Router;

  /**
   * Ask the configured LLM providers. Requires `llm`.
   *
   * Flattened from the provider-shaped response on purpose: a plugin should
   * not have to know that `choices[0].message.content` is where the answer
   * lives, nor break when that changes.
   */
  llm(request: {
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    content: string;
    model: string;
    finishReason: string | null;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }>;

  /** Append to the learning activity log. Requires `activity-log`. */
  logActivity(input: {
    userId: number;
    verb: ActivityVerb;
    objectType: ObjectType;
    objectId?: number;
    objectTitle?: string;
    courseId?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  /** Read a user. Requires `users:read`. */
  getUser(userId: number): Promise<{
    id: number;
    fullname: string;
    email: string;
    isInstructor: boolean;
    isAdmin: boolean;
  } | null>;

  /** Who is enrolled in a course. Requires `users:read`. */
  getEnrolled(courseId: number): Promise<{ id: number; fullname: string; email: string }[]>;

  /** Read the course design tree. Requires `course:read`. */
  getCourse(courseId: number): Promise<{
    id: number;
    title: string;
    slug: string;
    modules: { id: number; title: string; lectures: { id: number; title: string }[] }[];
  } | null>;

  /** Run something on an interval. Requires `jobs`. */
  schedule(name: string, intervalMs: number, handler: () => void | Promise<void>): void;

  /** Outbound HTTP, restricted to the manifest's `network` origins. Requires `network`. */
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

/** Shortest interval a plugin job may ask for, so a typo cannot spin a core. */
export const MIN_JOB_INTERVAL_MS = 10_000;

/**
 * A provider message's content is `string | LLMContentPart[]` — the array form
 * is how multimodal replies arrive. `api.llm()` promises a string, so the parts
 * are flattened here rather than cast: a plugin that did `content.trim()` on a
 * silently-cast array would fail at runtime with a type error TypeScript had
 * been told to ignore.
 *
 * Non-text parts (images) have no string form and are dropped; a plugin that
 * needs them should not be using this convenience wrapper.
 */
export function flattenContent(
  content: string | { type: string; text?: string }[] | undefined,
): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
}

/**
 * Build the host API for one plugin.
 *
 * @param manifest the validated manifest — capabilities are read from it
 * @param hostVersion the running LAILA version
 * @param settings the admin-configured instance settings
 * @returns the api handed to `register()` and the registration record that
 *   `loader.ts` keeps in order to undo everything on disable
 */
export function createHostApi(
  manifest: PluginManifest,
  hostVersion: string,
  settings: Record<string, unknown>,
): { api: PluginHostApi; registration: PluginRegistration } {
  const pluginId = manifest.id;
  const caps = capabilitySet(manifest);
  const log = createLogger(`plugin:${pluginId}`);

  const registration: PluginRegistration = { router: null, jobs: [], teardown: [] };

  const require = (cap: Capability): void => {
    if (!caps.has(cap)) throw new CapabilityError(pluginId, cap);
  };

  // Built lazily so a plugin that never touches storage never constructs it,
  // and so the capability check fires on first use rather than at load.
  let storeApi: PluginStoreApi | null = null;
  let dataApi: PluginDataApi | null = null;

  const allowedOrigins = new Set((manifest.network ?? []).map((u) => new URL(u).origin));

  const api: PluginHostApi = {
    id: pluginId,
    version: manifest.version,
    hostVersion,
    log: {
      info: (obj, msg) => log.info(obj as object, msg),
      warn: (obj, msg) => log.warn(obj as object, msg),
      error: (obj, msg) => log.error(obj as object, msg),
      debug: (obj, msg) => log.debug(obj as object, msg),
    },

    settings<T>() {
      return settings as T;
    },

    get store() {
      require('store');
      storeApi ??= createStoreApi(pluginId);
      return storeApi;
    },

    get data() {
      require('store');
      dataApi ??= createDataApi(pluginId);
      return dataApi;
    },

    db: {
      get dialect() {
        require('db');
        return dialect();
      },
      table(logical: string) {
        require('db');
        return tableName(pluginId, logical);
      },
      async query<T>(sql: string, ...params: unknown[]): Promise<T[]> {
        require('db');
        // The same prefix guard the migration runner applies. A SELECT cannot
        // damage anything, but a plugin reading `users` directly would build a
        // dependency on a schema it does not own and cannot be warned about.
        assertPrefixed(pluginId, sql);
        return prisma.$queryRawUnsafe<T[]>(sql, ...params);
      },
      async execute(sql: string, ...params: unknown[]): Promise<number> {
        require('db');
        assertPrefixed(pluginId, sql);
        return prisma.$executeRawUnsafe(sql, ...params);
      },
    },

    on(name, handler, priority) {
      require('events');
      registration.teardown.push(pluginEvents.on(pluginId, name, handler, priority));
    },

    filter(name, handler, priority) {
      require('events');
      registration.teardown.push(pluginEvents.addFilter(pluginId, name, handler, priority));
    },

    router() {
      require('http');
      if (!registration.router) {
        const r = express.Router();
        registration.router = r;
      }
      return registration.router;
    },

    async llm(request) {
      require('llm');
      const response = await llmService.chat({
        messages: request.messages,
        model: request.model,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      });
      const choice = response.choices?.[0];
      return {
        content: flattenContent(choice?.message?.content),
        model: response.model ?? request.model ?? 'unknown',
        finishReason: choice?.finishReason ?? null,
        usage: response.usage,
      };
    },

    async logActivity(input) {
      require('activity-log');
      await activityLogService.logActivity({
        userId: input.userId,
        verb: input.verb,
        objectType: input.objectType,
        objectId: input.objectId,
        objectTitle: input.objectTitle,
        courseId: input.courseId,
        // Stamped so an admin reading the log can tell plugin-generated rows
        // from the ones LAILA's own client produced.
        metadata: { ...(input.metadata ?? {}), pluginId },
      } as Parameters<typeof activityLogService.logActivity>[0]);
    },

    async getUser(userId) {
      require('users:read');
      return prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, fullname: true, email: true, isInstructor: true, isAdmin: true },
      });
    },

    async getEnrolled(courseId) {
      require('users:read');
      const rows = await prisma.enrollment.findMany({
        where: { courseId },
        select: { user: { select: { id: true, fullname: true, email: true } } },
      });
      return rows.map((r) => r.user);
    },

    async getCourse(courseId) {
      require('course:read');
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: {
          id: true,
          title: true,
          slug: true,
          modules: {
            orderBy: { orderIndex: 'asc' },
            select: {
              id: true,
              title: true,
              lectures: { orderBy: { orderIndex: 'asc' }, select: { id: true, title: true } },
            },
          },
        },
      });
      return course;
    },

    schedule(name, intervalMs, handler) {
      require('jobs');
      if (!Number.isFinite(intervalMs) || intervalMs < MIN_JOB_INTERVAL_MS) {
        throw new Error(
          `Job "${name}" interval must be at least ${MIN_JOB_INTERVAL_MS}ms, got ${intervalMs}`,
        );
      }
      const job: PluginJob = { name, intervalMs, handler };
      // A throwing job must not take the process down: an unhandled rejection
      // in a timer callback is fatal under Node's default policy.
      job.timer = setInterval(() => {
        void (async () => {
          try {
            await handler();
          } catch (err) {
            log.error({ job: name, err }, 'plugin job failed');
          }
        })();
      }, intervalMs);
      // Never hold the process open for a plugin's polling loop.
      job.timer.unref?.();
      registration.jobs.push(job);
    },

    async fetch(url, init) {
      require('network');
      let origin: string;
      try {
        origin = new URL(url).origin;
      } catch {
        throw new Error(`Plugin "${pluginId}" passed an invalid URL to fetch: "${url}"`);
      }
      if (!allowedOrigins.has(origin)) {
        throw new Error(
          `Plugin "${pluginId}" may not call "${origin}". ` +
            `Add it to "network" in laila-plugin.json (declared: ${[...allowedOrigins].join(', ') || 'none'}).`,
        );
      }
      return globalThis.fetch(url, init);
    },
  };

  return { api, registration };
}

/** Stop every job a plugin scheduled and drop every hook it registered. */
export function teardownRegistration(pluginId: string, reg: PluginRegistration): void {
  reg.jobs.forEach((j) => {
    if (j.timer) clearInterval(j.timer);
  });
  reg.jobs.length = 0;
  reg.teardown.forEach((off) => {
    try {
      off();
    } catch {
      // An unsubscribe that throws must not stop the remaining ones from
      // running, or disabling a plugin would leave half its hooks attached.
    }
  });
  reg.teardown.length = 0;
  reg.router = null;
  pluginEvents.removeAll(pluginId);
}
