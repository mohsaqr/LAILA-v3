import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PluginEventBus, HANDLER_TIMEOUT_MS } from './events.js';

// The bus logs every handler failure through pino; silence it so a test that
// deliberately throws does not look like a broken suite.
vi.mock('../utils/logger.js', () => {
  const noop = () => {};
  return { createLogger: () => ({ error: noop, warn: noop, info: noop, debug: noop }) };
});

describe('PluginEventBus events', () => {
  let bus: PluginEventBus;
  beforeEach(() => {
    bus = new PluginEventBus();
  });

  it('delivers a payload to a listener', async () => {
    const seen: number[] = [];
    bus.on('p.a', 'user.enrolled', (p) => void seen.push(p.courseId));
    await bus.emit('user.enrolled', { userId: 1, courseId: 7, enrolledBy: null });
    expect(seen).toEqual([7]);
  });

  it('is a no-op when nothing is listening', async () => {
    await expect(bus.emit('course.deleted', { courseId: 1 })).resolves.toBeUndefined();
  });

  it('runs listeners in priority order, then registration order', async () => {
    const order: string[] = [];
    bus.on('p.a', 'course.deleted', () => void order.push('default-first'));
    bus.on('p.b', 'course.deleted', () => void order.push('late'), 20);
    bus.on('p.c', 'course.deleted', () => void order.push('early'), 1);
    bus.on('p.d', 'course.deleted', () => void order.push('default-second'));
    await bus.emit('course.deleted', { courseId: 1 });
    expect(order).toEqual(['early', 'default-first', 'default-second', 'late']);
  });

  it('awaits async listeners', async () => {
    let done = false;
    bus.on('p.a', 'course.deleted', async () => {
      await new Promise((r) => setTimeout(r, 5));
      done = true;
    });
    await bus.emit('course.deleted', { courseId: 1 });
    expect(done).toBe(true);
  });

  // The central promise of the event half: a plugin cannot fail the host.
  it('survives a throwing listener and still runs the rest', async () => {
    const seen: string[] = [];
    bus.on('p.bad', 'course.deleted', () => {
      throw new Error('boom');
    });
    bus.on('p.good', 'course.deleted', () => void seen.push('ran'));
    await expect(bus.emit('course.deleted', { courseId: 1 })).resolves.toBeUndefined();
    expect(seen).toEqual(['ran']);
  });

  it('survives a rejecting async listener', async () => {
    const seen: string[] = [];
    bus.on('p.bad', 'course.deleted', async () => {
      throw new Error('async boom');
    });
    bus.on('p.good', 'course.deleted', () => void seen.push('ran'));
    await bus.emit('course.deleted', { courseId: 1 });
    expect(seen).toEqual(['ran']);
  });

  it('reports failures to the error reporter with the plugin id', async () => {
    const reporter = vi.fn();
    bus.setErrorReporter(reporter);
    bus.on('org.example.bad', 'course.deleted', () => {
      throw new Error('boom');
    });
    await bus.emit('course.deleted', { courseId: 1 });
    expect(reporter).toHaveBeenCalledOnce();
    expect(reporter.mock.calls[0][0]).toBe('org.example.bad');
    expect(reporter.mock.calls[0][1]).toBe('course.deleted');
    expect((reporter.mock.calls[0][2] as Error).message).toBe('boom');
  });

  it('survives an error reporter that itself throws', async () => {
    bus.setErrorReporter(() => {
      throw new Error('reporter down');
    });
    bus.on('p.bad', 'course.deleted', () => {
      throw new Error('boom');
    });
    await expect(bus.emit('course.deleted', { courseId: 1 })).resolves.toBeUndefined();
  });

  it('unsubscribes through the returned function', async () => {
    const seen: string[] = [];
    const off = bus.on('p.a', 'course.deleted', () => void seen.push('ran'));
    off();
    await bus.emit('course.deleted', { courseId: 1 });
    expect(seen).toEqual([]);
    expect(bus.listenerCount('course.deleted')).toBe(0);
  });

  it('removeAll detaches one plugin and leaves the others', async () => {
    const seen: string[] = [];
    bus.on('p.gone', 'course.deleted', () => void seen.push('gone'));
    bus.on('p.stays', 'course.deleted', () => void seen.push('stays'));
    bus.addFilter('p.gone', 'llm.systemPrompt', (v) => `${v}!`);
    bus.removeAll('p.gone');
    await bus.emit('course.deleted', { courseId: 1 });
    expect(seen).toEqual(['stays']);
    expect(bus.listenerCount('llm.systemPrompt')).toBe(0);
  });

  it('a listener registered during an emit does not run in that emit', async () => {
    const seen: string[] = [];
    bus.on('p.a', 'course.deleted', () => {
      bus.on('p.b', 'course.deleted', () => void seen.push('late-add'));
      seen.push('first');
    });
    await bus.emit('course.deleted', { courseId: 1 });
    expect(seen).toEqual(['first']);
  });
});

