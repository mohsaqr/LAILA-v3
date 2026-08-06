import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The per-call output cap.
 *
 * Callers hard-code maxTokens (2000 for agent replies, 4000 for MCQ/survey
 * generation, up to 16000 for dataset analysis) and none of them consulted the
 * limits already stored against the provider and the model. The clamp lowers a
 * request to what is actually allowed — but only where a limit exists, because
 * `maxOutputTokens` is null on nearly every row today and null must not be read
 * as zero.
 */

const mockChatCreate = vi.fn();

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mockChatCreate } };
    models = { list: vi.fn().mockResolvedValue({ data: [{ id: 'gpt-4o-mini' }] }) };
  },
}));
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class { getGenerativeModel() { return {}; } },
  HarmCategory: {},
  HarmBlockThreshold: {},
}));

vi.mock('../utils/prisma.js', () => ({
  default: {
    lLMProvider: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    lLMModel: { findFirst: vi.fn() },
    // findUnique is the per-module provider routing lookup; findMany is the
    // budget caps read.
    systemSetting: { findMany: vi.fn(), findUnique: vi.fn() },
    lLMUsage: { create: vi.fn(), aggregate: vi.fn() },
  },
}));

import prisma from '../utils/prisma.js';
import { LLMService } from './llm.service.js';
import { llmBudgetService, BUDGET_SETTING_KEYS } from './llmBudget.service.js';

/** A provider row with no declared limits — the shape of nearly every row today. */
const providerRow = (over: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'openai',
  provider: 'openai',
  displayName: 'OpenAI',
  providerType: 'cloud',
  isEnabled: true,
  isDefault: true,
  priority: 100,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
  defaultModel: 'gpt-4o-mini',
  defaultTemperature: 0.7,
  defaultMaxTokens: 2048,
  defaultTopP: 1.0,
  defaultFrequencyPenalty: 0,
  defaultPresencePenalty: 0,
  maxOutputTokens: null,
  requestTimeout: 120000,
  connectTimeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  retryBackoffMultiplier: 2.0,
  concurrencyLimit: 5,
  supportsStreaming: true,
  defaultStreaming: false,
  supportsSystemMessage: true,
  healthCheckEnabled: true,
  healthCheckInterval: 60000,
  totalRequests: 0,
  totalTokensUsed: 0,
  totalErrors: 0,
  models: [],
  ...over,
});

let service: LLMService;

/** The max_tokens actually handed to the provider SDK. */
const sentMaxTokens = () => mockChatCreate.mock.calls[0]?.[0]?.max_tokens;

const ask = (maxTokens?: number) =>
  service.chat({ messages: [{ role: 'user', content: 'hi' }], maxTokens });

beforeEach(() => {
  vi.clearAllMocks();
  service = new LLMService();
  llmBudgetService.clearCache();

  vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue(null as never);
  vi.mocked(prisma.lLMUsage.aggregate).mockResolvedValue({ _sum: { totalTokens: 0 } } as never);
  vi.mocked(prisma.lLMUsage.create).mockResolvedValue({} as never);
  vi.mocked(prisma.lLMModel.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.lLMProvider.update).mockResolvedValue({} as never);
  mockChatCreate.mockResolvedValue({
    id: 'c1',
    model: 'gpt-4o-mini',
    choices: [{ index: 0, message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
});

describe('nothing shrinks unless a limit is declared', () => {
  it('passes a large request through untouched when no limits are set', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow() as never);

    await ask(16000);

    // maxOutputTokens is null on nearly every row. Null is "no limit", not 0 —
    // reading it as 0 would silently truncate every completion on the platform.
    expect(sentMaxTokens()).toBe(16000);
  });

  it('falls back to the provider default when the caller asks for nothing', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow() as never);

    await ask(undefined);

    expect(sentMaxTokens()).toBe(2048);
  });

  it('ignores a zero or negative declared limit rather than truncating to it', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow({ maxOutputTokens: 0 }) as never);

    await ask(4000);

    expect(sentMaxTokens()).toBe(4000);
  });
});

