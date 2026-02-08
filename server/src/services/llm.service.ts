// =============================================================================
// LLM PROVIDER SERVICE - Multi-Provider AI Integration
// =============================================================================

import OpenAI from 'openai';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import {
  LLMProviderConfig,
  LLMModelConfig,
  LLMProviderName,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMMessage,
  LLMUsage,
  LLMError,
  PROVIDER_DEFAULTS,
  COMMON_MODELS,
  LLMProviderCreateInput,
  LLMProviderUpdateInput,
  LLMModelCreateInput,
  getParameterSupport,
  ProviderParameterSupport,
  PROVIDER_DISPLAY_NAMES,
} from '../types/llm.types.js';

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

interface OllamaTagsResponse {
  models?: Array<{ name: string; size: number; modified_at: string }>;
}

interface OllamaChatResponse {
  message?: { content: string };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface AnthropicErrorResponse {
  error?: { message: string };
}

interface AnthropicChatResponse {
  id: string;
  model: string;
  content?: Array<{ text: string }>;
  stop_reason?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// =============================================================================
// LLM SERVICE CLASS
// =============================================================================

export class LLMService {
  private providerCache: Map<string, LLMProviderConfig> = new Map();
  private clientCache: Map<string, OpenAI | GoogleGenerativeAI> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastCacheRefresh: number = 0;

  // ===========================================================================
  // PROVIDER MANAGEMENT
  // ===========================================================================

  async getProviders(includeDisabled = false): Promise<LLMProviderConfig[]> {
    const providers = await prisma.lLMProvider.findMany({
      where: includeDisabled ? {} : { isEnabled: true },
      include: { models: true },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });

    return providers.map((p) => this.mapProviderFromDb(p));
  }

  async getProvider(nameOrId: string | number): Promise<LLMProviderConfig | null> {
    const provider = await prisma.lLMProvider.findFirst({
      where: typeof nameOrId === 'number'
        ? { id: nameOrId }
        : { name: nameOrId },
      include: { models: true },
    });

    return provider ? this.mapProviderFromDb(provider) : null;
  }

  async getDefaultProvider(): Promise<LLMProviderConfig | null> {
    const provider = await prisma.lLMProvider.findFirst({
      where: { isDefault: true, isEnabled: true },
      include: { models: true },
    });

    if (provider) {
      return this.mapProviderFromDb(provider);
    }

    // Fallback to highest priority enabled provider
    const fallback = await prisma.lLMProvider.findFirst({
      where: { isEnabled: true },
      orderBy: { priority: 'desc' },
      include: { models: true },
    });

    return fallback ? this.mapProviderFromDb(fallback) : null;
  }

