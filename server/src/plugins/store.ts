/**
 * The two storage surfaces a plugin gets without writing SQL:
 *
 *   - **`store`** — a JSON key-value store for configuration and derived state,
 *     scoped `global` / `course` / `user` / `section` / `lab`.
 *   - **`data`** — one row per (user, extension instance): what a student did,
 *     what they scored, whether they finished. This is the table the gradebook,
 *     the export and the analytics dashboard can all read, which is why it is a
 *     real model with real columns rather than another JSON blob.
 *
 * **Every method here takes the plugin id from the closure, never from the
 * caller.** A plugin is handed an object already bound to its own id, so there
 * is no argument it could pass to read another plugin's rows. That is a genuine
 * boundary for the supported API — unlike the capability list, which is consent
 * rather than containment (see `manifest.ts`).
 */

import prisma from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('plugins:store');

/** Scopes a store key can live in. `scopeId` counts in whatever this names. */
export const STORE_SCOPES = ['global', 'course', 'user', 'section', 'lab'] as const;
export type StoreScope = (typeof STORE_SCOPES)[number];

/**
 * A single value's serialised ceiling. Generous for configuration, far below
 * what would turn a row read into a memory problem. A plugin with more than
 * this to store wants its own table (`db` capability), and the error says so.
 */
export const MAX_VALUE_BYTES = 256 * 1024;

export class PluginStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginStoreError';
  }
}

export interface StoreLocation {
  scope?: StoreScope;
  scopeId?: number;
}

/** Normalise a location, defaulting to the global scope. */
function where(loc: StoreLocation | undefined): { scope: StoreScope; scopeId: number } {
  const scope = loc?.scope ?? 'global';
  if (!STORE_SCOPES.includes(scope)) {
    throw new PluginStoreError(`Unknown store scope "${scope}"`);
  }
  // The column defaults to 0 rather than NULL so the unique index works: in
  // PostgreSQL two NULLs are distinct, which would let duplicate global keys
  // through the constraint that is supposed to prevent exactly that.
  const scopeId = scope === 'global' ? 0 : loc?.scopeId ?? 0;
  if (scope !== 'global' && !Number.isInteger(scopeId)) {
    throw new PluginStoreError(`Scope "${scope}" needs an integer scopeId`);
  }
  return { scope, scopeId };
}

