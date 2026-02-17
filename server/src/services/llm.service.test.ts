import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMService } from './llm.service.js';
import { AppError } from '../middleware/error.middleware.js';
import { LLMError, ProviderParameterSupport } from '../types/llm.types.js';

// Store original getParameterSupport for controlled mocking
let mockGetParameterSupport: ((providerName: string, model?: string) => ProviderParameterSupport) | null = null;

// Mock llm.types to allow controlling getParameterSupport
vi.mock('../types/llm.types.js', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getParameterSupport: (providerName: string, model?: string) => {
      if (mockGetParameterSupport) {
        return mockGetParameterSupport(providerName, model);
      }
      return actual.getParameterSupport(providerName, model);
    },
  };
});

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    lLMProvider: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    lLMModel: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

// Mock OpenAI
const mockOpenAIModels = vi.fn().mockResolvedValue({ data: [{ id: 'gpt-4o-mini', object: 'model' }] });
const mockOpenAIChat = vi.fn().mockResolvedValue({
  id: 'chatcmpl-123',
  object: 'chat.completion',
  created: 1234567890,
  model: 'gpt-4o-mini',
  choices: [{
    index: 0,
    message: { role: 'assistant', content: 'Hello!' },
    finish_reason: 'stop',
  }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      models = {
        list: mockOpenAIModels,
      };
      chat = {
        completions: {
          create: mockOpenAIChat,
        },
      };
    },
  };
});

// Mock Google Generative AI
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return {
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => 'Hello from Gemini!',
          },
        }),
      };
    }
  },
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
  },
  HarmBlockThreshold: {
    BLOCK_NONE: 'BLOCK_NONE',
  },
}));

// Mock fetch for Ollama and Anthropic
const mockFetch = vi.fn();
global.fetch = mockFetch;

import prisma from '../utils/prisma.js';