  async createProvider(input: LLMProviderCreateInput): Promise<LLMProviderConfig> {
    const defaults = PROVIDER_DEFAULTS[input.name] || {};

    // Check if provider with this name already exists
    const existing = await prisma.lLMProvider.findUnique({
      where: { name: input.name },
    });
    if (existing) {
      throw new AppError(`Provider "${input.name}" already exists. Use the existing provider or choose a different name.`, 409);
    }

    // If setting as default, unset other defaults
    if (input.isDefault) {
      await prisma.lLMProvider.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const provider = await prisma.lLMProvider.create({
      data: {
        name: input.name,
        displayName: input.displayName || defaults.displayName || input.name,
        description: input.description,
        providerType: defaults.providerType || 'cloud',
        isEnabled: input.isEnabled ?? false,
        isDefault: input.isDefault ?? false,
        priority: input.priority ?? 0,
        baseUrl: input.baseUrl || defaults.baseUrl,
        apiKey: input.apiKey,
        apiVersion: input.apiVersion,
        organizationId: input.organizationId,
        projectId: input.projectId,
        defaultModel: input.defaultModel || defaults.defaultModel,
        defaultTemperature: input.defaultTemperature ?? defaults.defaultTemperature ?? 0.7,
        defaultMaxTokens: input.defaultMaxTokens ?? defaults.defaultMaxTokens ?? 2048,
        defaultTopP: input.defaultTopP ?? defaults.defaultTopP ?? 1.0,
        defaultTopK: input.defaultTopK ?? defaults.defaultTopK,
        defaultFrequencyPenalty: input.defaultFrequencyPenalty ?? defaults.defaultFrequencyPenalty ?? 0,
        defaultPresencePenalty: input.defaultPresencePenalty ?? defaults.defaultPresencePenalty ?? 0,
        defaultRepeatPenalty: input.defaultRepeatPenalty ?? defaults.defaultRepeatPenalty,
        maxContextLength: input.maxContextLength,
        maxOutputTokens: input.maxOutputTokens,
        defaultStopSequences: input.defaultStopSequences ? JSON.stringify(input.defaultStopSequences) : null,
        defaultResponseFormat: input.defaultResponseFormat,
        requestTimeout: input.requestTimeout ?? defaults.requestTimeout ?? 120000,
        connectTimeout: input.connectTimeout ?? defaults.connectTimeout ?? 30000,
        maxRetries: input.maxRetries ?? defaults.maxRetries ?? 3,
        retryDelay: input.retryDelay ?? defaults.retryDelay ?? 1000,
        retryBackoffMultiplier: input.retryBackoffMultiplier ?? defaults.retryBackoffMultiplier ?? 2.0,
        rateLimitRpm: input.rateLimitRpm,
        rateLimitTpm: input.rateLimitTpm,
        rateLimitRpd: input.rateLimitRpd,
        concurrencyLimit: input.concurrencyLimit ?? defaults.concurrencyLimit ?? 5,
        supportsStreaming: defaults.supportsStreaming ?? true,
        defaultStreaming: input.defaultStreaming ?? defaults.defaultStreaming ?? false,
        supportsVision: defaults.supportsVision ?? false,
        supportsFunctionCalling: defaults.supportsFunctionCalling ?? false,
        supportsJsonMode: defaults.supportsJsonMode ?? false,
        supportsSystemMessage: defaults.supportsSystemMessage ?? true,
        supportsMultipleSystemMessages: defaults.supportsMultipleSystemMessages ?? false,
        proxyUrl: input.proxyUrl,
        proxyUsername: input.proxyUsername,
        proxyPassword: input.proxyPassword,
        customHeaders: input.customHeaders ? JSON.stringify(input.customHeaders) : null,
        skipTlsVerify: input.skipTlsVerify ?? defaults.skipTlsVerify ?? false,
        customCaCert: input.customCaCert,
        healthCheckEnabled: input.healthCheckEnabled ?? true,
        healthCheckInterval: input.healthCheckInterval ?? 60000,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        notes: input.notes,
      },
      include: { models: true },
    });

    this.clearCache();
    return this.mapProviderFromDb(provider);
  }

  async updateProvider(input: LLMProviderUpdateInput): Promise<LLMProviderConfig> {
    // If setting as default, unset other defaults
    if (input.isDefault) {
      await prisma.lLMProvider.updateMany({
        where: { isDefault: true, id: { not: input.id } },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};

    // Only include fields that are provided
    if (input.displayName !== undefined) updateData.displayName = input.displayName;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.baseUrl !== undefined) updateData.baseUrl = input.baseUrl;
    if (input.apiKey !== undefined) updateData.apiKey = input.apiKey;
    if (input.apiVersion !== undefined) updateData.apiVersion = input.apiVersion;
    if (input.organizationId !== undefined) updateData.organizationId = input.organizationId;
    if (input.projectId !== undefined) updateData.projectId = input.projectId;
    if (input.defaultModel !== undefined) updateData.defaultModel = input.defaultModel;
    if (input.defaultTemperature !== undefined) updateData.defaultTemperature = input.defaultTemperature;
    if (input.defaultMaxTokens !== undefined) updateData.defaultMaxTokens = input.defaultMaxTokens;
    if (input.defaultTopP !== undefined) updateData.defaultTopP = input.defaultTopP;
    if (input.defaultTopK !== undefined) updateData.defaultTopK = input.defaultTopK;
    if (input.defaultFrequencyPenalty !== undefined) updateData.defaultFrequencyPenalty = input.defaultFrequencyPenalty;
    if (input.defaultPresencePenalty !== undefined) updateData.defaultPresencePenalty = input.defaultPresencePenalty;
    if (input.defaultRepeatPenalty !== undefined) updateData.defaultRepeatPenalty = input.defaultRepeatPenalty;
    if (input.maxContextLength !== undefined) updateData.maxContextLength = input.maxContextLength;
    if (input.maxOutputTokens !== undefined) updateData.maxOutputTokens = input.maxOutputTokens;
    if (input.defaultStopSequences !== undefined) updateData.defaultStopSequences = JSON.stringify(input.defaultStopSequences);
    if (input.defaultResponseFormat !== undefined) updateData.defaultResponseFormat = input.defaultResponseFormat;
    if (input.requestTimeout !== undefined) updateData.requestTimeout = input.requestTimeout;
    if (input.connectTimeout !== undefined) updateData.connectTimeout = input.connectTimeout;
    if (input.maxRetries !== undefined) updateData.maxRetries = input.maxRetries;
    if (input.retryDelay !== undefined) updateData.retryDelay = input.retryDelay;
    if (input.retryBackoffMultiplier !== undefined) updateData.retryBackoffMultiplier = input.retryBackoffMultiplier;
    if (input.rateLimitRpm !== undefined) updateData.rateLimitRpm = input.rateLimitRpm;
    if (input.rateLimitTpm !== undefined) updateData.rateLimitTpm = input.rateLimitTpm;
    if (input.rateLimitRpd !== undefined) updateData.rateLimitRpd = input.rateLimitRpd;
    if (input.concurrencyLimit !== undefined) updateData.concurrencyLimit = input.concurrencyLimit;
    if (input.defaultStreaming !== undefined) updateData.defaultStreaming = input.defaultStreaming;
    if (input.proxyUrl !== undefined) updateData.proxyUrl = input.proxyUrl;
    if (input.proxyUsername !== undefined) updateData.proxyUsername = input.proxyUsername;
    if (input.proxyPassword !== undefined) updateData.proxyPassword = input.proxyPassword;
    if (input.customHeaders !== undefined) updateData.customHeaders = JSON.stringify(input.customHeaders);
    if (input.skipTlsVerify !== undefined) updateData.skipTlsVerify = input.skipTlsVerify;
    if (input.customCaCert !== undefined) updateData.customCaCert = input.customCaCert;
    if (input.healthCheckEnabled !== undefined) updateData.healthCheckEnabled = input.healthCheckEnabled;
    if (input.healthCheckInterval !== undefined) updateData.healthCheckInterval = input.healthCheckInterval;
    if (input.metadata !== undefined) updateData.metadata = JSON.stringify(input.metadata);
    if (input.notes !== undefined) updateData.notes = input.notes;

    const provider = await prisma.lLMProvider.update({
      where: { id: input.id },
      data: updateData,
      include: { models: true },
    });

    this.clearCache();
    return this.mapProviderFromDb(provider);
  }

  async deleteProvider(id: number): Promise<void> {
    await prisma.lLMProvider.delete({ where: { id } });
    this.clearCache();
  }

  // ===========================================================================
  // MODEL MANAGEMENT
  // ===========================================================================

  async getModels(providerId?: number): Promise<LLMModelConfig[]> {
    const models = await prisma.lLMModel.findMany({
      where: providerId ? { providerId } : {},
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    return models.map((m) => this.mapModelFromDb(m));
  }

  async createModel(input: LLMModelCreateInput): Promise<LLMModelConfig> {
    if (input.isDefault) {
      await prisma.lLMModel.updateMany({
        where: { providerId: input.providerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const model = await prisma.lLMModel.create({
      data: {
        providerId: input.providerId,
        modelId: input.modelId,
        name: input.name,
        description: input.description,
        modelType: input.modelType || 'chat',
        isEnabled: input.isEnabled ?? true,
        isDefault: input.isDefault ?? false,
        contextLength: input.contextLength,
        maxOutputTokens: input.maxOutputTokens,
        defaultTemperature: input.defaultTemperature,
        defaultMaxTokens: input.defaultMaxTokens,
        defaultTopP: input.defaultTopP,
        defaultTopK: input.defaultTopK,
        supportsVision: input.supportsVision ?? false,
        supportsFunctionCalling: input.supportsFunctionCalling ?? false,
        supportsJsonMode: input.supportsJsonMode ?? false,
        supportsStreaming: input.supportsStreaming ?? true,
        inputPricePer1M: input.inputPricePer1M,
        outputPricePer1M: input.outputPricePer1M,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });

    return this.mapModelFromDb(model);
  }

  async deleteModel(id: number): Promise<void> {
    await prisma.lLMModel.delete({ where: { id } });
  }

  async seedCommonModels(providerId: number, providerName: LLMProviderName): Promise<void> {
    const commonModels = COMMON_MODELS[providerName] || [];

    for (let i = 0; i < commonModels.length; i++) {
      const model = commonModels[i];
      await prisma.lLMModel.upsert({
        where: {
          providerId_modelId: {
            providerId,
            modelId: model.modelId,
          },
        },
        create: {
          providerId,
          modelId: model.modelId,
          name: model.name,
          contextLength: model.contextLength,
          isDefault: i === 0,
          isEnabled: true,
        },
        update: {
          name: model.name,
          contextLength: model.contextLength,
        },
      });
    }
  }

  // ===========================================================================
  // HEALTH CHECK
  // ===========================================================================

  async testProvider(nameOrId: string | number): Promise<{ success: boolean; message: string; latency?: number }> {
    const provider = await this.getProvider(nameOrId);

    if (!provider) {
      return { success: false, message: 'Provider not found' };
    }

    const startTime = Date.now();

    try {
      switch (provider.name) {
        case 'openai':
        case 'azure-openai':
        case 'openrouter':
        case 'together':
        case 'groq':
        case 'mistral':
        case 'lmstudio':
          return await this.testOpenAICompatible(provider, startTime);

        case 'gemini':
          return await this.testGemini(provider, startTime);

        case 'ollama':
          return await this.testOllama(provider, startTime);

        case 'anthropic':
          return await this.testAnthropic(provider, startTime);

        default:
          return await this.testOpenAICompatible(provider, startTime);
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;

      await prisma.lLMProvider.update({
        where: { id: provider.id },
        data: {
          lastHealthCheck: new Date(),
          healthStatus: 'unhealthy',
          lastError: error.message,
          consecutiveFailures: { increment: 1 },
        },
      });

      return {
        success: false,
        message: error.message || 'Connection failed',
        latency,
      };
    }
  }

  private async testOpenAICompatible(provider: LLMProviderConfig, startTime: number): Promise<{ success: boolean; message: string; latency?: number }> {
    if (!provider.apiKey && provider.providerType === 'cloud') {
      return { success: false, message: 'API key not configured' };
    }

    const client = new OpenAI({
      apiKey: provider.apiKey || 'not-needed',
      baseURL: provider.baseUrl,
      timeout: provider.connectTimeout,
    });

    // Try to list models or make a simple completion
    try {
      await client.models.list();
    } catch {
      // If model listing fails, try a simple completion
      const testModel = provider.defaultModel || 'gpt-4o-mini';
      const isO1Model = testModel.startsWith('o1-') || testModel.startsWith('o3-');

      const testParams: any = {
        model: testModel,
        messages: [{ role: 'user', content: 'Hi' }],
      };

      if (isO1Model) {
        testParams.max_completion_tokens = 5;
      } else {
        testParams.max_tokens = 5;
      }

      await client.chat.completions.create(testParams);
    }

    const latency = Date.now() - startTime;

    await prisma.lLMProvider.update({
      where: { id: provider.id },
      data: {
        lastHealthCheck: new Date(),
        healthStatus: 'healthy',
        lastError: null,
        consecutiveFailures: 0,
        averageLatency: latency,
      },
    });

    return { success: true, message: 'Connection successful', latency };
  }

  private async testGemini(provider: LLMProviderConfig, startTime: number): Promise<{ success: boolean; message: string; latency?: number }> {
    if (!provider.apiKey) {
      return { success: false, message: 'API key not configured' };
    }

    const client = new GoogleGenerativeAI(provider.apiKey);
    const model = client.getGenerativeModel({ model: provider.defaultModel || 'gemini-1.5-flash' });

    await model.generateContent('Hi');

    const latency = Date.now() - startTime;

    await prisma.lLMProvider.update({
      where: { id: provider.id },
      data: {
        lastHealthCheck: new Date(),
        healthStatus: 'healthy',
        lastError: null,
        consecutiveFailures: 0,
        averageLatency: latency,
      },
    });

    return { success: true, message: 'Connection successful', latency };
  }

  private async testOllama(provider: LLMProviderConfig, startTime: number): Promise<{ success: boolean; message: string; latency?: number }> {
    const baseUrl = provider.baseUrl || 'http://localhost:11434';

    // Test by listing models
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(provider.connectTimeout),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`);
    }

    const data = (await response.json()) as OllamaTagsResponse;
    const latency = Date.now() - startTime;

    await prisma.lLMProvider.update({
      where: { id: provider.id },
      data: {
        lastHealthCheck: new Date(),
        healthStatus: 'healthy',
        lastError: null,
        consecutiveFailures: 0,
        averageLatency: latency,
      },
    });

    const modelCount = data.models?.length || 0;
    return {
      success: true,
      message: `Connected. ${modelCount} model${modelCount !== 1 ? 's' : ''} available.`,
      latency,
    };
  }

  private async testAnthropic(provider: LLMProviderConfig, startTime: number): Promise<{ success: boolean; message: string; latency?: number }> {
    if (!provider.apiKey) {
      return { success: false, message: 'API key not configured' };
    }

    const response = await fetch(`${provider.baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: provider.defaultModel || 'claude-3-5-sonnet-20241022',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
      signal: AbortSignal.timeout(provider.connectTimeout),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as AnthropicErrorResponse;
      throw new Error(errorData.error?.message || `Status ${response.status}`);
    }

    const latency = Date.now() - startTime;

    await prisma.lLMProvider.update({
      where: { id: provider.id },
      data: {
        lastHealthCheck: new Date(),
        healthStatus: 'healthy',
        lastError: null,
        consecutiveFailures: 0,
        averageLatency: latency,
      },
    });

    return { success: true, message: 'Connection successful', latency };
  }

  // ===========================================================================
  // PARAMETER VALIDATION (Minimal Parameter Principle)
  // ===========================================================================

  /**
   * Validates and filters request parameters based on provider support.
   *
   * Follows the Minimal Parameter Principle:
   * 1. Trust defaults - don't send parameters if using default values
   * 2. Send only overrides - only include parameters the user explicitly set
   * 3. Reject unsupported overrides loudly - error when user sets an unsupported parameter
   */
  private validateAndFilterParams(
    providerName: string,
    model: string,
    request: Partial<LLMCompletionRequest>
  ): { params: Record<string, any>; errors: string[] } {
    const support = getParameterSupport(providerName, model);
    const params: Record<string, any> = {};
    const errors: string[] = [];

    // Temperature
    if (request.temperature !== undefined) {
      if (support.temperature) {
        params.temperature = request.temperature;
      } else {
        errors.push('temperature');
      }
    }

    // Max tokens
    if (request.maxTokens !== undefined) {
      if (support.maxTokens) {
        params.maxTokens = request.maxTokens;
      } else {
        errors.push('maxTokens');
      }
    }

    // Top P
    if (request.topP !== undefined) {
      if (support.topP) {
        params.topP = request.topP;
      } else {
        errors.push('topP');
      }
    }

    // Top K
    if (request.topK !== undefined) {
      if (support.topK) {
        params.topK = request.topK;
      } else {
        errors.push('topK');
      }
    }

    // Frequency Penalty
    if (request.frequencyPenalty !== undefined) {
      if (support.frequencyPenalty) {
        params.frequencyPenalty = request.frequencyPenalty;
      } else {
        errors.push('frequencyPenalty');
      }
    }

    // Presence Penalty
    if (request.presencePenalty !== undefined) {
      if (support.presencePenalty) {
        params.presencePenalty = request.presencePenalty;
      } else {
        errors.push('presencePenalty');
      }
    }

    // Repeat Penalty (Ollama-specific)
    if (request.repeatPenalty !== undefined) {
      if (support.repeatPenalty) {
        params.repeatPenalty = request.repeatPenalty;
      } else {
        errors.push('repeatPenalty');
      }
    }

    // Stop sequences
    if (request.stop !== undefined && request.stop.length > 0) {
      if (support.stop) {
        params.stop = request.stop;
      } else {
        errors.push('stop');
      }
    }

    // Stream (always allowed, handled separately)
    if (request.stream !== undefined) {
      params.stream = request.stream;
    }

    return { params, errors };
  }

  /**
   * Get a human-readable provider name for error messages.
   */
  private getProviderDisplayName(providerName: string, model?: string): string {
    if (model && (model.startsWith('o1-') || model.startsWith('o3-'))) {
      return PROVIDER_DISPLAY_NAMES['openai-o1'] || 'OpenAI o1/o3 models';
    }
    return PROVIDER_DISPLAY_NAMES[providerName] || providerName;
  }

  // ===========================================================================
  // CHAT COMPLETION
  // ===========================================================================

  async chat(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const startTime = Date.now();

    // Get provider
    let provider: LLMProviderConfig | null;
    if (request.provider) {
      provider = await this.getProvider(request.provider);
    } else {
      provider = await this.getDefaultProvider();
    }

    if (!provider) {
      throw new LLMError('No LLM provider configured', 'PROVIDER_NOT_FOUND');
    }

    if (!provider.isEnabled) {
      throw new LLMError(`Provider ${provider.name} is not enabled`, 'PROVIDER_NOT_ENABLED', provider.name as LLMProviderName);
    }

    // Determine model
    const model = request.model || provider.defaultModel;
    if (!model) {
      throw new LLMError('No model specified', 'MODEL_NOT_FOUND', provider.name as LLMProviderName);
    }

    // Validate and filter parameters (Minimal Parameter Principle)
    const { params, errors } = this.validateAndFilterParams(provider.name, model, request);

    // Reject unsupported parameters loudly
    if (errors.length > 0) {
      const displayName = this.getProviderDisplayName(provider.name, model);
      throw new LLMError(
        `Unsupported parameters for ${displayName}: ${errors.join(', ')}. ` +
        `These parameters are not supported by this provider/model.`,
        'UNSUPPORTED_PARAMETER',
        provider.name as LLMProviderName,
        400,
        false,
        { unsupportedParams: errors, provider: provider.name, model }
      );
    }

    // params now only contains explicitly set parameters (Minimal Parameter Principle)
    // Provider methods will use these directly without adding defaults

    let response: LLMCompletionResponse;

    try {
      switch (provider.name) {
        case 'openai':
        case 'azure-openai':
        case 'openrouter':
        case 'together':
        case 'groq':
        case 'mistral':
        case 'lmstudio':
          response = await this.chatOpenAICompatible(provider, model, request.messages, params);
          break;

        case 'gemini':
          response = await this.chatGemini(provider, model, request.messages, params);
          break;

        case 'ollama':
          response = await this.chatOllama(provider, model, request.messages, params);
          break;

        case 'anthropic':
          response = await this.chatAnthropic(provider, model, request.messages, params);
          break;

        default:
          response = await this.chatOpenAICompatible(provider, model, request.messages, params);
      }

      // Update usage statistics
      await prisma.lLMProvider.update({
        where: { id: provider.id },
        data: {
          totalRequests: { increment: 1 },
          totalTokensUsed: { increment: response.usage?.totalTokens || 0 },
        },
      });

      response.responseTime = Date.now() - startTime;
      return response;

    } catch (error: any) {
      await prisma.lLMProvider.update({
        where: { id: provider.id },
        data: {
          totalErrors: { increment: 1 },
        },
      });
      throw error;
    }
  }

  private async chatOpenAICompatible(
    provider: LLMProviderConfig,
    model: string,
    messages: LLMMessage[],
    params: Record<string, any>
  ): Promise<LLMCompletionResponse> {
    const client = new OpenAI({
      apiKey: provider.apiKey || 'not-needed',
      baseURL: provider.baseUrl,
      timeout: provider.requestTimeout,
      organization: provider.organizationId,
    });

    // OpenAI's o1 models use max_completion_tokens instead of max_tokens
    const isO1Model = model.startsWith('o1-') || model.startsWith('o3-');

    // Build request params - only include explicitly provided parameters (Minimal Parameter Principle)
    const requestParams: any = {
      model,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content as string,
      })),
    };

    if (isO1Model) {
      // o1 models only support max_completion_tokens
      if (params.maxTokens !== undefined) {
        requestParams.max_completion_tokens = params.maxTokens;
      }
      // DO NOT send temperature, top_p, frequency_penalty, presence_penalty, stop for o1/o3 models
    } else {
      // Standard OpenAI models - only add params if explicitly provided
      if (params.maxTokens !== undefined) {
        requestParams.max_tokens = params.maxTokens;
      }
      if (params.temperature !== undefined) {
        requestParams.temperature = params.temperature;
      }
      if (params.topP !== undefined) {
        requestParams.top_p = params.topP;
      }
      if (params.frequencyPenalty !== undefined) {
        requestParams.frequency_penalty = params.frequencyPenalty;
      }
      if (params.presencePenalty !== undefined) {
        requestParams.presence_penalty = params.presencePenalty;
      }
      if (params.stop !== undefined) {
        requestParams.stop = params.stop;
      }
    }

    const response = await client.chat.completions.create(requestParams);

    return {
      id: response.id,
      object: response.object,
      created: response.created,
      model: response.model,
      provider: provider.name as LLMProviderName,
      choices: response.choices.map(c => ({
        index: c.index,
        message: {
          role: c.message.role,
          content: c.message.content || '',
        },
        finishReason: c.finish_reason as any,
      })),
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
      responseTime: 0,
    };
  }

  private async chatGemini(
    provider: LLMProviderConfig,
    model: string,
    messages: LLMMessage[],
    params: Record<string, any>
  ): Promise<LLMCompletionResponse> {
    const client = new GoogleGenerativeAI(provider.apiKey!);

    // Build generation config - only include explicitly provided parameters (Minimal Parameter Principle)
    const generationConfig: any = {};
    if (params.temperature !== undefined) {
      generationConfig.temperature = params.temperature;
    }
    if (params.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = params.maxTokens;
    }
    if (params.topP !== undefined) {
      generationConfig.topP = params.topP;
    }
    if (params.topK !== undefined) {
      generationConfig.topK = params.topK;
    }
    if (params.stop !== undefined) {
      generationConfig.stopSequences = params.stop;
    }

    const genModel = client.getGenerativeModel({
      model,
      generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });

    // Extract system message and format for Gemini
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    let prompt = '';
    if (systemMessage) {
      prompt += `System: ${systemMessage.content}\n\n`;
    }

    for (const msg of chatMessages) {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n`;
      }
    }

    const result = await genModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return {
      id: `gemini-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      provider: 'gemini',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: text,
        },
        finishReason: 'stop',
      }],
      usage: {
        promptTokens: 0, // Gemini doesn't provide this directly
        completionTokens: 0,
        totalTokens: 0,
      },
      responseTime: 0,
    };
  }

  private async chatOllama(
    provider: LLMProviderConfig,
    model: string,
    messages: LLMMessage[],
    params: Record<string, any>
  ): Promise<LLMCompletionResponse> {
    const baseUrl = provider.baseUrl || 'http://localhost:11434';

    // Build options - only include explicitly provided parameters (Minimal Parameter Principle)
    const options: any = {};
    if (params.temperature !== undefined) {
      options.temperature = params.temperature;
    }
    if (params.maxTokens !== undefined) {
      options.num_predict = params.maxTokens;
    }
    if (params.topP !== undefined) {
      options.top_p = params.topP;
    }
    if (params.topK !== undefined) {
      options.top_k = params.topK;
    }
    if (params.repeatPenalty !== undefined) {
      options.repeat_penalty = params.repeatPenalty;
    }
    if (params.stop !== undefined) {
      options.stop = params.stop;
    }

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
        options: Object.keys(options).length > 0 ? options : undefined,
      }),
      signal: AbortSignal.timeout(provider.requestTimeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama error: ${errorText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;

    return {
      id: `ollama-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      provider: 'ollama',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: data.message?.content || '',
        },
        finishReason: data.done ? 'stop' : null,
      }],
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      responseTime: 0,
    };
  }

  private async chatAnthropic(
    provider: LLMProviderConfig,
    model: string,
    messages: LLMMessage[],
    params: Record<string, any>
  ): Promise<LLMCompletionResponse> {
    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    // Build request body - only include explicitly provided parameters (Minimal Parameter Principle)
    const requestBody: any = {
      model,
      messages: chatMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    // max_tokens is required for Anthropic, so we need to provide a default if not specified
    requestBody.max_tokens = params.maxTokens ?? 4096;

    if (systemMessage?.content) {
      requestBody.system = systemMessage.content;
    }
    if (params.temperature !== undefined) {
      requestBody.temperature = params.temperature;
    }
    if (params.topP !== undefined) {
      requestBody.top_p = params.topP;
    }
    if (params.topK !== undefined) {
      requestBody.top_k = params.topK;
    }
    if (params.stop !== undefined) {
      requestBody.stop_sequences = params.stop;
    }

    const response = await fetch(`${provider.baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(provider.requestTimeout),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as AnthropicErrorResponse;
      throw new Error(errorData.error?.message || `Anthropic error: ${response.status}`);
    }

    const data = (await response.json()) as AnthropicChatResponse;

    return {
      id: data.id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: data.model,
      provider: 'anthropic',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: data.content?.[0]?.text || '',
        },
        finishReason: data.stop_reason === 'end_turn' ? 'stop' : null,
      }],
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      responseTime: 0,
    };
  }

  // ===========================================================================
  // OLLAMA-SPECIFIC: LIST LOCAL MODELS
  // ===========================================================================

  async getOllamaModels(baseUrl?: string): Promise<Array<{ name: string; size: number; modifiedAt: string }>> {
    const url = baseUrl || 'http://localhost:11434';

    const response = await fetch(`${url}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Ollama models: ${response.status}`);
    }

    const data = (await response.json()) as OllamaTagsResponse;
    return (data.models || []).map(m => ({
      name: m.name,
      size: m.size,
      modifiedAt: m.modified_at,
    }));
  }

  async pullOllamaModel(modelName: string, baseUrl?: string): Promise<void> {
    const url = baseUrl || 'http://localhost:11434';

    const response = await fetch(`${url}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.status}`);
    }
  }

