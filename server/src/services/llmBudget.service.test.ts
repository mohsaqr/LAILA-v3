import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/prisma.js', () => ({
  default: {
    systemSetting: { findMany: vi.fn() },
    lLMUsage: { aggregate: vi.fn(), create: vi.fn() },
    lLMModel: { findFirst: vi.fn() },
  },
}));

import prisma from '../utils/prisma.js';
import {
  LLMBudgetService,
  LLMBudgetError,
  isBudgetError,
  BUDGET_SETTING_KEYS,
  monthStart,
  monthEnd,
} from './llmBudget.service.js';

const setCaps = (caps: Record<string, string | null>) => {
  vi.mocked(prisma.systemSetting.findMany).mockResolvedValue(
    Object.entries(caps).map(([settingKey, settingValue]) => ({ settingKey, settingValue })) as never,
  );
};

const setUsed = (tokens: number) => {
  vi.mocked(prisma.lLMUsage.aggregate).mockResolvedValue({ _sum: { totalTokens: tokens } } as never);
};

let service: LLMBudgetService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new LLMBudgetService(); // fresh cap cache per test
  setCaps({});
  setUsed(0);
  vi.mocked(prisma.lLMUsage.create).mockResolvedValue({} as never);
});

describe('an unset cap means unlimited', () => {
  it('allows a call when nothing is configured', async () => {
    setCaps({});
    setUsed(999_999_999);

    // Deploying this feature must change nothing until an admin sets a number.
    await expect(service.check({ userId: 1 })).resolves.toEqual({ allowed: true });
  });

  it('does not even count usage when no cap exists', async () => {
    setCaps({});
    await service.check({ userId: 1, courseId: 3 });

    // The aggregate is the expensive part; skipping it keeps the disabled
    // feature free rather than adding a query to every LLM call.
    expect(prisma.lLMUsage.aggregate).not.toHaveBeenCalled();
  });

  it.each([
    ['a blank value', ''],
    ['whitespace', '   '],
    ['a non-number', 'lots'],
    ['zero', '0'],
    ['a negative', '-5'],
    ['null', null],
  ])('treats %s as unlimited rather than as "block everything"', async (_label, value) => {
    setCaps({ [BUDGET_SETTING_KEYS.userMonthly]: value });
    setUsed(1_000_000);

    // An admin clearing a field, or a half-written row, must never be able to
    // switch the whole platform off.
    await expect(service.check({ userId: 1 })).resolves.toEqual({ allowed: true });
  });
});

describe('it fails open', () => {
  it('allows the call when the settings table cannot be read', async () => {
    vi.mocked(prisma.systemSetting.findMany).mockRejectedValue(new Error('db down'));

    await expect(service.check({ userId: 1 })).resolves.toEqual({ allowed: true });
  });

  it('allows the call when the usage table cannot be read', async () => {
    setCaps({ [BUDGET_SETTING_KEYS.userMonthly]: '1000' });
    vi.mocked(prisma.lLMUsage.aggregate).mockRejectedValue(new Error('no such table'));

    // A metering fault must not stop every student from talking to a tutor.
    await expect(service.check({ userId: 1 })).resolves.toEqual({ allowed: true });
  });

  it('never throws out of record()', async () => {
    vi.mocked(prisma.lLMUsage.create).mockRejectedValue(new Error('write failed'));

    // The call already happened; losing the row must not turn a completed
    // answer into an error the student sees.
    await expect(service.record({ userId: 1, totalTokens: 10 })).resolves.toBeUndefined();
  });

  it('assert() does not throw when the check fails open', async () => {
    vi.mocked(prisma.systemSetting.findMany).mockRejectedValue(new Error('db down'));

    await expect(service.assert({ userId: 1 })).resolves.toEqual({ allowed: true });
  });
});

describe('blocking', () => {
  it('blocks once a user is at their cap', async () => {
    setCaps({ [BUDGET_SETTING_KEYS.userMonthly]: '1000' });
    setUsed(1000);

    const verdict = await service.check({ userId: 1 });
    expect(verdict.allowed).toBe(false);
    expect(verdict.blocked).toMatchObject({ scope: 'user', used: 1000, cap: 1000 });
  });

  it('allows a user just under the cap', async () => {
    setCaps({ [BUDGET_SETTING_KEYS.userMonthly]: '1000' });
    setUsed(999);

    expect((await service.check({ userId: 1 })).allowed).toBe(true);
  });

  it('reports the user scope before the platform scope', async () => {
    setCaps({
      [BUDGET_SETTING_KEYS.userMonthly]: '1000',
      [BUDGET_SETTING_KEYS.globalMonthly]: '1000',
    });
    setUsed(5000);

    // "You are out of budget" is actionable; "the platform is out" is not.
    expect((await service.check({ userId: 1 })).blocked?.scope).toBe('user');
  });

  it('skips a scope whose id is unknown rather than billing it to id 0', async () => {
    setCaps({ [BUDGET_SETTING_KEYS.courseMonthly]: '100' });
    setUsed(5000);

    // Generic chat and AI tools carry no courseId; they are not "course 0".
    expect((await service.check({ userId: 1, courseId: null })).allowed).toBe(true);
  });

  it('still applies the global cap to a call with no user or course', async () => {
    setCaps({ [BUDGET_SETTING_KEYS.globalMonthly]: '100' });
    setUsed(500);

    const verdict = await service.check({});
    expect(verdict.allowed).toBe(false);
    expect(verdict.blocked?.scope).toBe('global');
  });

  it('throws a typed, recognisable error from assert()', async () => {
    setCaps({ [BUDGET_SETTING_KEYS.userMonthly]: '1000' });
    setUsed(1000);

    const err = await service.assert({ userId: 1 }).catch(e => e);
    expect(err).toBeInstanceOf(LLMBudgetError);
    expect(isBudgetError(err)).toBe(true);
    expect(err.statusCode).toBe(429);
    // The message has to say what ran out and when it comes back.
    expect(err.message).toMatch(/1,000/);
    expect(err.message).toMatch(/resets on \d{4}-\d{2}-\d{2}/);
  });

  it('distinguishes a budget refusal from an ordinary failure', async () => {
    // chat.service retries through a direct provider SDK on any error from the
    // unified path. If a budget refusal were indistinguishable, that retry
    // would make the blocked call anyway and the cap would do nothing.
    expect(isBudgetError(new Error('connection reset'))).toBe(false);
  });
});

