import prisma from '../utils/prisma.js';

/**
 * Token metering and caps for LLM traffic.
 *
 * Two separate jobs, deliberately in one place:
 *
 *   1. RECORD every call to `llm_usage`, so "what has this student cost this
 *      month" is one indexed query instead of a five-way UNION across the
 *      interaction-log tables.
 *   2. DECIDE whether the next call is allowed, against caps an admin sets per
 *      user, per course, and platform-wide.
 *
 * ## Two rules this module must never break
 *
 * **Unset means unlimited.** Every cap starts absent, and absent is not zero —
 * it is "no limit". Deploying this changes nothing until an admin types a
 * number in. There is no default budget waiting to surprise anyone.
 *
 * **It fails open.** Every function here swallows its own errors and lets the
 * call proceed. If the settings row is malformed, the usage table is missing,
 * or there is a bug in this file, the consequence is unmetered traffic — not a
 * platform where nobody can talk to a tutor. Metering is a business control;
 * teaching is the product. When those two conflict, teaching wins and the
 * failure goes to the log where an operator can find it.
 */

/** Cap settings live in the existing key/value table — no new columns. */
export const BUDGET_SETTING_KEYS = {
  /** Tokens one user may spend per calendar month. */
  userMonthly: 'llm_cap_user_monthly_tokens',
  /** Tokens one course may spend per calendar month. */
  courseMonthly: 'llm_cap_course_monthly_tokens',
  /** Tokens the whole platform may spend per calendar month. */
  globalMonthly: 'llm_cap_global_monthly_tokens',
  /** Hard ceiling on max output tokens for any single call. */
  maxOutputPerCall: 'llm_cap_max_output_tokens',
} as const;

/** Fraction of a cap at which the caller is warned but still served. */
const WARN_AT = 0.8;

export type BudgetScope = 'user' | 'course' | 'global';

export interface BudgetCaps {
  userMonthly: number | null;
  courseMonthly: number | null;
  globalMonthly: number | null;
  maxOutputPerCall: number | null;
}

export interface BudgetVerdict {
  /** False only when a cap is set AND exceeded. Anything unexpected → true. */
  allowed: boolean;
  /** Set when allowed but past the warning threshold. */
  warning?: { scope: BudgetScope; used: number; cap: number; percent: number };
  /** Set when blocked. */
  blocked?: { scope: BudgetScope; used: number; cap: number; resetsAt: Date };
}

/**
 * Thrown when a cap refuses a call.
 *
 * A distinct class because `chat.service` catches everything from the unified
 * LLM path and retries through a direct provider SDK. That fallback is right
 * for a provider outage and catastrophic for a budget decision: the cap would
 * reject the call and the retry would immediately make it anyway, so the limit
 * would appear to do nothing. Callers with a fallback must re-throw this rather
 * than treating it as a transport failure.
 */
export class LLMBudgetError extends Error {
  readonly statusCode = 429;
  readonly code = 'LLM_BUDGET_EXCEEDED';

  constructor(
    message: string,
    readonly scope: BudgetScope,
    readonly used: number,
    readonly cap: number,
    readonly resetsAt: Date,
  ) {
    super(message);
    this.name = 'LLMBudgetError';
  }
}

export const isBudgetError = (e: unknown): e is LLMBudgetError =>
  e instanceof LLMBudgetError || (e as { code?: string })?.code === 'LLM_BUDGET_EXCEEDED';

/** Start of the current calendar month, UTC. */
export const monthStart = (now = new Date()): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

/** Start of next month — when the current window resets. */
export const monthEnd = (now = new Date()): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

/**
 * Read a cap. Absent, blank, unparseable or <= 0 all mean "no limit".
 *
 * Treating 0 as unlimited rather than "block everything" is deliberate: an
 * admin who clears a field, or a half-written settings row, must not silently
 * switch the platform off. Blocking everyone is the one outcome a
 * misconfiguration should never be able to produce.
 */
