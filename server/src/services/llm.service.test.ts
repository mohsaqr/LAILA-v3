import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMService } from './llm.service.js';
import { AppError } from '../middleware/error.middleware.js';
import { LLMError } from '../types/llm.types.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    lLMProvider: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
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
      const disabledProvider = { ...mockProvider, id: 2, name: 'gemini', isEnabled: false };
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
      vi.mocked(prisma.lLMProvider.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.lLMProvider.create).mockResolvedValue(mockProvider as any);

      const provider = await llmService.createProvider({
        name: 'openai',
        apiKey: 'sk-test-key',
        isEnabled: true,
      });

      expect(provider.name).toBe('openai');
      expect(prisma.lLMProvider.create).toHaveBeenCalled();
    });

    it('should throw 409 error when provider already exists', async () => {
      vi.mocked(prisma.lLMProvider.findUnique).mockResolvedValue(mockProvider as any);

      await expect(llmService.createProvider({
        name: 'openai',
        apiKey: 'sk-test-key',
      })).rejects.toThrow(AppError);
      await expect(llmService.createProvider({
        name: 'openai',
        apiKey: 'sk-test-key',
      })).rejects.toThrow(/already exists/);
    });

    it('should unset other defaults when creating new default provider', async () => {
      vi.mocked(prisma.lLMProvider.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.lLMProvider.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.lLMProvider.create).mockResolvedValue(mockProvider as any);

      await llmService.createProvider({
        name: 'openai',
        apiKey: 'sk-test-key',
        isDefault: true,
      });

      expect(prisma.lLMProvider.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
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
      const ollamaProvider = { ...mockProvider, name: 'ollama', apiKey: null, baseUrl: 'http://localhost:11434' };
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

    it('should reject unsupported parameters for o1/o3 models', async () => {
      vi.mocked(prisma.lLMProvider.findFirst).mockResolvedValue(mockProvider as any);

      await expect(llmService.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'o1-preview',
        temperature: 0.5, // Not supported for o1 models
      })).rejects.toThrow(LLMError);
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
  });

  describe('chat with Gemini', () => {
    const geminiProvider = {
      ...mockProvider,
      id: 2,
      name: 'gemini',
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
  });

  describe('chat with Ollama', () => {
    const ollamaProvider = {
      ...mockProvider,
      id: 3,
      name: 'ollama',
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
  });

  describe('chat with Anthropic', () => {
    const anthropicProvider = {
      ...mockProvider,
      id: 4,
      name: 'anthropic',
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
      vi.mocked(prisma.lLMProvider.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.lLMProvider.create).mockResolvedValue(mockProvider as any);

      await llmService.seedDefaultProviders();

      expect(prisma.lLMProvider.findUnique).toHaveBeenCalled();
      expect(prisma.lLMProvider.create).toHaveBeenCalled();
    });

    it('should skip existing providers', async () => {
      vi.mocked(prisma.lLMProvider.findUnique).mockResolvedValue(mockProvider as any);

      await llmService.seedDefaultProviders();

      expect(prisma.lLMProvider.create).not.toHaveBeenCalled();
    });
  });
});