describe('a declared limit lowers the request', () => {
  it('clamps to the provider limit', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow({ maxOutputTokens: 1024 }) as never);

    await ask(16000);

    expect(sentMaxTokens()).toBe(1024);
  });

  it('clamps to the model limit, which is tighter than the provider', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(
      providerRow({
        maxOutputTokens: 8000,
        models: [{ modelId: 'gpt-4o-mini', maxOutputTokens: 512, isEnabled: true }],
      }) as never,
    );

    await ask(16000);

    expect(sentMaxTokens()).toBe(512);
  });

  it('clamps to the admin ceiling', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow() as never);
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([
      { settingKey: BUDGET_SETTING_KEYS.maxOutputPerCall, settingValue: '300' },
    ] as never);

    await ask(16000);

    expect(sentMaxTokens()).toBe(300);
  });

  it('never raises a request that is already below the limit', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow({ maxOutputTokens: 8000 }) as never);

    await ask(100);

    // The clamp is a ceiling, not a target — a short request stays short.
    expect(sentMaxTokens()).toBe(100);
  });
});

describe('the clamp is a safety rail, not a gate', () => {
  it('honours the request when the caps settings cannot be read', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow() as never);
    vi.mocked(prisma.systemSetting.findMany).mockRejectedValue(new Error('db down'));

    await ask(4000);

    // Caught inside getCaps, which returns "no caps" rather than propagating.
    expect(sentMaxTokens()).toBe(4000);
    expect(mockChatCreate).toHaveBeenCalled();
  });

  it('honours the request when the clamp itself throws', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow() as never);
    // Reaches the clamp's OWN catch, past getCaps's internal one. Without this
    // the test above passes even with the clamp's try/catch deleted, because
    // the error never gets that far — the guard would be untested.
    const getCaps = vi.spyOn(llmBudgetService, 'getCaps').mockRejectedValue(new Error('boom'));

    await ask(4000);

    expect(sentMaxTokens()).toBe(4000);
    expect(mockChatCreate).toHaveBeenCalled();
    getCaps.mockRestore();
  });

  it('still answers when the usage row cannot be written', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow() as never);
    vi.mocked(prisma.lLMUsage.create).mockRejectedValue(new Error('write failed'));

    const res = await ask(100);

    // Metering is bookkeeping about a call that already succeeded.
    expect(res.choices[0].message.content).toBe('hi');
  });
});

describe('metering', () => {
  it('records the call with the tokens the provider reported', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow() as never);

    await service.chat({
      messages: [{ role: 'user', content: 'hi' }],
      module: 'tutor',
      billing: { userId: 42, courseId: 7 },
    });

    const data = vi.mocked(prisma.lLMUsage.create).mock.calls[0][0].data as Record<string, unknown>;
    expect(data).toMatchObject({
      userId: 42,
      courseId: 7,
      module: 'tutor',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      source: 'llm_service',
    });
  });

  it('marks the row when the request was clamped', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow({ maxOutputTokens: 1024 }) as never);

    await ask(16000);

    const data = vi.mocked(prisma.lLMUsage.create).mock.calls[0][0].data as Record<string, unknown>;
    expect(data).toMatchObject({ clamped: true, requestedMaxTokens: 16000, grantedMaxTokens: 1024 });
  });

  it('does not mark an unclamped call as clamped', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow() as never);

    await ask(100);

    const data = vi.mocked(prisma.lLMUsage.create).mock.calls[0][0].data as Record<string, unknown>;
    expect(data.clamped).toBe(false);
  });

  it('leaves billing null when the caller does not say who to bill', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow() as never);

    await ask(100);

    // Existing callers pass nothing and must keep working; the call is simply
    // counted against the platform total and no one else.
    const data = vi.mocked(prisma.lLMUsage.create).mock.calls[0][0].data as Record<string, unknown>;
    expect(data.userId).toBeNull();
    expect(data.courseId).toBeNull();
  });
});

describe('a cap refuses the call before it costs anything', () => {
  it('does not reach the provider when the user is over their cap', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow() as never);
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([
      { settingKey: BUDGET_SETTING_KEYS.userMonthly, settingValue: '1000' },
    ] as never);
    vi.mocked(prisma.lLMUsage.aggregate).mockResolvedValue({ _sum: { totalTokens: 5000 } } as never);

    await expect(
      service.chat({ messages: [{ role: 'user', content: 'hi' }], billing: { userId: 42 } }),
    ).rejects.toThrow(/allowance/i);

    // The point of a pre-call check: the tokens are never spent.
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it('lets the call through when no cap is configured', async () => {
    vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerRow() as never);
    vi.mocked(prisma.lLMUsage.aggregate).mockResolvedValue({ _sum: { totalTokens: 9_999_999 } } as never);

    await service.chat({ messages: [{ role: 'user', content: 'hi' }], billing: { userId: 42 } });

    expect(mockChatCreate).toHaveBeenCalled();
  });
});