function serialise(pluginId: string, key: string, value: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch (e) {
    throw new PluginStoreError(
      `Value for "${key}" is not JSON-serialisable: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  // JSON.stringify(undefined) is undefined, not a string — storing it would
  // write the literal "undefined" and fail to parse on the way back out.
  if (json === undefined) {
    throw new PluginStoreError(`Value for "${key}" is undefined; use null to store an empty value`);
  }
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > MAX_VALUE_BYTES) {
    throw new PluginStoreError(
      `Value for "${key}" is ${bytes} bytes, over the ${MAX_VALUE_BYTES}-byte store limit. ` +
        `Plugin "${pluginId}" should declare the "db" capability and use its own table.`,
    );
  }
  return json;
}

function deserialise<T>(pluginId: string, key: string, raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Returning null here would present corruption as absence, and the plugin
    // would helpfully write a fresh default over whatever survived.
    log.error({ plugin: pluginId, key }, 'plugin store value is not valid JSON');
    throw new PluginStoreError(`Stored value for "${key}" is corrupt (not valid JSON)`);
  }
}

export interface PluginStoreApi {
  get<T = unknown>(key: string, loc?: StoreLocation): Promise<T | null>;
  set(key: string, value: unknown, loc?: StoreLocation): Promise<void>;
  delete(key: string, loc?: StoreLocation): Promise<boolean>;
  /** Every key/value in a scope, optionally narrowed by key prefix. */
  list<T = unknown>(loc?: StoreLocation & { prefix?: string }): Promise<Record<string, T>>;
  /** Remove every key in a scope. Returns how many rows went. */
  clear(loc?: StoreLocation): Promise<number>;
}

/** Build the store API bound to one plugin. */
export function createStoreApi(pluginId: string): PluginStoreApi {
  return {
    async get<T>(key: string, loc?: StoreLocation): Promise<T | null> {
      const { scope, scopeId } = where(loc);
      const row = await prisma.pluginStore.findUnique({
        where: { pluginId_scope_scopeId_key: { pluginId, scope, scopeId, key } },
      });
      return row ? deserialise<T>(pluginId, key, row.value) : null;
    },

    async set(key: string, value: unknown, loc?: StoreLocation): Promise<void> {
      const { scope, scopeId } = where(loc);
      const json = serialise(pluginId, key, value);
      await prisma.pluginStore.upsert({
        where: { pluginId_scope_scopeId_key: { pluginId, scope, scopeId, key } },
        create: { pluginId, scope, scopeId, key, value: json },
        update: { value: json },
      });
    },

    async delete(key: string, loc?: StoreLocation): Promise<boolean> {
      const { scope, scopeId } = where(loc);
      const { count } = await prisma.pluginStore.deleteMany({
        where: { pluginId, scope, scopeId, key },
      });
      return count > 0;
    },

    async list<T>(loc?: StoreLocation & { prefix?: string }): Promise<Record<string, T>> {
      const { scope, scopeId } = where(loc);
      const rows = await prisma.pluginStore.findMany({
        where: {
          pluginId,
          scope,
          scopeId,
          ...(loc?.prefix ? { key: { startsWith: loc.prefix } } : {}),
        },
      });
      const out: Record<string, T> = {};
      rows.forEach((r) => {
        out[r.key] = deserialise<T>(pluginId, r.key, r.value);
      });
      return out;
    },

    async clear(loc?: StoreLocation): Promise<number> {
      const { scope, scopeId } = where(loc);
      const { count } = await prisma.pluginStore.deleteMany({ where: { pluginId, scope, scopeId } });
      return count;
    },
  };
}

// ---------------------------------------------------------------------------
// Per-user extension data
// ---------------------------------------------------------------------------

export interface PluginDataRecord {
  userId: number;
  courseId: number | null;
  extensionId: string;
  instanceKey: string;
  data: Record<string, unknown>;
  score: number | null;
  maxScore: number | null;
  completed: boolean;
  updatedAt: Date;
}

export interface PluginDataWrite {
  data?: Record<string, unknown>;
  score?: number | null;
  maxScore?: number | null;
  completed?: boolean;
  courseId?: number | null;
  extensionId: string;
}

export interface PluginDataApi {
  get(userId: number, instanceKey: string): Promise<PluginDataRecord | null>;
  set(userId: number, instanceKey: string, write: PluginDataWrite): Promise<PluginDataRecord>;
  /** Every user's row for one instance — a teacher's view of one block. */
  forInstance(instanceKey: string): Promise<PluginDataRecord[]>;
  /** Every row in a course, optionally for one extension. */
  forCourse(courseId: number, extensionId?: string): Promise<PluginDataRecord[]>;
  delete(userId: number, instanceKey: string): Promise<boolean>;
}

type PluginDataRow = {
  userId: number;
  courseId: number | null;
  extensionId: string;
  instanceKey: string;
  data: string;
  score: number | null;
  maxScore: number | null;
  completed: boolean;
  updatedAt: Date;
};

const toRecord = (pluginId: string, row: PluginDataRow): PluginDataRecord => ({
  userId: row.userId,
  courseId: row.courseId,
  extensionId: row.extensionId,
  instanceKey: row.instanceKey,
  data: deserialise<Record<string, unknown>>(pluginId, row.instanceKey, row.data),
  score: row.score,
  maxScore: row.maxScore,
  completed: row.completed,
  updatedAt: row.updatedAt,
});

/**
 * An instance key names *which* placement of an extension a row belongs to:
 * `section:91`, `lab:12`, `tool:reports`, `course:7`. One opaque string rather
 * than a nullable column per placement kind, so the uniqueness constraint is a
 * single index that PostgreSQL and SQLite agree on.
 */
export const instanceKey = (kind: 'section' | 'lab' | 'tool' | 'course', id: number | string): string =>
  `${kind}:${id}`;

export function createDataApi(pluginId: string): PluginDataApi {
  return {
    async get(userId, key) {
      const row = await prisma.pluginData.findUnique({
        where: { pluginId_userId_instanceKey: { pluginId, userId, instanceKey: key } },
      });
      return row ? toRecord(pluginId, row) : null;
    },

    async set(userId, key, write) {
      if (write.score != null && !Number.isFinite(write.score)) {
        throw new PluginStoreError(`score must be a finite number, got ${write.score}`);
      }
      const json = write.data === undefined ? undefined : serialise(pluginId, key, write.data);
      const row = await prisma.pluginData.upsert({
        where: { pluginId_userId_instanceKey: { pluginId, userId, instanceKey: key } },
        create: {
          pluginId,
          userId,
          instanceKey: key,
          extensionId: write.extensionId,
          courseId: write.courseId ?? null,
          data: json ?? '{}',
          score: write.score ?? null,
          maxScore: write.maxScore ?? null,
          completed: write.completed ?? false,
        },
        update: {
          // Only overwrite what the caller actually passed: a plugin marking a
          // block complete must not blank the answers it stored a moment ago.
          ...(json !== undefined ? { data: json } : {}),
          ...(write.score !== undefined ? { score: write.score } : {}),
          ...(write.maxScore !== undefined ? { maxScore: write.maxScore } : {}),
          ...(write.completed !== undefined ? { completed: write.completed } : {}),
          ...(write.courseId !== undefined ? { courseId: write.courseId } : {}),
        },
      });
      return toRecord(pluginId, row);
    },

    async forInstance(key) {
      const rows = await prisma.pluginData.findMany({
        where: { pluginId, instanceKey: key },
        orderBy: { updatedAt: 'desc' },
      });
      return rows.map((r) => toRecord(pluginId, r));
    },

    async forCourse(courseId, extensionId) {
      const rows = await prisma.pluginData.findMany({
        where: { pluginId, courseId, ...(extensionId ? { extensionId } : {}) },
        orderBy: { updatedAt: 'desc' },
      });
      return rows.map((r) => toRecord(pluginId, r));
    },

    async delete(userId, key) {
      const { count } = await prisma.pluginData.deleteMany({
        where: { pluginId, userId, instanceKey: key },
      });
      return count > 0;
    },
  };
}
