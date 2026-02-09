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
} from '../types/llm.types.js';

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
      await client.chat.completions.create({
        model: provider.defaultModel || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });
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

    const data = await response.json() as { models?: unknown[] };
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
      const error = await response.json() as { error?: { message?: string } };
      throw new Error(error.error?.message || `Status ${response.status}`);
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

    // Build parameters using defaults
    const params = {
      temperature: request.temperature ?? provider.defaultTemperature,
      maxTokens: request.maxTokens ?? provider.defaultMaxTokens,
      topP: request.topP ?? provider.defaultTopP,
      topK: request.topK ?? provider.defaultTopK,
      frequencyPenalty: request.frequencyPenalty ?? provider.defaultFrequencyPenalty,
      presencePenalty: request.presencePenalty ?? provider.defaultPresencePenalty,
      repeatPenalty: request.repeatPenalty ?? provider.defaultRepeatPenalty,
      stop: request.stop || (provider.defaultStopSequences ? JSON.parse(provider.defaultStopSequences as unknown as string) : undefined),
      stream: request.stream ?? provider.defaultStreaming,
    };

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
    params: any
  ): Promise<LLMCompletionResponse> {
    const client = new OpenAI({
      apiKey: provider.apiKey || 'not-needed',
      baseURL: provider.baseUrl,
      timeout: provider.requestTimeout,
      organization: provider.organizationId,
    });

    const response = await client.chat.completions.create({
      model,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content as string,
      })),
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      top_p: params.topP,
      frequency_penalty: params.frequencyPenalty,
      presence_penalty: params.presencePenalty,
      stop: params.stop,
    });

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
    params: any
  ): Promise<LLMCompletionResponse> {
    const client = new GoogleGenerativeAI(provider.apiKey!);
    const genModel = client.getGenerativeModel({
      model,
      generationConfig: {
        temperature: params.temperature,
        maxOutputTokens: params.maxTokens,
        topP: params.topP,
        topK: params.topK,
        stopSequences: params.stop,
      },
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
    params: any
  ): Promise<LLMCompletionResponse> {
    const baseUrl = provider.baseUrl || 'http://localhost:11434';

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
        options: {
          temperature: params.temperature,
          num_predict: params.maxTokens,
          top_p: params.topP,
          top_k: params.topK,
          repeat_penalty: params.repeatPenalty || 1.1,
          stop: params.stop,
        },
      }),
      signal: AbortSignal.timeout(provider.requestTimeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama error: ${error}`);
    }

    const data = await response.json() as {
      message?: { content?: string };
      done?: boolean;
      prompt_eval_count?: number;
      eval_count?: number;
    };

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
    params: any
  ): Promise<LLMCompletionResponse> {
    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch(`${provider.baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: params.maxTokens,
        system: systemMessage?.content,
        messages: chatMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: params.temperature,
        top_p: params.topP,
        top_k: params.topK,
        stop_sequences: params.stop,
      }),
      signal: AbortSignal.timeout(provider.requestTimeout),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: { message?: string } };
      throw new Error(error.error?.message || `Anthropic error: ${response.status}`);
    }

    const data = await response.json() as {
      id?: string;
      model?: string;
      content?: Array<{ text?: string }>;
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    return {
      id: data.id || `anthropic-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: data.model || model,
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

    const data = await response.json() as { models?: Array<{ name: string; size: number; modifiedAt: string }> };
    return data.models || [];
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
    const providerNames: LLMProviderName[] = ['openai', 'gemini', 'ollama', 'lmstudio', 'anthropic', 'groq'];

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