describe('PluginEventBus filters', () => {
  let bus: PluginEventBus;
  beforeEach(() => {
    bus = new PluginEventBus();
  });

  const ctx = { userId: 1, courseId: 2, purpose: 'chat' };

  it('returns the input when nothing is registered', async () => {
    expect(await bus.applyFilter('llm.systemPrompt', 'base', ctx)).toBe('base');
  });

  it('chains handlers in priority order', async () => {
    bus.addFilter('p.a', 'llm.systemPrompt', (v) => `${v} a`, 20);
    bus.addFilter('p.b', 'llm.systemPrompt', (v) => `${v} b`, 1);
    expect(await bus.applyFilter('llm.systemPrompt', 'base', ctx)).toBe('base b a');
  });

  it('awaits async handlers', async () => {
    bus.addFilter('p.a', 'llm.systemPrompt', async (v) => {
      await new Promise((r) => setTimeout(r, 5));
      return `${v} async`;
    });
    expect(await bus.applyFilter('llm.systemPrompt', 'base', ctx)).toBe('base async');
  });

  it('passes the context to handlers', async () => {
    bus.addFilter('p.a', 'llm.systemPrompt', (v, c) => `${v} course=${c.courseId}`);
    expect(await bus.applyFilter('llm.systemPrompt', 'base', ctx)).toBe('base course=2');
  });

  // A thrower must cost only its own contribution — never the pipeline, and
  // never a half-built value handed back to the host.
  it('drops a throwing handler and keeps the last good value', async () => {
    bus.addFilter('p.a', 'llm.systemPrompt', (v) => `${v} a`, 1);
    bus.addFilter('p.bad', 'llm.systemPrompt', () => {
      throw new Error('boom');
    }, 2);
    bus.addFilter('p.c', 'llm.systemPrompt', (v) => `${v} c`, 3);
    expect(await bus.applyFilter('llm.systemPrompt', 'base', ctx)).toBe('base a c');
  });

  it('ignores a handler that forgets to return', async () => {
    bus.addFilter('p.a', 'llm.systemPrompt', (v) => `${v} a`, 1);
    // A plugin author's classic mistake: mutating and not returning.
    bus.addFilter('p.forgetful', 'llm.systemPrompt', (() => undefined) as never, 2);
    bus.addFilter('p.c', 'llm.systemPrompt', (v) => `${v} c`, 3);
    expect(await bus.applyFilter('llm.systemPrompt', 'base', ctx)).toBe('base a c');
  });

  it('builds export data across several plugins', async () => {
    bus.addFilter('p.a', 'course.export.data', (v) => ({ ...v, a: 1 }));
    bus.addFilter('p.b', 'course.export.data', (v) => ({ ...v, b: 2 }));
    const out = await bus.applyFilter(
      'course.export.data',
      {},
      { courseId: 1, userId: 1, sections: ['design'] },
    );
    expect(out).toEqual({ a: 1, b: 2 });
  });
});

describe('PluginEventBus timeouts', () => {
  let bus: PluginEventBus;
  beforeEach(() => {
    bus = new PluginEventBus();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('abandons a hanging listener instead of holding the request open', async () => {
    const reporter = vi.fn();
    bus.setErrorReporter(reporter);
    bus.on('p.hang', 'course.deleted', () => new Promise<void>(() => {}));

    const emitted = bus.emit('course.deleted', { courseId: 1 });
    await vi.advanceTimersByTimeAsync(HANDLER_TIMEOUT_MS + 10);
    await expect(emitted).resolves.toBeUndefined();

    expect(reporter).toHaveBeenCalledOnce();
    expect((reporter.mock.calls[0][2] as Error).message).toMatch(/exceeded/);
  });

  it('abandons a hanging filter and keeps the prior value', async () => {
    bus.addFilter('p.hang', 'llm.systemPrompt', () => new Promise<string>(() => {}));
    const applied = bus.applyFilter('llm.systemPrompt', 'base', {
      userId: 1,
      courseId: null,
      purpose: 'chat',
    });
    await vi.advanceTimersByTimeAsync(HANDLER_TIMEOUT_MS + 10);
    expect(await applied).toBe('base');
  });

  it('does not penalise a handler that settles in time', async () => {
    bus.addFilter('p.ok', 'llm.systemPrompt', async (v) => {
      await new Promise((r) => setTimeout(r, 10));
      return `${v} ok`;
    });
    const applied = bus.applyFilter('llm.systemPrompt', 'base', {
      userId: 1,
      courseId: null,
      purpose: 'chat',
    });
    await vi.advanceTimersByTimeAsync(20);
    expect(await applied).toBe('base ok');
  });
});
