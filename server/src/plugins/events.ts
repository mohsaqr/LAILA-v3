/**
 * The plugin hook system: **events** (something happened, react to it) and
 * **filters** (something is being built, change it).
 *
 * The split is deliberate and follows WordPress's distinction, because the two
 * need opposite failure behaviour:
 *
 *   - An **event** listener that throws must not break the thing that emitted
 *     it. A plugin failing to send a notification cannot fail the enrollment
 *     that triggered it. Errors are caught, logged with the plugin id, counted
 *     against the plugin, and otherwise swallowed *at the bus*, never at the
 *     call site.
 *   - A **filter** returns the value the host then uses, so a thrower cannot be
 *     swallowed into a silent `undefined`. It is caught, logged, and the chain
 *     continues **from the last good value** — the plugin's contribution is
 *     dropped, the pipeline survives, and the host never sees a half-built
 *     object.
 *
 * Both are bounded by a timeout. A plugin awaiting a dead upstream would
 * otherwise hold an Express request open until the client gives up, and the
 * symptom ("the site is slow") points nowhere near the cause.
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('plugins:events');

/** How long any single handler may take before the bus abandons it. */
export const HANDLER_TIMEOUT_MS = 5_000;

/**
 * Events the host emits. Adding one is additive; changing a payload shape is
 * a breaking change to `PLUGIN_API_VERSION`.
 *
 * Payloads carry ids, not Prisma rows: a row shape is an internal detail that
 * drifts with every schema change, and handing one out would freeze it.
 */
export interface PluginEventMap {
  'user.registered': { userId: number; email: string };
  'user.enrolled': { userId: number; courseId: number; enrolledBy: number | null };
  'user.unenrolled': { userId: number; courseId: number };
  'course.created': { courseId: number; instructorId: number };
  'course.published': { courseId: number; publishedBy: number };
  'course.exported': { courseId: number; userId: number; sections: string[] };
  'course.imported': { courseId: number; userId: number; sourceCourseId: number | null };
  'course.deleted': { courseId: number };
  'lecture.viewed': { userId: number; courseId: number; lectureId: number };
  'assignment.submitted': { userId: number; courseId: number; assignmentId: number; submissionId: number };
  'assignment.graded': {
    userId: number;
    courseId: number;
    assignmentId: number;
    submissionId: number;
    score: number | null;
    gradedBy: number;
  };
  'quiz.submitted': { userId: number; courseId: number; quizId: number; score: number | null };
  'activity.logged': {
    userId: number;
    courseId: number | null;
    verb: string;
    objectType: string;
    objectId: number | null;
  };
  'plugin.enabled': { pluginId: string };
  'plugin.disabled': { pluginId: string };
}

export type PluginEventName = keyof PluginEventMap;

/**
 * Filters the host runs a value through. Each entry is `[value, context]`:
 * a handler receives both and returns a new value of the same type.
 */
export interface PluginFilterMap {
  /** Extra data a plugin contributes to a course export package. */
  'course.export.data': [
    Record<string, unknown>,
    { courseId: number; userId: number; sections: readonly string[] },
  ];
  /** The system prompt about to be sent to an LLM provider. */
  'llm.systemPrompt': [string, { userId: number; courseId: number | null; purpose: string }];
  /** The course navigation entries a student or teacher sees. */
  'course.nav': [
    { id: string; label: string; path: string; icon?: string }[],
    { courseId: number; userId: number; role: string },
  ];
  /** A lecture section's stored config, before it reaches the renderer. */
  'lecture.section.config': [
    Record<string, unknown>,
    { sectionId: number; type: string; userId: number },
  ];
}

export type PluginFilterName = keyof PluginFilterMap;

type EventHandler<N extends PluginEventName> = (
  payload: PluginEventMap[N],
) => void | Promise<void>;

type FilterHandler<N extends PluginFilterName> = (
  value: PluginFilterMap[N][0],
  context: PluginFilterMap[N][1],
) => PluginFilterMap[N][0] | Promise<PluginFilterMap[N][0]>;

interface Registration {
  pluginId: string;
  handler: (...args: never[]) => unknown;
  /** Lower runs first. Defaults to 10, leaving room on both sides. */
  priority: number;
  /** Monotonic, so equal priorities keep registration order (stable sort). */
  seq: number;
}

/** Reported to the registry so the admin UI can show a misbehaving plugin. */
export type PluginErrorReporter = (
  pluginId: string,
  hook: string,
  error: unknown,
) => void;

/**
 * Reject after `ms`, but let the handler's own promise win the race when it
 * settles first. The timer is always cleared: an un-cleared timer keeps the
 * event loop alive and makes a clean shutdown hang for `ms`.
 */
