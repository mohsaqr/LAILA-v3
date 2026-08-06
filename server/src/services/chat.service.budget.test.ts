import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The one property that makes a cap real on this path.
 *
 * `chat.service` calls the unified LLM service inside a try, and its catch
 * retries through a direct provider SDK. That is right for a provider outage
 * and wrong for a budget decision: applied to a cap, the retry would make the
 * very call the cap just refused, so the limit would silently do nothing.
 */

const { mockOpenAICreate } = vi.hoisted(() => ({
  mockOpenAICreate: vi.fn().mockResolvedValue({
    id: 'c1',
    model: 'gpt-4o-mini',
    choices: [{ index: 0, message: { role: 'assistant', content: 'legacy reply' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  }),
}));

vi.mock('../utils/prisma.js', () => ({
  default: {
    apiConfiguration: { findMany: vi.fn().mockResolvedValue([]) },
    chatLog: { create: vi.fn().mockResolvedValue({}), findFirst: vi.fn(), findMany: vi.fn() },
    chatbot: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock('openai', () => ({
  default: class { chat = { completions: { create: mockOpenAICreate } }; },
}));
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class { getGenerativeModel() { return { generateContent: vi.fn() }; } },
}));

vi.mock('./llm.service.js', () => ({
  llmService: { chat: vi.fn(), getDefaultProvider: vi.fn() },
}));

vi.mock('./llmBudget.service.js', async (importOriginal) => {
  // Keep the real LLMBudgetError and isBudgetError — the whole point is that
  // the distinction between a budget refusal and any other failure survives.
  const actual = await importOriginal<typeof import('./llmBudget.service.js')>();
  return {
    ...actual,
    llmBudgetService: { assert: vi.fn(), record: vi.fn(), check: vi.fn() },
  };
});

import { ChatService } from './chat.service.js';
import { llmService } from './llm.service.js';
import { llmBudgetService, LLMBudgetError } from './llmBudget.service.js';

const budgetError = () =>
  new LLMBudgetError('Your monthly AI allowance is used up.', 'user', 1000, 1000, new Date('2026-09-01'));

let service: ChatService;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = 'sk-test';
  service = new ChatService();
  vi.mocked(llmBudgetService.assert).mockResolvedValue({ allowed: true } as never);
  vi.mocked(llmBudgetService.record).mockResolvedValue(undefined as never);
});

describe('a budget refusal is not retried through the legacy path', () => {
  it('surfaces the refusal instead of falling back', async () => {
    vi.mocked(llmService.chat).mockRejectedValue(budgetError());

    await expect(service.chat({ message: 'hi', module: 'chat' } as never, 42))
      .rejects.toThrow(/allowance/i);

    // The whole point: the tokens are not spent by the retry.
    expect(mockOpenAICreate).not.toHaveBeenCalled();
  });

  it('still falls back when the provider genuinely fails', async () => {
    vi.mocked(llmService.chat).mockRejectedValue(new Error('ECONNRESET'));

    const res = await service.chat({ message: 'hi', module: 'chat' } as never, 42);

    // The fallback must keep working for what it was built for.
    expect(res.reply).toBe('legacy reply');
    expect(mockOpenAICreate).toHaveBeenCalled();
  });
});

describe('the legacy path is metered too', () => {
  it('checks the cap before calling the provider directly', async () => {
    vi.mocked(llmService.chat).mockRejectedValue(new Error('ECONNRESET'));
    vi.mocked(llmBudgetService.assert).mockRejectedValue(budgetError());

    await expect(service.chat({ message: 'hi', module: 'chat' } as never, 42))
      .rejects.toThrow(/allowance/i);

    // A user over their limit must not be served just because the unified
    // service happened to be unavailable.
    expect(mockOpenAICreate).not.toHaveBeenCalled();
  });

  it('records what the legacy call spent, tagged as the legacy path', async () => {
    vi.mocked(llmService.chat).mockRejectedValue(new Error('ECONNRESET'));

    await service.chat({ message: 'hi', module: 'chat' } as never, 42);

    // Without a source tag there is no way to know how much traffic still
    // bypasses the unified service.
    expect(llmBudgetService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        source: 'chat_legacy',
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      }),
    );
  });
});

describe('attribution on the unified path', () => {
  it('tells the LLM service who to bill', async () => {
    vi.mocked(llmService.chat).mockResolvedValue({
      choices: [{ index: 0, message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
      model: 'gpt-4o-mini',
      responseTime: 100,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    } as never);

    await service.chat({ message: 'hi', module: 'chat' } as never, 42);

    expect(vi.mocked(llmService.chat).mock.calls[0][0]).toMatchObject({ billing: { userId: 42 } });
  });

  it('does not double-record what the unified path already recorded', async () => {
    vi.mocked(llmService.chat).mockResolvedValue({
      choices: [{ index: 0, message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
      model: 'gpt-4o-mini',
      responseTime: 100,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    } as never);

    await service.chat({ message: 'hi', module: 'chat' } as never, 42);

    // llmService.chat writes its own usage row; a second one here would charge
    // the same call to the same caps twice.
    expect(llmBudgetService.record).not.toHaveBeenCalled();
  });
});
