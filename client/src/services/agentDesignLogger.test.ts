import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { AgentDesignLogger } from './agentDesignLogger';

vi.mock('../api/client', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

import apiClient from '../api/client';

// The global test setup replaces localStorage with no-op vi.fn() stubs.
// For this suite we need real persistence, so install an in-memory store
// that behaves like the browser spec.
beforeAll(() => {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
});

type BatchCall = { events: Array<Record<string, unknown>> };

const flushCalls = (): BatchCall[] => {
  const calls = (apiClient.post as unknown as { mock: { calls: [string, BatchCall][] } })
    .mock.calls;
  return calls
    .filter(([url]) => url === '/agent-design-logs/batch')
    .map(([, body]) => body);
};

const collectEvents = () => flushCalls().flatMap((b) => b.events);

describe('AgentDesignLogger — sitting persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true },
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a fresh sitting when no localStorage entry exists', () => {
    const logger = new AgentDesignLogger(1, 10);
    logger.startSession();

    const persisted = JSON.parse(
      localStorage.getItem('agentDesign:sitting:1:10')!
    );
    expect(persisted.designSessionId).toMatch(/[0-9a-f-]+/);
    expect(persisted.sessionStartTime).toBeTypeOf('number');
    expect(persisted.lastActiveAt).toBeTypeOf('number');
  });

  it('emits design_session_start exactly once on a fresh sitting', async () => {
    const logger = new AgentDesignLogger(1, 10);
    logger.startSession();
    await logger.endSession();

    const startEvents = collectEvents().filter(
      (e) => e.eventType === 'design_session_start'
    );
    expect(startEvents).toHaveLength(1);
  });

  it('resumes the same sitting when reopened within the gap window', async () => {
    const logger1 = new AgentDesignLogger(1, 10);
    logger1.startSession();
    const firstId = JSON.parse(localStorage.getItem('agentDesign:sitting:1:10')!)
      .designSessionId;
    await logger1.endSession();

    // Simulate a later mount shortly after.
    const logger2 = new AgentDesignLogger(1, 10);
    logger2.startSession();

    const secondId = JSON.parse(localStorage.getItem('agentDesign:sitting:1:10')!)
      .designSessionId;
    expect(secondId).toBe(firstId);

    // Only one design_session_start should have been emitted total.
    const startEvents = collectEvents().filter(
      (e) => e.eventType === 'design_session_start'
    );
    expect(startEvents).toHaveLength(1);
  });

  it('emits a correctly-dated end event and starts a new sitting after the gap', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-12T20:00:00Z'));

    const logger1 = new AgentDesignLogger(1, 10);
    logger1.startSession();

    // Work for two minutes.
    vi.advanceTimersByTime(2 * 60 * 1000);
    await logger1.endSession();

    // 11 minutes later the student comes back — past the 10-minute gap.
    vi.advanceTimersByTime(11 * 60 * 1000);

    const logger2 = new AgentDesignLogger(1, 10);
    logger2.startSession();
    await logger2.endSession();

    const events = collectEvents();
    const starts = events.filter((e) => e.eventType === 'design_session_start');
    const ends = events.filter((e) => e.eventType === 'design_session_end');

    // Two distinct sittings -> two starts.
    expect(starts).toHaveLength(2);
    // One synthetic end for the first (stale) sitting.
    expect(ends).toHaveLength(1);

    // The end event carries the real duration of sitting 1 (~120s), not 0.
    const total = ends[0].totalDesignTime as number;
    expect(total).toBeGreaterThanOrEqual(119);
    expect(total).toBeLessThanOrEqual(121);

    // The two sittings must have distinct ids so the server's sittingCount
    // (= COUNT DISTINCT designSessionId) reflects "2".
    const startIds = new Set(starts.map((e) => e.designSessionId));
    expect(startIds.size).toBe(2);
  });

  it('force-flushes submission_completed so SPA navigation cannot drop it', async () => {
    const logger = new AgentDesignLogger(1, 10);
    logger.startSession();
    (apiClient.post as ReturnType<typeof vi.fn>).mockClear();

    logger.logSubmissionCompleted({ agentName: 'Maya' });
    // Let the in-flight flush promise settle.
    await Promise.resolve();
    await Promise.resolve();

    const posted = flushCalls();
    expect(posted.length).toBeGreaterThanOrEqual(1);
    const allEvents = posted.flatMap((b) => b.events);
    expect(
      allEvents.some((e) => e.eventType === 'submission_completed')
    ).toBe(true);
  });
});