function withTimeout<T>(p: Promise<T> | T, ms: number, what: string): Promise<T> {
  if (!(p instanceof Promise)) return Promise.resolve(p);
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} exceeded ${ms}ms`)), ms);
    timer.unref?.();
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

export class PluginEventBus {
  private events = new Map<string, Registration[]>();
  private filters = new Map<string, Registration[]>();
  private seq = 0;
  private reporter: PluginErrorReporter | null = null;

  /** The registry installs this so handler failures surface in the admin UI. */
  setErrorReporter(reporter: PluginErrorReporter | null): void {
    this.reporter = reporter;
  }

  private add(map: Map<string, Registration[]>, name: string, reg: Registration): () => void {
    const list = map.get(name) ?? [];
    list.push(reg);
    // Stable by (priority, registration order). Array.prototype.sort is stable
    // in every engine we target, but `seq` makes the intent explicit rather
    // than relying on that.
    list.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    map.set(name, list);
    return () => {
      const current = map.get(name);
      if (!current) return;
      const i = current.indexOf(reg);
      if (i >= 0) current.splice(i, 1);
    };
  }

  /**
   * Subscribe to an event.
   *
   * @returns an unsubscribe function. The loader keeps these so disabling a
   *   plugin actually detaches it, rather than leaving a dead handler that
   *   still costs a timeout on every emit.
   */
  on<N extends PluginEventName>(
    pluginId: string,
    name: N,
    handler: EventHandler<N>,
    priority = 10,
  ): () => void {
    return this.add(this.events, name, {
      pluginId,
      handler: handler as Registration['handler'],
      priority,
      seq: this.seq++,
    });
  }

  /** Register a filter. Same contract as {@link on}. */
  addFilter<N extends PluginFilterName>(
    pluginId: string,
    name: N,
    handler: FilterHandler<N>,
    priority = 10,
  ): () => void {
    return this.add(this.filters, name, {
      pluginId,
      handler: handler as Registration['handler'],
      priority,
      seq: this.seq++,
    });
  }

  /** Drop every registration belonging to a plugin. Used on disable/uninstall. */
  removeAll(pluginId: string): void {
    for (const map of [this.events, this.filters]) {
      for (const [name, list] of map) {
        const kept = list.filter((r) => r.pluginId !== pluginId);
        if (kept.length) map.set(name, kept);
        else map.delete(name);
      }
    }
  }

  private report(pluginId: string, hook: string, error: unknown): void {
    log.error(
      { plugin: pluginId, hook, err: error instanceof Error ? error.message : String(error) },
      'plugin hook failed',
    );
    // The reporter is plugin bookkeeping; it must never be the reason a hook
    // brings down the emitter that was already tolerating a failure.
    try {
      this.reporter?.(pluginId, hook, error);
    } catch (e) {
      log.error({ err: e }, 'plugin error reporter threw');
    }
  }

  /**
   * Emit an event. Resolves once every listener has settled or timed out.
   *
   * Never rejects: the emitter's own work has already happened, and a plugin
   * cannot retroactively fail it. Listeners run **sequentially** by priority
   * so ordering is something a plugin author can reason about; the timeout
   * bounds the total at `listeners x HANDLER_TIMEOUT_MS`.
   */
  async emit<N extends PluginEventName>(name: N, payload: PluginEventMap[N]): Promise<void> {
    const list = this.events.get(name);
    if (!list?.length) return;
    for (const reg of [...list]) {
      try {
        await withTimeout(
          (reg.handler as EventHandler<N>)(payload),
          HANDLER_TIMEOUT_MS,
          `event "${name}"`,
        );
      } catch (error) {
        this.report(reg.pluginId, name, error);
      }
    }
  }

  /**
   * Run a value through every registered filter, in priority order.
   *
   * A handler that throws, times out, or returns `undefined` is skipped and
   * the chain continues from the previous value — so a broken plugin costs its
   * own contribution and nothing else.
   */
  async applyFilter<N extends PluginFilterName>(
    name: N,
    value: PluginFilterMap[N][0],
    context: PluginFilterMap[N][1],
  ): Promise<PluginFilterMap[N][0]> {
    const list = this.filters.get(name);
    if (!list?.length) return value;
    let current = value;
    for (const reg of [...list]) {
      try {
        const next = await withTimeout(
          (reg.handler as FilterHandler<N>)(current, context),
          HANDLER_TIMEOUT_MS,
          `filter "${name}"`,
        );
        // `undefined` is the signature of a handler that forgot to return.
        // Treating it as "no change" is kinder than propagating a hole, and
        // the log line tells the author what they did.
        if (next === undefined) {
          log.warn({ plugin: reg.pluginId, hook: name }, 'filter returned undefined; ignored');
          continue;
        }
        current = next;
      } catch (error) {
        this.report(reg.pluginId, name, error);
      }
    }
    return current;
  }

  /** Test/introspection seam: how many handlers a hook has. */
  listenerCount(name: PluginEventName | PluginFilterName): number {
    return (this.events.get(name)?.length ?? 0) + (this.filters.get(name)?.length ?? 0);
  }

  /** Drop every registration. Tests use this; so does a full plugin reload. */
  reset(): void {
    this.events.clear();
    this.filters.clear();
    this.reporter = null;
  }
}

/**
 * The process-wide bus. A singleton because plugins register at boot and the
 * emitters are scattered across services that must not each thread a bus
 * through their call signatures.
 */
export const pluginEvents = new PluginEventBus();