describe('warning at 80%', () => {
  it('warns but still allows at the threshold', async () => {
    setCaps({ [BUDGET_SETTING_KEYS.userMonthly]: '1000' });
    setUsed(800);

    const verdict = await service.check({ userId: 1 });
    expect(verdict.allowed).toBe(true);
    expect(verdict.warning).toMatchObject({ scope: 'user', used: 800, cap: 1000 });
  });

  it('stays quiet below the threshold', async () => {
    setCaps({ [BUDGET_SETTING_KEYS.userMonthly]: '1000' });
    setUsed(799);

    const verdict = await service.check({ userId: 1 });
    expect(verdict.allowed).toBe(true);
    expect(verdict.warning).toBeUndefined();
  });

  it('reports whichever scope is closest to its limit', async () => {
    setCaps({
      [BUDGET_SETTING_KEYS.userMonthly]: '1000',
      [BUDGET_SETTING_KEYS.globalMonthly]: '1000',
    });
    // 850/1000 for the user scope; the global scope reads the same mocked sum,
    // so the tie is resolved by "first strictly greater" and stays on user.
    setUsed(850);

    expect((await service.check({ userId: 1 })).warning?.scope).toBe('user');
  });
});

describe('recording', () => {
  it('keeps an absent token count absent instead of calling it zero', async () => {
    await service.record({ userId: 1, model: 'gemini-pro' });

    // agentAssignment's Gemini path reports no usage at all. Writing 0 would
    // make that traffic look free in the very report meant to expose it.
    const arg = vi.mocked(prisma.lLMUsage.create).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.totalTokens).toBeNull();
    expect(arg.data.usageMissing).toBe(true);
  });

  it('derives a total from the two halves when the provider omits it', async () => {
    await service.record({ userId: 1, promptTokens: 30, completionTokens: 12 });

    const arg = vi.mocked(prisma.lLMUsage.create).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.totalTokens).toBe(42);
    expect(arg.data.usageMissing).toBe(false);
  });

  it('records which code path spent the tokens', async () => {
    await service.record({ userId: 1, totalTokens: 5, source: 'chat_legacy' });

    // Makes it measurable how much traffic still bypasses the unified service.
    const arg = vi.mocked(prisma.lLMUsage.create).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.source).toBe('chat_legacy');
  });
});

describe('cost', () => {
  it('returns null when the model has no prices, rather than zero', async () => {
    vi.mocked(prisma.lLMModel.findFirst).mockResolvedValue({
      inputPricePer1M: null, outputPricePer1M: null,
    } as never);

    // Local models (Ollama, vLLM) have no price. Unknown is not free.
    await expect(service.estimateCostUsd({ providerId: 1, model: 'llama3' }, 100, 100)).resolves.toBeNull();
  });

  it('prices input and output separately', async () => {
    vi.mocked(prisma.lLMModel.findFirst).mockResolvedValue({
      inputPricePer1M: 3, outputPricePer1M: 15,
    } as never);

    // 1M in at $3 + 1M out at $15
    await expect(
      service.estimateCostUsd({ providerId: 1, model: 'claude' }, 1_000_000, 1_000_000),
    ).resolves.toBeCloseTo(18, 6);
  });

  it('returns null when the model is unknown', async () => {
    vi.mocked(prisma.lLMModel.findFirst).mockResolvedValue(null as never);

    await expect(service.estimateCostUsd({ providerId: 1, model: 'mystery' }, 10, 10)).resolves.toBeNull();
  });
});

describe('the month window', () => {
  it('starts on the first of the month in UTC', () => {
    const start = monthStart(new Date('2026-08-06T18:00:00Z'));
    expect(start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('resets at the start of the next month', () => {
    expect(monthEnd(new Date('2026-08-06T18:00:00Z')).toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('rolls the year over in December', () => {
    expect(monthEnd(new Date('2026-12-20T00:00:00Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});