const parseCap = (raw: string | null | undefined): number | null => {
  if (raw == null || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
};

export class LLMBudgetService {
  private capCache: { value: BudgetCaps; expiresAt: number } | null = null;
  private readonly cacheMs = 60 * 1000;

  /** All caps, cached briefly — this runs on every LLM call. */
  async getCaps(): Promise<BudgetCaps> {
    if (this.capCache && Date.now() < this.capCache.expiresAt) return this.capCache.value;

    const empty: BudgetCaps = {
      userMonthly: null,
      courseMonthly: null,
      globalMonthly: null,
      maxOutputPerCall: null,
    };

    try {
      const rows = await prisma.systemSetting.findMany({
        where: { settingKey: { in: Object.values(BUDGET_SETTING_KEYS) } },
        select: { settingKey: true, settingValue: true },
      });
      const byKey = new Map(rows.map(r => [r.settingKey, r.settingValue]));
      const value: BudgetCaps = {
        userMonthly: parseCap(byKey.get(BUDGET_SETTING_KEYS.userMonthly)),
        courseMonthly: parseCap(byKey.get(BUDGET_SETTING_KEYS.courseMonthly)),
        globalMonthly: parseCap(byKey.get(BUDGET_SETTING_KEYS.globalMonthly)),
        maxOutputPerCall: parseCap(byKey.get(BUDGET_SETTING_KEYS.maxOutputPerCall)),
      };
      this.capCache = { value, expiresAt: Date.now() + this.cacheMs };
      return value;
    } catch (err) {
      // Unreadable settings must not mean "cap everything to zero".
      console.warn('[llmBudget] could not read caps, treating as unlimited:', err);
      return empty;
    }
  }

  clearCache(): void {
    this.capCache = null;
  }

  /** Tokens spent in the current month for one scope. */
  async usedThisMonth(scope: BudgetScope, id?: number | null): Promise<number> {
    const where =
      scope === 'user' ? { userId: id ?? undefined }
      : scope === 'course' ? { courseId: id ?? undefined }
      : {};

    const agg = await prisma.lLMUsage.aggregate({
      _sum: { totalTokens: true },
      where: { ...where, createdAt: { gte: monthStart() } },
    });
    return agg._sum.totalTokens ?? 0;
  }

  /**
   * Decide whether a call may proceed.
   *
   * Checks the narrowest scope first so the message names the limit the user
   * can actually do something about: being personally out of budget is
   * actionable, "the platform is out" is not.
   *
   * A scope with no id is skipped rather than treated as global — a call with
   * no course (generic chat, AI tools) is not "course 0", and folding it into a
   * course total would bill it to a course that never made it.
   */
  async check(params: { userId?: number | null; courseId?: number | null }): Promise<BudgetVerdict> {
    try {
      const caps = await this.getCaps();
      if (caps.userMonthly == null && caps.courseMonthly == null && caps.globalMonthly == null) {
        return { allowed: true };
      }

      const scopes: Array<{ scope: BudgetScope; cap: number | null; id?: number | null }> = [
        { scope: 'user', cap: caps.userMonthly, id: params.userId },
        { scope: 'course', cap: caps.courseMonthly, id: params.courseId },
        { scope: 'global', cap: caps.globalMonthly },
      ];

      let warning: BudgetVerdict['warning'];

      for (const { scope, cap, id } of scopes) {
        if (cap == null) continue;
        if (scope !== 'global' && (id == null)) continue;

        const used = await this.usedThisMonth(scope, id);
        if (used >= cap) {
          return { allowed: false, blocked: { scope, used, cap, resetsAt: monthEnd() } };
        }
        const percent = used / cap;
        // Report the scope closest to its limit, not merely the first over 80%.
        if (percent >= WARN_AT && (!warning || percent > warning.percent)) {
          warning = { scope, used, cap, percent };
        }
      }

      return { allowed: true, warning };
    } catch (err) {
      // See the file header: a metering fault must never stop teaching.
      console.warn('[llmBudget] check failed, allowing the call:', err);
      return { allowed: true };
    }
  }

  /** `check`, but throws the typed error instead of returning a verdict. */
  async assert(params: { userId?: number | null; courseId?: number | null }): Promise<BudgetVerdict> {
    const verdict = await this.check(params);
    if (!verdict.allowed && verdict.blocked) {
      const { scope, used, cap, resetsAt } = verdict.blocked;
      const label =
        scope === 'user' ? 'Your monthly AI allowance'
        : scope === 'course' ? "This course's monthly AI allowance"
        : "The platform's monthly AI allowance";
      throw new LLMBudgetError(
        `${label} is used up (${used.toLocaleString()} of ${cap.toLocaleString()} tokens). It resets on ${resetsAt.toISOString().slice(0, 10)}.`,
        scope, used, cap, resetsAt,
      );
    }
    return verdict;
  }

  /**
   * Record one call. Never throws.
   *
   * Metering is bookkeeping about a request that already happened — losing a
   * row is regrettable, turning a successful completion into an error the
   * student sees is not acceptable. The caller gets no result to check because
   * there is no decision for it to make.
   */
  async record(entry: {
    userId?: number | null;
    courseId?: number | null;
    providerId?: number | null;
    source?: string;
    module?: string | null;
    provider?: string | null;
    model?: string | null;
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
    costUsd?: number | null;
    clamped?: boolean;
    requestedMaxTokens?: number | null;
    grantedMaxTokens?: number | null;
  }): Promise<void> {
    try {
      const prompt = entry.promptTokens ?? null;
      const completion = entry.completionTokens ?? null;
      // Absent counts stay absent. Recording 0 would make an unmeasured call
      // look free, and the Gemini path in agentAssignment reports nothing at
      // all — that gap should be visible, not averaged away.
      const total =
        entry.totalTokens ??
        (prompt != null || completion != null ? (prompt ?? 0) + (completion ?? 0) : null);

      await prisma.lLMUsage.create({
        data: {
          userId: entry.userId ?? null,
          courseId: entry.courseId ?? null,
          providerId: entry.providerId ?? null,
          source: entry.source ?? 'llm_service',
          module: entry.module ?? null,
          provider: entry.provider ?? null,
          model: entry.model ?? null,
          promptTokens: prompt,
          completionTokens: completion,
          totalTokens: total,
          costUsd: entry.costUsd ?? null,
          usageMissing: total == null,
          clamped: entry.clamped ?? false,
          requestedMaxTokens: entry.requestedMaxTokens ?? null,
          grantedMaxTokens: entry.grantedMaxTokens ?? null,
        },
      });
    } catch (err) {
      console.warn('[llmBudget] could not record usage:', err);
    }
  }

  /**
   * Value a call in USD from the model's configured prices.
   *
   * Returns null when prices are not set, which is the common case: local
   * models (Ollama, vLLM) have no price, and most rows are simply
   * unconfigured. Null is "unknown", not "free" — a zero here would understate
   * the bill in exactly the reports meant to reveal it.
   */
  async estimateCostUsd(
    modelRowId: { providerId?: number | null; model?: string | null },
    promptTokens?: number | null,
    completionTokens?: number | null,
  ): Promise<number | null> {
    if (!modelRowId.providerId || !modelRowId.model) return null;
    if (promptTokens == null && completionTokens == null) return null;

    try {
      const row = await prisma.lLMModel.findFirst({
        where: { providerId: modelRowId.providerId, modelId: modelRowId.model },
        select: { inputPricePer1M: true, outputPricePer1M: true },
      });
      if (!row) return null;
      const { inputPricePer1M, outputPricePer1M } = row;
      if (inputPricePer1M == null && outputPricePer1M == null) return null;

      const inCost = ((promptTokens ?? 0) / 1_000_000) * (inputPricePer1M ?? 0);
      const outCost = ((completionTokens ?? 0) / 1_000_000) * (outputPricePer1M ?? 0);
      return inCost + outCost;
    } catch {
      return null;
    }
  }
}

export const llmBudgetService = new LLMBudgetService();
export default llmBudgetService;
