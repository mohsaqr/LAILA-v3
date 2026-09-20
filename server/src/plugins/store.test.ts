import { describe, it, expect, beforeEach, vi } from 'vitest';
import prisma from '../utils/prisma.js';
import {
  createStoreApi,
  createDataApi,
  instanceKey,
  PluginStoreError,
  MAX_VALUE_BYTES,
} from './store.js';

vi.mock('../utils/logger.js', () => {
  const noop = () => {};
  return { createLogger: () => ({ error: noop, warn: noop, info: noop, debug: noop }) };
});

vi.mock('../utils/prisma.js', () => ({
  default: {
    pluginStore: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    pluginData: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const PID = 'org.example.drag-match';
const store = createStoreApi(PID);
const data = createDataApi(PID);

/**
 * The first argument of a mock's Nth call. Prisma's generated arg types make
 * every field on a delegate's union optional, so reading `.where.x` off one
 * fights strict-null for no benefit here: the assertion below IS the check.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const argOf = (fn: unknown, call = 0): any =>
  (fn as { mock: { calls: unknown[][] } }).mock.calls[call][0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('store scoping', () => {
  it('injects its own plugin id on read', async () => {
    vi.mocked(prisma.pluginStore.findUnique).mockResolvedValue(null as never);
    await store.get('k');
    expect(argOf(prisma.pluginStore.findUnique)).toEqual({
      where: { pluginId_scope_scopeId_key: { pluginId: PID, scope: 'global', scopeId: 0, key: 'k' } },
    });
  });

  // The boundary that matters: there is no argument a plugin could pass to
  // reach another plugin's rows, because the id comes from the closure.
  it('never lets a caller choose the plugin id', async () => {
    vi.mocked(prisma.pluginStore.findUnique).mockResolvedValue(null as never);
    await store.get('k', { scope: 'course', scopeId: 7 } as never);
    expect(argOf(prisma.pluginStore.findUnique).where.pluginId_scope_scopeId_key.pluginId).toBe(
      PID,
    );
  });

  it('forces scopeId 0 for the global scope', async () => {
    vi.mocked(prisma.pluginStore.upsert).mockResolvedValue({} as never);
    await store.set('k', 1, { scope: 'global', scopeId: 99 });
    const call = argOf(prisma.pluginStore.upsert);
    expect(call.create).toMatchObject({ scope: 'global', scopeId: 0 });
  });

  it('carries scopeId for a scoped key', async () => {
    vi.mocked(prisma.pluginStore.upsert).mockResolvedValue({} as never);
    await store.set('k', 1, { scope: 'course', scopeId: 7 });
    expect(argOf(prisma.pluginStore.upsert).create).toMatchObject({
      scope: 'course',
      scopeId: 7,
    });
  });

  it('rejects an unknown scope', async () => {
    await expect(store.get('k', { scope: 'planet' } as never)).rejects.toThrow(/Unknown store scope/);
  });
});

describe('store serialisation', () => {
  it('round-trips a value', async () => {
    vi.mocked(prisma.pluginStore.upsert).mockResolvedValue({} as never);
    await store.set('k', { a: [1, 2], b: null });
    const written = argOf(prisma.pluginStore.upsert).create.value;
    expect(written).toBe('{"a":[1,2],"b":null}');

    vi.mocked(prisma.pluginStore.findUnique).mockResolvedValue({ value: written } as never);
    expect(await store.get('k')).toEqual({ a: [1, 2], b: null });
  });

  it('returns null for a missing key', async () => {
    vi.mocked(prisma.pluginStore.findUnique).mockResolvedValue(null as never);
    expect(await store.get('nope')).toBeNull();
  });

  // Corruption must not look like absence, or the plugin writes a default
  // straight over whatever survived.
  it('throws on a corrupt stored value instead of returning null', async () => {
    vi.mocked(prisma.pluginStore.findUnique).mockResolvedValue({ value: '{not json' } as never);
    await expect(store.get('k')).rejects.toThrow(PluginStoreError);
    await expect(store.get('k')).rejects.toThrow(/corrupt/);
  });

  it('rejects undefined with advice rather than storing "undefined"', async () => {
    await expect(store.set('k', undefined)).rejects.toThrow(/use null/);
  });

  it('stores null happily', async () => {
    vi.mocked(prisma.pluginStore.upsert).mockResolvedValue({} as never);
    await store.set('k', null);
    expect(argOf(prisma.pluginStore.upsert).create.value).toBe('null');
  });

  it('rejects a circular value', async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(store.set('k', circular)).rejects.toThrow(/not JSON-serialisable/);
  });

  it('refuses an oversized value and points at the db capability', async () => {
    const big = { blob: 'x'.repeat(MAX_VALUE_BYTES) };
    await expect(store.set('k', big)).rejects.toThrow(/"db" capability/);
  });

  it('accepts a value just under the limit', async () => {
    vi.mocked(prisma.pluginStore.upsert).mockResolvedValue({} as never);
    await expect(store.set('k', 'x'.repeat(MAX_VALUE_BYTES - 100))).resolves.toBeUndefined();
  });
});

describe('store list and clear', () => {
  it('parses every row and narrows by prefix', async () => {
    vi.mocked(prisma.pluginStore.findMany).mockResolvedValue([
      { key: 'cfg:a', value: '1' },
      { key: 'cfg:b', value: '"two"' },
    ] as never);
    expect(await store.list({ scope: 'course', scopeId: 3, prefix: 'cfg:' })).toEqual({
      'cfg:a': 1,
      'cfg:b': 'two',
    });
    expect(argOf(prisma.pluginStore.findMany).where).toMatchObject({
      pluginId: PID,
      scope: 'course',
      scopeId: 3,
      key: { startsWith: 'cfg:' },
    });
  });

  it('reports what delete and clear removed', async () => {
    vi.mocked(prisma.pluginStore.deleteMany).mockResolvedValue({ count: 0 } as never);
    expect(await store.delete('k')).toBe(false);
    vi.mocked(prisma.pluginStore.deleteMany).mockResolvedValue({ count: 3 } as never);
    expect(await store.delete('k')).toBe(true);
    expect(await store.clear({ scope: 'course', scopeId: 1 })).toBe(3);
  });
});

describe('instanceKey', () => {
  it('formats each placement kind', () => {
    expect(instanceKey('section', 91)).toBe('section:91');
    expect(instanceKey('lab', 12)).toBe('lab:12');
    expect(instanceKey('tool', 'reports')).toBe('tool:reports');
  });
});

describe('data api', () => {
  const row = {
    userId: 5,
    courseId: 7,
    extensionId: 'drag-match',
    instanceKey: 'section:91',
    data: '{"answers":[1,2]}',
    score: 0.8,
    maxScore: 1,
    completed: true,
    updatedAt: new Date('2026-09-20T00:00:00Z'),
  };

  it('reads and parses a row', async () => {
    vi.mocked(prisma.pluginData.findUnique).mockResolvedValue(row as never);
    const got = await data.get(5, 'section:91');
    expect(got?.data).toEqual({ answers: [1, 2] });
    expect(got?.score).toBe(0.8);
  });

  it('scopes reads to its own plugin', async () => {
    vi.mocked(prisma.pluginData.findUnique).mockResolvedValue(null as never);
    await data.get(5, 'section:91');
    expect(argOf(prisma.pluginData.findUnique).where.pluginId_userId_instanceKey.pluginId).toBe(
      PID,
    );
  });

  // A plugin that marks a block complete must not blank the answers it just
  // stored, so only the fields actually passed appear in the update.
  it('updates only the fields the caller passed', async () => {
    vi.mocked(prisma.pluginData.upsert).mockResolvedValue(row as never);
    await data.set(5, 'section:91', { extensionId: 'drag-match', completed: true });
    const call = argOf(prisma.pluginData.upsert);
    expect(call.update).toEqual({ completed: true });
    expect(call.update).not.toHaveProperty('data');
    expect(call.update).not.toHaveProperty('score');
  });

  it('writes every field when all are passed', async () => {
    vi.mocked(prisma.pluginData.upsert).mockResolvedValue(row as never);
    await data.set(5, 'section:91', {
      extensionId: 'drag-match',
      data: { answers: [3] },
      score: 0.5,
      maxScore: 1,
      completed: false,
      courseId: 7,
    });
    expect(argOf(prisma.pluginData.upsert).update).toEqual({
      data: '{"answers":[3]}',
      score: 0.5,
      maxScore: 1,
      completed: false,
      courseId: 7,
    });
  });

  it('allows clearing a score with an explicit null', async () => {
    vi.mocked(prisma.pluginData.upsert).mockResolvedValue(row as never);
    await data.set(5, 'section:91', { extensionId: 'drag-match', score: null });
    expect(argOf(prisma.pluginData.upsert).update).toEqual({ score: null });
  });

  it('rejects a non-finite score before it reaches the gradebook', async () => {
    await expect(
      data.set(5, 'section:91', { extensionId: 'drag-match', score: NaN }),
    ).rejects.toThrow(/finite number/);
    await expect(
      data.set(5, 'section:91', { extensionId: 'drag-match', score: Infinity }),
    ).rejects.toThrow(/finite number/);
  });

  it('lists a course, optionally narrowed to one extension', async () => {
    vi.mocked(prisma.pluginData.findMany).mockResolvedValue([row] as never);
    await data.forCourse(7, 'drag-match');
    expect(argOf(prisma.pluginData.findMany).where).toEqual({
      pluginId: PID,
      courseId: 7,
      extensionId: 'drag-match',
    });
    await data.forCourse(7);
    expect(argOf(prisma.pluginData.findMany, 1).where).toEqual({
      pluginId: PID,
      courseId: 7,
    });
  });
});
