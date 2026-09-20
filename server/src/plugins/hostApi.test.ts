import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createHostApi,
  teardownRegistration,
  flattenContent,
  CapabilityError,
  MIN_JOB_INTERVAL_MS,
} from './hostApi.js';
import { pluginEvents } from './events.js';
import { tablePrefix } from './db.js';
import { parseManifest, PLUGIN_API_VERSION, type Capability } from './manifest.js';

vi.mock('../utils/logger.js', () => {
  const noop = () => {};
  return { createLogger: () => ({ error: noop, warn: noop, info: noop, debug: noop }) };
});
vi.mock('../utils/prisma.js', () => ({
  default: {
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    enrollment: { findMany: vi.fn().mockResolvedValue([]) },
    course: { findUnique: vi.fn().mockResolvedValue(null) },
    pluginStore: { findUnique: vi.fn().mockResolvedValue(null) },
    pluginData: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock('../services/llm.service.js', () => ({
  llmService: { chat: vi.fn() },
}));
vi.mock('../services/activityLog.service.js', () => ({
  activityLogService: { logActivity: vi.fn().mockResolvedValue(undefined) },
}));

import prisma from '../utils/prisma.js';
import { llmService } from '../services/llm.service.js';
import { activityLogService } from '../services/activityLog.service.js';

const PID = 'org.example.drag-match';

const manifestWith = (capabilities: Capability[], network?: string[]) =>
  parseManifest({
    id: PID,
    name: 'Drag & Match',
    version: '1.2.0',
    apiVersion: PLUGIN_API_VERSION,
    client: { entry: 'client/plugin.js' },
    extends: [
      { point: 'lecture.block', id: 'drag-match', label: 'Drag & Match', component: 'Block' },
    ],
    capabilities,
    ...(network ? { network } : {}),
  });

const build = (capabilities: Capability[], network?: string[], settings = {}) =>
  createHostApi(manifestWith(capabilities, network), '3.16.0', settings);

beforeEach(() => {
  vi.clearAllMocks();
  pluginEvents.reset();
});

describe('identity and settings', () => {
  it('exposes its own id and versions', () => {
    const { api } = build([]);
    expect(api.id).toBe(PID);
    expect(api.version).toBe('1.2.0');
    expect(api.hostVersion).toBe('3.16.0');
  });

  it('hands back admin-configured settings without a capability', () => {
    const { api } = build([], undefined, { maxPairs: 8 });
    expect(api.settings<{ maxPairs: number }>().maxPairs).toBe(8);
  });
});

describe('capability gating', () => {
  // Each entry: the capability, and a call that must be refused without it.
  const cases: [Capability, (api: ReturnType<typeof build>['api']) => unknown][] = [
    ['store', (api) => api.store],
    ['store', (api) => api.data],
    ['db', (api) => api.db.table('answers')],
    ['db', (api) => api.db.query('SELECT 1')],
    ['db', (api) => api.db.execute('SELECT 1')],
    ['events', (api) => api.on('course.deleted', () => {})],
    ['events', (api) => api.filter('llm.systemPrompt', (v) => v)],
    ['http', (api) => api.router()],
    ['llm', (api) => api.llm({ messages: [] })],
    ['activity-log', (api) => api.logActivity({ userId: 1, verb: 'viewed', objectType: 'course' })],
    ['users:read', (api) => api.getUser(1)],
    ['users:read', (api) => api.getEnrolled(1)],
    ['course:read', (api) => api.getCourse(1)],
    ['jobs', (api) => api.schedule('j', 60_000, () => {})],
    ['network', (api) => api.fetch('https://example.org')],
  ];

  it.each(cases)('refuses %s when undeclared', async (cap, call) => {
    const { api } = build([]);
    // Some surfaces are getters (throw synchronously), others are async.
    await expect(async () => await call(api)).rejects.toThrow(CapabilityError);
  });

  it('names the capability and the manifest field in the message', () => {
    const { api } = build([]);
    try {
      api.router();
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CapabilityError);
      expect((e as CapabilityError).capability).toBe('http');
      expect((e as Error).message).toMatch(/laila-plugin\.json/);
      expect((e as Error).message).toContain(PID);
    }
  });

  it.each(cases)('allows %s when declared', async (cap, call) => {
    // `network` origins may only be declared alongside the capability, so the
    // manifest refuses the pair otherwise — that refusal is tested elsewhere.
    const { api } = build([cap], cap === 'network' ? ['https://example.org'] : undefined);
    // llm/fetch reach mocked externals; we only care that the gate opened.
    vi.mocked(llmService.chat).mockResolvedValue({
      choices: [{ message: { content: 'hi' }, finishReason: 'stop' }],
      model: 'm',
    } as never);
    const globalFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    try {
      await call(api);
    } catch (e) {
      expect(e).not.toBeInstanceOf(CapabilityError);
    } finally {
      globalFetch.mockRestore();
    }
  });
});

describe('db surface', () => {
  it('prefixes logical table names', () => {
    const { api } = build(['db']);
    expect(api.db.table('answers')).toBe(`${tablePrefix(PID)}answers`);
  });

  it('passes parameters through rather than interpolating them', async () => {
    const { api } = build(['db']);
    const t = api.db.table('answers');
    await api.db.query(`SELECT * FROM ${t} WHERE id = $1`, 42);
    expect(vi.mocked(prisma.$queryRawUnsafe)).toHaveBeenCalledWith(
      `SELECT * FROM ${t} WHERE id = $1`,
      42,
    );
  });

  // The same guard the migration runner uses, applied at query time: a plugin
  // reading `users` directly builds a dependency on a schema it does not own.
  it('refuses a query naming a host table', async () => {
    const { api } = build(['db']);
    await expect(api.db.query('DROP TABLE users')).rejects.toThrow(/may only create objects/);
    await expect(api.db.execute('ALTER TABLE courses ADD COLUMN x INT')).rejects.toThrow(
      /may only create objects/,
    );
  });
});

describe('hooks', () => {
  it('registers and tears down event handlers', async () => {
    const { api, registration } = build(['events']);
    const seen: number[] = [];
    api.on('course.deleted', (p) => void seen.push(p.courseId));
    await pluginEvents.emit('course.deleted', { courseId: 3 });
    expect(seen).toEqual([3]);

    teardownRegistration(PID, registration);
    await pluginEvents.emit('course.deleted', { courseId: 4 });
    expect(seen).toEqual([3]);
    expect(registration.teardown).toHaveLength(0);
  });

  it('registers filters', async () => {
    const { api } = build(['events']);
    api.filter('llm.systemPrompt', (v) => `${v} + plugin`);
    const out = await pluginEvents.applyFilter('llm.systemPrompt', 'base', {
      userId: 1,
      courseId: null,
      purpose: 'chat',
    });
    expect(out).toBe('base + plugin');
  });
});

describe('router', () => {
  it('returns the same router on repeat calls', () => {
    const { api, registration } = build(['http']);
    const a = api.router();
    expect(api.router()).toBe(a);
    expect(registration.router).toBe(a);
  });
});

describe('llm', () => {
  it('flattens the provider response to a string', async () => {
    const { api } = build(['llm']);
    vi.mocked(llmService.chat).mockResolvedValue({
      choices: [{ message: { content: 'the answer' }, finishReason: 'stop' }],
      model: 'gpt-x',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    } as never);
    expect(await api.llm({ messages: [{ role: 'user', content: 'q' }] })).toEqual({
      content: 'the answer',
      model: 'gpt-x',
      finishReason: 'stop',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    });
  });

  it('survives an empty choices array', async () => {
    const { api } = build(['llm']);
    vi.mocked(llmService.chat).mockResolvedValue({ choices: [], model: 'm' } as never);
    const out = await api.llm({ messages: [] });
    expect(out.content).toBe('');
    expect(out.finishReason).toBeNull();
  });
});

describe('flattenContent', () => {
  it('passes a plain string through', () => {
    expect(flattenContent('hello')).toBe('hello');
  });

  // The bug this exists to prevent: casting a multimodal array to string, so
  // a plugin calling .trim() on it explodes at runtime.
  it('joins the text parts of a multimodal reply', () => {
    expect(
      flattenContent([
        { type: 'text', text: 'a' },
        { type: 'image_url' },
        { type: 'text', text: 'b' },
      ]),
    ).toBe('ab');
  });

  it('returns a string for undefined and for image-only content', () => {
    expect(flattenContent(undefined)).toBe('');
    expect(flattenContent([{ type: 'image_url' }])).toBe('');
  });
});

describe('activity log', () => {
  it('stamps the plugin id so plugin rows are attributable', async () => {
    const { api } = build(['activity-log']);
    await api.logActivity({ userId: 5, verb: 'interacted', objectType: 'lecture', courseId: 7 });
    const arg = vi.mocked(activityLogService.logActivity).mock.calls[0][0] as unknown as {
      metadata: Record<string, unknown>;
    };
    expect(arg.metadata.pluginId).toBe(PID);
  });
});

describe('jobs', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs on the interval and stops on teardown', async () => {
    const { api, registration } = build(['jobs']);
    const tick = vi.fn();
    api.schedule('poll', MIN_JOB_INTERVAL_MS, tick);

    await vi.advanceTimersByTimeAsync(MIN_JOB_INTERVAL_MS * 2 + 10);
    expect(tick).toHaveBeenCalledTimes(2);

    teardownRegistration(PID, registration);
    await vi.advanceTimersByTimeAsync(MIN_JOB_INTERVAL_MS * 3);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('refuses an interval that would spin a core', () => {
    const { api } = build(['jobs']);
    expect(() => api.schedule('hot', 1, () => {})).toThrow(/at least/);
    expect(() => api.schedule('nan', NaN, () => {})).toThrow(/at least/);
  });

  // An unhandled rejection inside a timer is fatal under Node's default policy,
  // so a throwing job must be caught at the scheduler.
  // An unhandled rejection inside a timer is fatal under Node's default
  // policy, so the scheduler catches. The proof is that the interval keeps
  // firing afterwards and a second job is unaffected.
  it('survives a throwing job and keeps running', async () => {
    const { api } = build(['jobs']);
    const healthy = vi.fn();
    api.schedule('bad', MIN_JOB_INTERVAL_MS, () => {
      throw new Error('boom');
    });
    api.schedule('good', MIN_JOB_INTERVAL_MS, healthy);
    await vi.advanceTimersByTimeAsync(MIN_JOB_INTERVAL_MS * 2 + 10);
    expect(healthy).toHaveBeenCalledTimes(2);
  });

  it('survives a rejecting async job and keeps running', async () => {
    const { api } = build(['jobs']);
    const healthy = vi.fn();
    api.schedule('bad', MIN_JOB_INTERVAL_MS, async () => {
      throw new Error('boom');
    });
    api.schedule('good', MIN_JOB_INTERVAL_MS, healthy);
    await vi.advanceTimersByTimeAsync(MIN_JOB_INTERVAL_MS * 2 + 10);
    expect(healthy).toHaveBeenCalledTimes(2);
  });
});

describe('fetch', () => {
  it('allows a declared origin', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const { api } = build(['network'], ['https://api.example.org']);
    await api.fetch('https://api.example.org/v1/items');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('refuses an origin the manifest did not declare', async () => {
    const { api } = build(['network'], ['https://api.example.org']);
    await expect(api.fetch('https://evil.example.com/x')).rejects.toThrow(/may not call/);
  });

  it('matches on origin, not prefix', async () => {
    const { api } = build(['network'], ['https://api.example.org']);
    await expect(api.fetch('https://api.example.org.evil.com/x')).rejects.toThrow(/may not call/);
  });

  it('rejects a malformed URL', async () => {
    const { api } = build(['network'], ['https://api.example.org']);
    await expect(api.fetch('not a url')).rejects.toThrow(/invalid URL/);
  });
});