  // ===========================================================================
  // LM STUDIO-SPECIFIC: LIST LOCAL MODELS
  // ===========================================================================

  async getLMStudioModels(baseUrl?: string): Promise<Array<{ id: string; object: string }>> {
    const url = baseUrl || 'http://localhost:1234/v1';

    const client = new OpenAI({
      apiKey: 'not-needed',
      baseURL: url,
      timeout: 10000,
    });

    const response = await client.models.list();
    return response.data.map(m => ({ id: m.id, object: m.object }));
  }

  // ===========================================================================
  // SEEDING
  // ===========================================================================

  async seedDefaultProviders(): Promise<void> {
    const providerNames: LLMProviderName[] = ['openai', 'gemini', 'ollama', 'lmstudio', 'anthropic', 'groq', 'openrouter'];

    for (const name of providerNames) {
      const existing = await prisma.lLMProvider.findUnique({ where: { name } });

      if (!existing) {
        const defaults = PROVIDER_DEFAULTS[name];
        await this.createProvider({
          name,
          displayName: defaults.displayName,
          isEnabled: false,
          isDefault: false,
          priority: name === 'openai' ? 100 : name === 'gemini' ? 90 : 50,
        });
      }
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private mapProviderFromDb = (provider: any): LLMProviderConfig => {
    return {
      id: provider.id,
      name: provider.name,
      displayName: provider.displayName,
      description: provider.description,
      providerType: provider.providerType,
      isEnabled: provider.isEnabled,
      isDefault: provider.isDefault,
      priority: provider.priority,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      apiVersion: provider.apiVersion,
      organizationId: provider.organizationId,
      projectId: provider.projectId,
      defaultModel: provider.defaultModel,
      defaultModelId: provider.defaultModelId,
      defaultTemperature: provider.defaultTemperature,
      defaultMaxTokens: provider.defaultMaxTokens,
      defaultTopP: provider.defaultTopP,
      defaultTopK: provider.defaultTopK,
      defaultFrequencyPenalty: provider.defaultFrequencyPenalty,
      defaultPresencePenalty: provider.defaultPresencePenalty,
      defaultRepeatPenalty: provider.defaultRepeatPenalty,
      maxContextLength: provider.maxContextLength,
      maxOutputTokens: provider.maxOutputTokens,
      defaultContextLength: provider.defaultContextLength,
      defaultStopSequences: provider.defaultStopSequences ? JSON.parse(provider.defaultStopSequences) : undefined,
      defaultResponseFormat: provider.defaultResponseFormat,
      requestTimeout: provider.requestTimeout,
      connectTimeout: provider.connectTimeout,
      maxRetries: provider.maxRetries,
      retryDelay: provider.retryDelay,
      retryBackoffMultiplier: provider.retryBackoffMultiplier,
      rateLimitRpm: provider.rateLimitRpm,
      rateLimitTpm: provider.rateLimitTpm,
      rateLimitRpd: provider.rateLimitRpd,
      concurrencyLimit: provider.concurrencyLimit,
      supportsStreaming: provider.supportsStreaming,
      defaultStreaming: provider.defaultStreaming,
      supportsVision: provider.supportsVision,
      supportsFunctionCalling: provider.supportsFunctionCalling,
      supportsJsonMode: provider.supportsJsonMode,
      supportsSystemMessage: provider.supportsSystemMessage,
      supportsMultipleSystemMessages: provider.supportsMultipleSystemMessages,
      proxyUrl: provider.proxyUrl,
      proxyUsername: provider.proxyUsername,
      proxyPassword: provider.proxyPassword,
      customHeaders: provider.customHeaders ? JSON.parse(provider.customHeaders) : undefined,
      skipTlsVerify: provider.skipTlsVerify,
      customCaCert: provider.customCaCert,
      healthCheckEnabled: provider.healthCheckEnabled,
      healthCheckInterval: provider.healthCheckInterval,
      lastHealthCheck: provider.lastHealthCheck,
      healthStatus: provider.healthStatus,
      lastError: provider.lastError,
      consecutiveFailures: provider.consecutiveFailures,
      totalRequests: provider.totalRequests,
      totalTokensUsed: provider.totalTokensUsed,
      totalErrors: provider.totalErrors,
      averageLatency: provider.averageLatency,
      metadata: provider.metadata ? JSON.parse(provider.metadata) : undefined,
      notes: provider.notes,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
      models: provider.models?.map((m: unknown) => this.mapModelFromDb(m)),
    };
  };

  private mapModelFromDb = (model: any): LLMModelConfig => {
    return {
      id: model.id,
      providerId: model.providerId,
      modelId: model.modelId,
      name: model.name,
      description: model.description,
      modelType: model.modelType,
      isEnabled: model.isEnabled,
      isDefault: model.isDefault,
      contextLength: model.contextLength,
      maxOutputTokens: model.maxOutputTokens,
      defaultTemperature: model.defaultTemperature,
      defaultMaxTokens: model.defaultMaxTokens,
      defaultTopP: model.defaultTopP,
      defaultTopK: model.defaultTopK,
      supportsVision: model.supportsVision,
      supportsFunctionCalling: model.supportsFunctionCalling,
      supportsJsonMode: model.supportsJsonMode,
      supportsStreaming: model.supportsStreaming,
      inputPricePer1M: model.inputPricePer1M,
      outputPricePer1M: model.outputPricePer1M,
      totalRequests: model.totalRequests,
      totalInputTokens: model.totalInputTokens,
      totalOutputTokens: model.totalOutputTokens,
      metadata: model.metadata ? JSON.parse(model.metadata) : undefined,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  private clearCache(): void {
    this.providerCache.clear();
    this.clientCache.clear();
    this.lastCacheRefresh = 0;
  }
}

export const llmService = new LLMService();