describe('LLMService', () => {
  let llmService: LLMService;

  const mockProvider = {
    id: 1,
    name: 'openai',
    provider: 'openai',
    displayName: 'OpenAI',
    description: null,
    providerType: 'cloud',
    isEnabled: true,
    isDefault: true,
    priority: 100,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test-key',
    apiVersion: null,
    organizationId: null,
    projectId: null,
    defaultModel: 'gpt-4o-mini',
    defaultModelId: null,
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    defaultTopP: 1.0,
    defaultTopK: null,
    defaultFrequencyPenalty: 0,
    defaultPresencePenalty: 0,
    defaultRepeatPenalty: null,
    maxContextLength: null,
    maxOutputTokens: null,
    defaultContextLength: null,
    defaultStopSequences: null,
    defaultResponseFormat: null,
    requestTimeout: 120000,
    connectTimeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffMultiplier: 2.0,
    rateLimitRpm: null,
    rateLimitTpm: null,
    rateLimitRpd: null,
    concurrencyLimit: 5,
    supportsStreaming: true,
    defaultStreaming: false,
    supportsVision: false,
    supportsFunctionCalling: false,
    supportsJsonMode: false,
    supportsSystemMessage: true,
    supportsMultipleSystemMessages: false,
    proxyUrl: null,
    proxyUsername: null,
    proxyPassword: null,
    customHeaders: null,
    skipTlsVerify: false,
    customCaCert: null,
    healthCheckEnabled: true,
    healthCheckInterval: 60000,
    lastHealthCheck: null,
    healthStatus: 'unknown',
    lastError: null,
    consecutiveFailures: 0,
    totalRequests: 0,
    totalTokensUsed: 0,
    totalErrors: 0,
    averageLatency: null,
    metadata: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    models: [],
  };

  const mockModel = {
    id: 1,
    providerId: 1,
    modelId: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: null,
    modelType: 'chat',
    isEnabled: true,
    isDefault: true,
    contextLength: 128000,
    maxOutputTokens: 4096,
    defaultTemperature: null,
    defaultMaxTokens: null,
    defaultTopP: null,
    defaultTopK: null,
    supportsVision: false,
    supportsFunctionCalling: true,
    supportsJsonMode: true,
    supportsStreaming: true,
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.6,
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    llmService = new LLMService();
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // PROVIDER MANAGEMENT
  // ===========================================================================

  describe('getProviders', () => {
    it('should return all enabled providers', async () => {
      vi.mocked(prisma.lLMProvider.findMany).mockResolvedValue([mockProvider] as any);

      const providers = await llmService.getProviders();

      expect(providers).toHaveLength(1);
      expect(providers[0].name).toBe('openai');
      expect(prisma.lLMProvider.findMany).toHaveBeenCalledWith({
        where: { isEnabled: true },
        include: { models: true },
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      });
    });

    it('should return all providers including disabled when includeDisabled is true', async () => {
      const disabledProvider = { ...mockProvider, id: 2, name: 'gemini', provider: 'gemini', isEnabled: false };
      vi.mocked(prisma.lLMProvider.findMany).mockResolvedValue([mockProvider, disabledProvider] as any);

      const providers = await llmService.getProviders(true);

      expect(providers).toHaveLength(2);
      expect(prisma.lLMProvider.findMany).toHaveBeenCalledWith({
        where: {},
        include: { models: true },
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      });
    });

    it('should return empty array when no providers exist', async () => {
      vi.mocked(prisma.lLMProvider.findMany).mockResolvedValue([]);

      const providers = await llmService.getProviders();

      expect(providers).toHaveLength(0);
    });
  });

  describe('getProvider', () => {
    it('should return provider by name', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);

      const provider = await llmService.getProvider('openai');

      expect(provider?.name).toBe('openai');
      expect(prisma.lLMProvider.findFirst).toHaveBeenCalledWith({
        where: { name: 'openai' },
        include: { models: true },
      });
    });

    it('should return provider by ID', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);

      const provider = await llmService.getProvider(1);

      expect(provider?.id).toBe(1);
      expect(prisma.lLMProvider.findFirst).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { models: true },
      });
    });

    it('should return null when provider not found', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(null);

      const provider = await llmService.getProvider('nonexistent');

      expect(provider).toBeNull();
    });

    it('should return provider with models', async () => {
      const providerWithModels = {
        ...mockProvider,
        models: [
          {
            id: 1,
            providerId: 1,
            modelId: 'gpt-4o-mini',
            name: 'GPT-4o Mini',
            description: 'Small fast model',
            modelType: 'chat',
            isEnabled: true,
            isDefault: true,
            contextLength: 128000,
            maxOutputTokens: 4096,
            defaultTemperature: 0.7,
            costPer1kInput: 0.00015,
            costPer1kOutput: 0.0006,
            supportsVision: false,
            supportsFunctions: true,
            supportsStreaming: true,
          },
        ],
      };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(providerWithModels as any);

      const provider = await llmService.getProvider('openai');

      expect(provider?.models).toHaveLength(1);
      expect(provider?.models?.[0].modelId).toBe('gpt-4o-mini');
      expect(provider?.models?.[0].isDefault).toBe(true);
    });
  });

  describe('getDefaultProvider', () => {
    it('should return default provider when one exists', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);

      const provider = await llmService.getDefaultProvider();

      expect(provider?.isDefault).toBe(true);
      expect(prisma.lLMProvider.findFirst).toHaveBeenCalledWith({
        where: { isDefault: true, isEnabled: true },
        include: { models: true },
      });
    });

    it('should fallback to highest priority provider when no default is set', async () => {
      const fallbackProvider = { ...mockProvider, isDefault: false };
      vi.mocked(prisma.lLMProvider.findFirst)
        .mockResolvedValueOnce(null) // No default
        .mockResolvedValueOnce(fallbackProvider as any); // Fallback

      const provider = await llmService.getDefaultProvider();

      expect(provider).not.toBeNull();
      expect(prisma.lLMProvider.findFirst).toHaveBeenCalledTimes(2);
    });

    it('should return null when no providers exist', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(null);

      const provider = await llmService.getDefaultProvider();

      expect(provider).toBeNull();
    });
  });

  describe('createProvider', () => {
    it('should create a new provider successfully', async () => {
      vi.mocked(prisma.lLMProvider.count as any).mockResolvedValue(0);
      vi.mocked(prisma.lLMProvider.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.lLMProvider.create).mockResolvedValue(mockProvider as any);

      const provider = await llmService.createProvider({
        provider: 'openai',
        apiKey: 'sk-test-key',
        isEnabled: true,
      });

      expect(provider.name).toBe('openai');
      expect(prisma.lLMProvider.create).toHaveBeenCalled();
    });

    it('should throw 409 error when provider slug already exists', async () => {
      vi.mocked(prisma.lLMProvider.count as any).mockResolvedValue(0);
      vi.mocked(prisma.lLMProvider.findUnique).mockResolvedValue(mockProvider as any);

      await expect(llmService.createProvider({
        provider: 'openai',
        apiKey: 'sk-test-key',
      })).rejects.toThrow(AppError);
      await expect(llmService.createProvider({
        provider: 'openai',
        apiKey: 'sk-test-key',
      })).rejects.toThrow(/already exists/);
    });

    it('should unset other defaults when creating new default provider', async () => {
      vi.mocked(prisma.lLMProvider.count as any).mockResolvedValue(0);
      vi.mocked(prisma.lLMProvider.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.lLMProvider.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.lLMProvider.create).mockResolvedValue(mockProvider as any);

      await llmService.createProvider({
        provider: 'openai',
        apiKey: 'sk-test-key',
        isDefault: true,
      });

      expect(prisma.lLMProvider.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    });

    it('should allow two providers of same type with different name slugs', async () => {
      // First provider exists with name "openai"
      vi.mocked(prisma.lLMProvider.count as any).mockResolvedValue(1);
      vi.mocked(prisma.lLMProvider.findUnique).mockResolvedValue(null); // "openai-2" doesn't exist
      const secondProvider = { ...mockProvider, id: 2, name: 'openai-2' };
      vi.mocked(prisma.lLMProvider.create).mockResolvedValue(secondProvider as any);

      const provider = await llmService.createProvider({
        provider: 'openai',
        apiKey: 'sk-test-key-2',
        isEnabled: true,
      });

      expect(provider.name).toBe('openai-2');
      expect(prisma.lLMProvider.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'openai-2',
            provider: 'openai',
          }),
        })
      );
    });
  });

  describe('updateProvider', () => {
    it('should update provider successfully', async () => {
      const updatedProvider = { ...mockProvider, displayName: 'Updated OpenAI' };
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(updatedProvider as any);

      const provider = await llmService.updateProvider({
        id: 1,
        displayName: 'Updated OpenAI',
      });

      expect(provider.displayName).toBe('Updated OpenAI');
    });

    it('should unset other defaults when setting as default', async () => {
      vi.mocked(prisma.lLMProvider.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      await llmService.updateProvider({
        id: 1,
        isDefault: true,
      });

      expect(prisma.lLMProvider.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true, id: { not: 1 } },
        data: { isDefault: false },
      });
    });
  });

  describe('deleteProvider', () => {
    it('should delete provider successfully', async () => {
      vi.mocked(prisma.lLMProvider.delete).mockResolvedValue(mockProvider as any);

      await llmService.deleteProvider(1);

      expect(prisma.lLMProvider.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  // ===========================================================================
  // MODEL MANAGEMENT
  // ===========================================================================

  describe('getModels', () => {
    it('should return all models when no providerId specified', async () => {
      vi.mocked(prisma.lLMModel.findMany).mockResolvedValue([mockModel] as any);

      const models = await llmService.getModels();

      expect(models).toHaveLength(1);
      expect(prisma.lLMModel.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });
    });

    it('should return models for specific provider', async () => {
      vi.mocked(prisma.lLMModel.findMany).mockResolvedValue([mockModel] as any);

      const models = await llmService.getModels(1);

      expect(prisma.lLMModel.findMany).toHaveBeenCalledWith({
        where: { providerId: 1 },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });
    });
  });

  describe('createModel', () => {
    it('should create model successfully', async () => {
      vi.mocked(prisma.lLMModel.create).mockResolvedValue(mockModel as any);

      const model = await llmService.createModel({
        providerId: 1,
        modelId: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
      });

      expect(model.modelId).toBe('gpt-4o-mini');
    });

    it('should unset other defaults when creating new default model', async () => {
      vi.mocked(prisma.lLMModel.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.lLMModel.create).mockResolvedValue(mockModel as any);

      await llmService.createModel({
        providerId: 1,
        modelId: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        isDefault: true,
      });

      expect(prisma.lLMModel.updateMany).toHaveBeenCalledWith({
        where: { providerId: 1, isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe('deleteModel', () => {
    it('should delete model successfully', async () => {
      vi.mocked(prisma.lLMModel.delete).mockResolvedValue(mockModel as any);

      await llmService.deleteModel(1);

      expect(prisma.lLMModel.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  // ===========================================================================
  // HEALTH CHECK
  // ===========================================================================

  describe('testProvider', () => {
    it('should return not found when provider does not exist', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(null);

      const result = await llmService.testProvider('nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Provider not found');
    });

    it('should test OpenAI-compatible provider successfully', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const result = await llmService.testProvider('openai');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
      expect(result.latency).toBeDefined();
    });

    it('should test Ollama provider successfully', async () => {
      const ollamaProvider = { ...mockProvider, name: 'ollama', provider: 'ollama', apiKey: null, baseUrl: 'http://localhost:11434' };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(ollamaProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(ollamaProvider as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [{ name: 'llama3', size: 1000, modified_at: '2024-01-01' }] }),
      });

      const result = await llmService.testProvider('ollama');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected');
    });

    it('should handle connection timeout', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      // Override the mock functions to throw timeout error
      mockOpenAIModels.mockRejectedValueOnce(new Error('Connection timeout'));
      mockOpenAIChat.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await llmService.testProvider('openai');

      expect(result.success).toBe(false);
      expect(result.message).toContain('timeout');
    });

    it('should return API key not configured for cloud provider without key', async () => {
      const noKeyProvider = { ...mockProvider, apiKey: null };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(noKeyProvider as any);

      const result = await llmService.testProvider('openai');

      expect(result.success).toBe(false);
      expect(result.message).toBe('API key not configured');
    });
  });

  // ===========================================================================
  // CHAT COMPLETION
  // ===========================================================================

  describe('chat', () => {
    it('should route to default provider when none specified', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response.choices[0].message.content).toBe('Hello!');
      expect(response.provider).toBe('openai');
    });

    it('should route to specified provider', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'openai',
      });

      expect(response.provider).toBe('openai');
    });

    it('should throw error when no provider configured', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(null);

      await expect(llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      })).rejects.toThrow(LLMError);
    });

    it('should throw error when provider is disabled', async () => {
      const disabledProvider = { ...mockProvider, isEnabled: false };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(disabledProvider as any);

      await expect(llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'openai',
      })).rejects.toThrow(LLMError);
    });

    it('should throw error when no model specified and provider has no default', async () => {
      const noModelProvider = { ...mockProvider, defaultModel: null };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(noModelProvider as any);

      await expect(llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      })).rejects.toThrow(LLMError);
    });

    it('should accept parameters for o1 models (API handles compatibility)', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      // Parameters are passed through - API handles model compatibility
      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'o1-preview',
        temperature: 0.5,
      });

      expect(response.choices[0].message.content).toBe('Hello!');
    });

    it('should update usage statistics on successful completion', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(prisma.lLMProvider.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          totalRequests: { increment: 1 },
          totalTokensUsed: { increment: 15 },
        },
      });
    });

    it('should increment error count on failure', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      // Override the mock function to throw error
      mockOpenAIChat.mockRejectedValueOnce(new Error('API Error'));

      await expect(llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      })).rejects.toThrow();

      expect(prisma.lLMProvider.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { totalErrors: { increment: 1 } },
      });
    });

    it('should pass maxTokens for O1 models as max_completion_tokens', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'o1-mini',
        maxTokens: 1000,
      });

      // Reasoning models (o1/o3) use max_completion_tokens instead of max_tokens
      expect(mockOpenAIChat).toHaveBeenCalledWith(
        expect.objectContaining({
          max_completion_tokens: 1000,
        })
      );
      // Should NOT have temperature for reasoning models
      const callArgs = mockOpenAIChat.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('temperature');
      expect(callArgs).not.toHaveProperty('max_tokens');
    });

    it('should pass temperature to standard OpenAI models', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4',
        temperature: 0.7,
      });

      expect(mockOpenAIChat).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        })
      );
    });

    it('should pass frequencyPenalty to standard OpenAI models', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4',
        frequencyPenalty: 0.5,
      });

      expect(mockOpenAIChat).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency_penalty: 0.5,
        })
      );
    });
  });

  describe('chat with Gemini', () => {
    const geminiProvider = {
      ...mockProvider,
      id: 2,
      name: 'gemini',
      provider: 'gemini',
      displayName: 'Google Gemini',
      defaultModel: 'gemini-1.5-flash',
    };

    it('should handle Gemini chat successfully', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(geminiProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(geminiProvider as any);

      const response = await llmService.chat({
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
        ],
        provider: 'gemini',
      });

      expect(response.provider).toBe('gemini');
      expect(response.choices[0].message.content).toBe('Hello from Gemini!');
    });

    it('should pass topP, topK, and stop to Gemini', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(geminiProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(geminiProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'gemini',
        topP: 0.9,
        topK: 40,
        stop: ['END'],
      });

      expect(response.provider).toBe('gemini');
      expect(response.choices[0].message.content).toBe('Hello from Gemini!');
    });

    it('should handle multi-turn conversation with assistant messages', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(geminiProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(geminiProvider as any);

      const response = await llmService.chat({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ],
        provider: 'gemini',
      });

      expect(response.provider).toBe('gemini');
    });
  });

  describe('chat with Ollama', () => {
    const ollamaProvider = {
      ...mockProvider,
      id: 3,
      name: 'ollama',
      provider: 'ollama',
      displayName: 'Ollama',
      apiKey: null,
      baseUrl: 'http://localhost:11434',
      defaultModel: 'llama3',
      providerType: 'local',
    };

    it('should handle Ollama chat successfully', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(ollamaProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(ollamaProvider as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          message: { content: 'Hello from Ollama!' },
          done: true,
          prompt_eval_count: 10,
          eval_count: 5,
        }),
      });

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'ollama',
      });

      expect(response.provider).toBe('ollama');
      expect(response.choices[0].message.content).toBe('Hello from Ollama!');
    });

    it('should handle Ollama errors', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(ollamaProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(ollamaProvider as any);

      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Model not found'),
      });

      await expect(llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'ollama',
      })).rejects.toThrow();
    });

    it('should pass topK and repeatPenalty to Ollama', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(ollamaProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(ollamaProvider as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          message: { content: 'Response' },
          done: true,
          prompt_eval_count: 10,
          eval_count: 5,
        }),
      });

      await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'ollama',
        topK: 40,
        repeatPenalty: 1.1,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"top_k":40'),
        })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"repeat_penalty":1.1'),
        })
      );
    });

    it('should pass stop sequences to Ollama', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(ollamaProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(ollamaProvider as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          message: { content: 'Stopped' },
          done: true,
          prompt_eval_count: 10,
          eval_count: 5,
        }),
      });

      await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'ollama',
        stop: ['END', 'STOP'],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"stop"'),
        })
      );
    });

    it('should pass temperature and maxTokens to Ollama', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(ollamaProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(ollamaProvider as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          message: { content: 'Response' },
          done: true,
          prompt_eval_count: 10,
          eval_count: 5,
        }),
      });

      await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'ollama',
        temperature: 0.8,
        maxTokens: 500,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"temperature":0.8'),
        })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"num_predict":500'),
        })
      );
    });

    it('should pass topP to Ollama', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(ollamaProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(ollamaProvider as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          message: { content: 'Response' },
          done: true,
          prompt_eval_count: 10,
          eval_count: 5,
        }),
      });

      await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'ollama',
        topP: 0.95,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"top_p":0.95'),
        })
      );
    });
  });

  describe('chat with Anthropic', () => {
    const anthropicProvider = {
      ...mockProvider,
      id: 4,
      name: 'anthropic',
      provider: 'anthropic',
      displayName: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      defaultModel: 'claude-3-5-sonnet-20241022',
    };

    it('should handle Anthropic chat successfully', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(anthropicProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(anthropicProvider as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'msg_123',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ text: 'Hello from Claude!' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'anthropic',
      });

      expect(response.provider).toBe('anthropic');
      expect(response.choices[0].message.content).toBe('Hello from Claude!');
    });

    it('should handle Anthropic errors', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(anthropicProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(anthropicProvider as any);

      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      });

      await expect(llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'anthropic',
      })).rejects.toThrow('Invalid API key');
    });

    it('should pass stop sequences to Anthropic', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(anthropicProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(anthropicProvider as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'msg_123',
          model: 'claude-3-haiku-20240307',
          content: [{ type: 'text', text: 'Stopped!' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'anthropic',
        stop: ['STOP', 'END'],
      });

      expect(response.provider).toBe('anthropic');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('stop_sequences'),
        })
      );
    });

    it('should pass temperature to Anthropic', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(anthropicProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(anthropicProvider as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'msg_123',
          model: 'claude-3-haiku-20240307',
          content: [{ type: 'text', text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'anthropic',
        temperature: 0.5,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"temperature":0.5'),
        })
      );
    });

    it('should pass topP and topK to Anthropic', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(anthropicProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(anthropicProvider as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'msg_123',
          model: 'claude-3-haiku-20240307',
          content: [{ type: 'text', text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'anthropic',
        topP: 0.9,
        topK: 50,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"top_p":0.9'),
        })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"top_k":50'),
        })
      );
    });

    it('should pass system message to Anthropic', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(anthropicProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(anthropicProvider as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'msg_123',
          model: 'claude-3-haiku-20240307',
          content: [{ type: 'text', text: 'Response with system' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      await llmService.chat({
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello' },
        ],
        provider: 'anthropic',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"system":"You are a helpful assistant"'),
        })
      );
    });
  });

  // ===========================================================================
  // OLLAMA/LM STUDIO SPECIFIC
  // ===========================================================================

  describe('getOllamaModels', () => {
    it('should return list of Ollama models', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          models: [
            { name: 'llama3', size: 4000000000, modified_at: '2024-01-01' },
            { name: 'mistral', size: 3000000000, modified_at: '2024-01-02' },
          ],
        }),
      });

      const models = await llmService.getOllamaModels();

      expect(models).toHaveLength(2);
      expect(models[0].name).toBe('llama3');
    });

    it('should handle Ollama connection refused', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(llmService.getOllamaModels()).rejects.toThrow('Connection refused');
    });

    it('should throw error when Ollama returns non-ok status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(llmService.getOllamaModels()).rejects.toThrow('Failed to fetch Ollama models: 500');
    });

    it('should use custom base URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      });

      await llmService.getOllamaModels('http://custom:11434');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://custom:11434/api/tags',
        expect.any(Object)
      );
    });
  });

  describe('getLMStudioModels', () => {
    it('should return list of LM Studio models', async () => {
      // LM Studio uses OpenAI-compatible API
      // Mock the models.list to return LM Studio models
      mockOpenAIModels.mockResolvedValueOnce({
        data: [
          { id: 'local-model-1', object: 'model' },
          { id: 'local-model-2', object: 'model' },
        ],
      });

      const models = await llmService.getLMStudioModels();

      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('local-model-1');
    });
  });

  // ===========================================================================
  // SEEDING
  // ===========================================================================

  describe('seedDefaultProviders', () => {
    it('should create missing default providers', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.lLMProvider.count as any).mockResolvedValue(0);
      vi.mocked(prisma.lLMProvider.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.lLMProvider.create).mockResolvedValue(mockProvider as any);

      await llmService.seedDefaultProviders();

      expect(prisma.lLMProvider.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ provider: expect.any(String) }) })
      );
      expect(prisma.lLMProvider.create).toHaveBeenCalled();
    });

    it('should skip existing providers', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);

      await llmService.seedDefaultProviders();

      expect(prisma.lLMProvider.create).not.toHaveBeenCalled();
    });
  });

  describe('seedCommonModels', () => {
    it('should seed common models for provider', async () => {
      vi.mocked(prisma.lLMModel.upsert).mockResolvedValue(mockModel as any);

      await llmService.seedCommonModels(1, 'openai');

      expect(prisma.lLMModel.upsert).toHaveBeenCalled();
    });

    it('should handle providers with no common models', async () => {
      await llmService.seedCommonModels(1, 'unknown' as any);

      // Should not throw, just do nothing
      expect(prisma.lLMModel.upsert).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // PROVIDER TESTING - ADDITIONAL TESTS
  // ===========================================================================

  describe('testProvider - Additional Tests', () => {
    it('should test Gemini provider successfully', async () => {
      const geminiProvider = { ...mockProvider, name: 'gemini', provider: 'gemini', defaultModel: 'gemini-1.5-flash' };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(geminiProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(geminiProvider as any);

      const result = await llmService.testProvider('gemini');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
    });

    it('should return error for Gemini without API key', async () => {
      const noKeyGemini = { ...mockProvider, name: 'gemini', provider: 'gemini', apiKey: null };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(noKeyGemini as any);

      const result = await llmService.testProvider('gemini');

      expect(result.success).toBe(false);
      expect(result.message).toBe('API key not configured');
    });

    it('should test Anthropic provider successfully', async () => {
      const anthropicProvider = { ...mockProvider, name: 'anthropic', provider: 'anthropic', baseUrl: 'https://api.anthropic.com' };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(anthropicProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(anthropicProvider as any);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'msg_123', content: [{ text: 'Hello' }] }),
      });

      const result = await llmService.testProvider('anthropic');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
    });

    it('should return error for Anthropic without API key', async () => {
      const noKeyAnthropic = { ...mockProvider, name: 'anthropic', provider: 'anthropic', apiKey: null };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(noKeyAnthropic as any);

      const result = await llmService.testProvider('anthropic');

      expect(result.success).toBe(false);
      expect(result.message).toBe('API key not configured');
    });

    it('should handle Anthropic API error response', async () => {
      const anthropicProvider = { ...mockProvider, name: 'anthropic', provider: 'anthropic' };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(anthropicProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(anthropicProvider as any);

      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      });

      const result = await llmService.testProvider('anthropic');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid API key');
    });

    it('should handle Ollama error response', async () => {
      const ollamaProvider = { ...mockProvider, name: 'ollama', provider: 'ollama', apiKey: null, baseUrl: 'http://localhost:11434' };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(ollamaProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(ollamaProvider as any);

      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Service unavailable'),
      });

      const result = await llmService.testProvider('ollama');

      expect(result.success).toBe(false);
    });

    it('should test unknown provider with OpenAI-compatible fallback', async () => {
      const unknownProvider = { ...mockProvider, name: 'custom', provider: 'custom' };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(unknownProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(unknownProvider as any);

      const result = await llmService.testProvider('custom');

      // Should use OpenAI-compatible test
      expect(result.success).toBe(true);
    });

    it('should test o1 models with max_completion_tokens', async () => {
      const o1Provider = { ...mockProvider, defaultModel: 'o1-preview' };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(o1Provider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(o1Provider as any);

      // Mock models.list to fail so it falls back to completion test
      mockOpenAIModels.mockRejectedValueOnce(new Error('Not available'));

      const result = await llmService.testProvider('openai');

      expect(result.success).toBe(true);
      expect(mockOpenAIChat).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // PARAMETER VALIDATION TESTS
  // ===========================================================================

  describe('chat - Parameter Validation', () => {
    it('should pass topK through to provider', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        topK: 40,
      });

      expect(response.choices[0].message.content).toBe('Hello!');
    });

    it('should accept topK for providers that support it', async () => {
      const geminiProvider = { ...mockProvider, name: 'gemini', provider: 'gemini', defaultModel: 'gemini-1.5-flash' };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(geminiProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(geminiProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'gemini',
        topK: 40,
      });

      expect(response.provider).toBe('gemini');
    });

    it('should accept frequencyPenalty for o1 models (API handles compatibility)', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'o1-preview',
        frequencyPenalty: 0.5,
      });

      expect(response.choices[0].message.content).toBe('Hello!');
    });

    it('should accept presencePenalty for o1 models (API handles compatibility)', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'o1-preview',
        presencePenalty: 0.5,
      });

      expect(response.choices[0].message.content).toBe('Hello!');
    });

    it('should accept stop sequences for OpenAI', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        stop: ['STOP'],
      });

      expect(response.choices[0].message.content).toBe('Hello!');
    });

    it('should handle maxTokens parameter', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 100,
      });

      expect(response.choices[0].message.content).toBe('Hello!');
    });

    it('should handle topP parameter for OpenAI', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        topP: 0.9,
      });

      expect(response.choices[0].message.content).toBe('Hello!');
    });

    it('should handle presencePenalty parameter for OpenAI', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        presencePenalty: 0.5,
      });

      expect(response.choices[0].message.content).toBe('Hello!');
    });

    it('should handle temperature and maxTokens for Gemini', async () => {
      const geminiProvider = {
        id: 2,
        name: 'gemini',
        provider: 'gemini',
        type: 'gemini',
        apiKey: 'gemini-key',
        isEnabled: true,
        isDefault: true,
        baseUrl: null,
        connectTimeout: 30000,
        readTimeout: 60000,
        defaultModel: 'gemini-pro',
        retryCount: 3,
        priority: 1,
      };
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(geminiProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(geminiProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'gemini',
        temperature: 0.8,
        maxTokens: 500,
      });

      expect(response.provider).toBe('gemini');
    });

    it('should pass repeatPenalty through to provider', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        repeatPenalty: 1.1,
      });

      expect(response.choices[0].message.content).toBe('Hello!');
    });

    it('should accept stop sequences for o1 models (API handles compatibility)', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'o1-preview',
        stop: ['STOP'],
      });

      expect(response.choices[0].message.content).toBe('Hello!');
    });

    it('should accept topP for o1 models (API handles compatibility)', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'o1-preview',
        topP: 0.9,
      });

      expect(response.choices[0].message.content).toBe('Hello!');
    });

    it('should pass stream parameter through', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      });

      expect(response.choices[0].message.content).toBe('Hello!');
    });
  });

  // ===========================================================================
  // chat - OpenAI Compatible (default case)
  // ===========================================================================

  describe('chat with OpenAI-compatible provider (default case)', () => {
    const customProvider = {
      id: 3,
      name: 'custom',
      provider: 'custom',
      type: 'custom',
      apiKey: 'custom-key',
      isEnabled: true,
      isDefault: false,
      baseUrl: 'https://custom.api.example.com/v1',
      connectTimeout: 30000,
      readTimeout: 60000,
      defaultModel: 'custom-model',
      retryCount: 3,
      priority: 1,
    };

    it('should use OpenAI-compatible path for unknown/custom providers (default case)', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(customProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(customProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        provider: 'custom',
      });

      // Should use OpenAI client with custom baseUrl via default case
      expect(response.provider).toBe('custom');
      expect(response.choices[0].message.content).toBe('Hello!');
    });
  });

  // ===========================================================================
  // pullOllamaModel
  // ===========================================================================

  describe('pullOllamaModel', () => {
    it('should pull Ollama model successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      });

      await llmService.pullOllamaModel('llama2');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/pull',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'llama2' }),
        })
      );
    });

    it('should pull from custom base URL', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      });

      await llmService.pullOllamaModel('llama2', 'http://custom:11434');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://custom:11434/api/pull',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'llama2' }),
        })
      );
    });

    it('should throw error when pull fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(llmService.pullOllamaModel('invalid-model')).rejects.toThrow('Failed to pull model: 500');
    });
  });

  // ===========================================================================
  // Parameter Support Edge Cases (Dead Code Coverage)
  // ===========================================================================

  describe('validateAndMapParameters - maxTokens unsupported', () => {
    const mockProvider = {
      id: 1,
      name: 'openai',
      provider: 'openai',
      displayName: 'OpenAI',
      providerType: 'cloud',
      isEnabled: true,
      isDefault: true,
      priority: 100,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-key',
      defaultModel: 'gpt-4o-mini',
      defaultTemperature: 0.7,
      defaultMaxTokens: 2048,
      defaultTopP: 1.0,
      defaultTopK: null,
      defaultFrequencyPenalty: 0,
      defaultPresencePenalty: 0,
      defaultRepeatPenalty: null,
      requestTimeout: 120000,
      connectTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      retryBackoffMultiplier: 2.0,
      concurrencyLimit: 10,
      supportsStreaming: true,
      supportsVision: true,
      supportsFunctionCalling: true,
      supportsJsonMode: true,
      supportsSystemMessage: true,
      supportsMultipleSystemMessages: false,
      skipTlsVerify: false,
      healthCheckEnabled: true,
      healthCheckInterval: 300000,
      totalRequests: 0,
      totalTokensUsed: 0,
      totalErrors: 0,
      consecutiveFailures: 0,
    };

    afterEach(() => {
      // Reset the mock
      mockGetParameterSupport = null;
    });

    it('should pass maxTokens through regardless of parameter support config', async () => {
      // The current implementation doesn't validate parameter support
      // Parameters are passed through to the provider
      mockGetParameterSupport = () => ({
        temperature: true,
        maxTokens: false,
        topP: true,
        topK: false,
        frequencyPenalty: true,
        presencePenalty: true,
        repeatPenalty: false,
        stop: true,
      });

      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);
      vi.mocked(prisma.lLMProvider.update).mockResolvedValue(mockProvider as any);

      const response = await llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 1000,
      });

      expect(response.choices[0].message.content).toBe('Hello!');
    });
  });
});
