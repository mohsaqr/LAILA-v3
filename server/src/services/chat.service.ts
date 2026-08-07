import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../utils/prisma.js';
import { ChatMessage, ChatRequest, ChatResponse, AIConfig } from '../types/index.js';
import { AppError } from '../middleware/error.middleware.js';
import { createLogger } from '../utils/logger.js';
import { llmService } from './llm.service.js';
import { llmBudgetService, isBudgetError } from './llmBudget.service.js';

const logger = createLogger('chat');

/**
 * What the legacy direct-SDK helpers hand back.
 *
 * They used to return the reply text alone, which made the traffic they carry
 * invisible to metering — and this path runs whenever the unified LLM service
 * is unavailable, so it is exactly the traffic worth seeing. Usage is optional
 * because not every provider reports it; absent stays absent rather than
 * becoming a zero that would read as "free".
 */
interface LegacyReply {
  text: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

export class ChatService {
  private openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private useNewLLMService: boolean = true; // Toggle for new LLM service

  constructor() {
    this.initializeProviders();
  }

  private async initializeProviders() {
    // Load API keys from database or environment
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }

    if (geminiKey) {
      this.gemini = new GoogleGenerativeAI(geminiKey);
    }
  }

  async getAIConfig(): Promise<AIConfig | null> {
    // First, try to use the new LLM service
    if (this.useNewLLMService) {
      try {
        const provider = await llmService.getDefaultProvider();
        if (provider && provider.isEnabled) {
          return {
            provider: ((provider as any).provider || provider.name) as 'openai' | 'gemini',
            model: provider.defaultModel || 'gpt-4o-mini',
            apiKey: provider.apiKey || '',
            maxTokens: provider.defaultMaxTokens,
            temperature: provider.defaultTemperature,
          };
        }
      } catch (error) {
        console.log('New LLM service not available, falling back to legacy config');
      }
    }

    // Fallback to legacy ApiConfiguration table
    const configs = await prisma.apiConfiguration.findMany({
      where: { isActive: true },
    });

    // Prefer OpenAI, fallback to Gemini
    const openaiConfig = configs.find(c => c.serviceName === 'openai');
    if (openaiConfig?.apiKey) {
      return {
        provider: 'openai',
        model: openaiConfig.defaultModel || 'gpt-4o-mini',
        apiKey: openaiConfig.apiKey,
      };
    }

    const geminiConfig = configs.find(c => c.serviceName === 'gemini');
    if (geminiConfig?.apiKey) {
      return {
        provider: 'gemini',
        model: geminiConfig.defaultModel || 'gemini-pro',
        apiKey: geminiConfig.apiKey,
      };
    }

    // Fallback to environment variables
    if (process.env.OPENAI_API_KEY) {
      return {
        provider: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL, // For LM Studio or other OpenAI-compatible servers
      };
    }

    if (process.env.GEMINI_API_KEY) {
      return {
        provider: 'gemini',
        model: process.env.GEMINI_MODEL || 'gemini-pro',
        apiKey: process.env.GEMINI_API_KEY,
      };
    }

    return null;
  }

  async chat(request: ChatRequest, userId?: number): Promise<ChatResponse> {
    const startTime = Date.now();

    // Server-side persona resolution: when a chatbotId is supplied, its stored
    // system prompt wins — the client never needs (or gets) the prompt text.
    if (request.chatbotId != null) {
      const bot = await prisma.chatbot.findUnique({
        where: { id: request.chatbotId },
        select: { systemPrompt: true, isActive: true },
      });
      if (bot?.isActive) {
        request = { ...request, systemPrompt: bot.systemPrompt };
      } else {
        request = { ...request, systemPrompt: undefined };
      }
    }

    // Try new LLM service first
    if (this.useNewLLMService) {
      try {
        const systemPrompt = request.systemPrompt || 'You are a helpful AI assistant for an educational platform.';
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemPrompt },
        ];

        if (request.context) {
          messages.push({ role: 'system', content: `Context: ${request.context}` });
        }

        if (request.conversationHistory && request.conversationHistory.length > 0) {
          for (const msg of request.conversationHistory) {
            if (msg.role === 'user' || msg.role === 'assistant') {
              messages.push(msg);
            }
          }
        }

        messages.push({ role: 'user', content: request.message });

        const response = await llmService.chat({
          messages,
          model: request.model,
          provider: request.provider as any,
          module: request.module,
          temperature: request.temperature,
          // Attribution for metering. Generic chat has no course, so only the
          // user and the platform total can account for it.
          billing: { userId },
        });

        const messageContent = response.choices[0]?.message?.content;
        const reply = typeof messageContent === 'string' ? messageContent : 'No response generated';
        const responseTime = response.responseTime / 1000;
        const model = response.model;
        const provider = response.provider;

        // Log outside the LLM try so a logging failure doesn't trigger a fallback retry
        try {
          await this.logChat({
            userId,
            sessionId: request.sessionId,
            module: request.module,
            message: request.message,
            reply,
            model,
            responseTime,
          });
        } catch (logErr) {
          console.warn('Failed to log chat:', logErr);
        }

        return {
          reply,
          model,
          provider,
          responseTime,
        };
      } catch (error: any) {
        // A budget refusal is a decision, not a transport failure. This
        // fallback exists for a provider being down, and retrying through a
        // direct SDK is exactly right for that — but applied to a cap it would
        // make the very call the cap just refused, so the limit would appear to
        // do nothing at all. Re-throw and let the caller see the 429.
        if (isBudgetError(error)) throw error;
        console.log('New LLM service error, falling back to legacy:', error.message);
      }
    }

    // Fallback to legacy implementation
    const config = await this.getAIConfig();

    if (!config) {
      throw new AppError('No AI provider configured', 500);
    }

    // The legacy path talks to the provider SDK directly, so it is invisible to
    // the metering inside llmService.chat. Check the cap here too, or a user
    // over their limit would still be served by whatever knocked the unified
    // path out. Unset caps make this a no-op, and it fails open.
    await llmBudgetService.assert({ userId });

    let reply: string;
    let model = request.model || config.model;

    const systemPrompt = request.systemPrompt || 'You are a helpful AI assistant for an educational platform.';
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (request.context) {
      messages.push({ role: 'system', content: `Context: ${request.context}` });
    }

    // Add conversation history if provided (for multi-turn conversations)
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      for (const msg of request.conversationHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push(msg);
        }
      }
    }

    messages.push({ role: 'user', content: request.message });

    try {
      // Only pass temperature if explicitly set by user (not the default 0.7)
      // This follows the Minimal Parameter Principle - let providers use their defaults
      const explicitTemperature = request.temperature !== undefined ? request.temperature : undefined;

      const legacy = config.provider === 'openai'
        ? await this.chatWithOpenAI(messages, model, config.apiKey, explicitTemperature, config.baseURL)
        : await this.chatWithGemini(messages, model, config.apiKey, explicitTemperature);

      reply = legacy.text;

      // `source: 'chat_legacy'` makes it measurable how much traffic still
      // takes this path rather than the unified service, instead of leaving
      // that to guesswork.
      await llmBudgetService.record({
        userId,
        source: 'chat_legacy',
        module: request.module,
        provider: config.provider,
        model,
        promptTokens: legacy.usage?.promptTokens,
        completionTokens: legacy.usage?.completionTokens,
        totalTokens: legacy.usage?.totalTokens,
      });
    } catch (error: any) {
      logger.error({ err: error, provider: config.provider }, 'AI Chat Error');
      throw new AppError(error.message || 'Failed to get AI response', 500);
    }

    const responseTime = (Date.now() - startTime) / 1000;

    // Log the chat
    await this.logChat({
      userId,
      sessionId: request.sessionId,
      module: request.module,
      message: request.message,
      reply,
      model,
      responseTime,
    });

    return {
      reply,
      model,
      // The legacy path talks to one SDK directly, so the config it resolved
      // above IS the provider that served this call.
      provider: config.provider,
      responseTime,
    };
  }

  private async chatWithOpenAI(messages: ChatMessage[], model: string, apiKey: string, temperature?: number, baseURL?: string): Promise<LegacyReply> {
    const client = new OpenAI({ apiKey, baseURL });

    // OpenAI's o1/o3 models use max_completion_tokens instead of max_tokens
    // and don't support temperature parameter
    const isO1Model = model.startsWith('o1-') || model.startsWith('o3-');

    // Build request params - only include explicitly provided parameters (Minimal Parameter Principle)
    const requestParams: any = {
      model,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    };

    if (isO1Model) {
      // o1 models only support max_completion_tokens, no temperature/top_p etc.
      requestParams.max_completion_tokens = 800;
      // DO NOT send temperature - will cause an error
    } else {
      requestParams.max_tokens = 800;
      // Only add temperature if explicitly provided
      if (temperature !== undefined) {
        requestParams.temperature = temperature;
      }
    }

    const response = await client.chat.completions.create(requestParams);

    return {
      text: response.choices[0]?.message?.content || 'No response generated',
      usage: response.usage && {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
    };
  }

  private async chatWithGemini(messages: ChatMessage[], model: string, apiKey: string, temperature?: number): Promise<LegacyReply> {
    const client = new GoogleGenerativeAI(apiKey);

    // Build generation config - only include explicitly provided parameters (Minimal Parameter Principle)
    const generationConfig: any = {};
    if (temperature !== undefined) {
      generationConfig.temperature = temperature;
    }

    const genModel = client.getGenerativeModel({
      model,
      generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined,
    });

    // Format messages for Gemini
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessage = messages.find(m => m.role === 'user');

    const prompt = systemMessage
      ? `${systemMessage.content}\n\nUser: ${userMessage?.content}`
      : userMessage?.content || '';

    const result = await genModel.generateContent(prompt);
    const response = await result.response;

    // usageMetadata is not present on every SDK version or model, so it is read
    // defensively; when it is missing the call is recorded as unmeasured.
    const meta = (response as { usageMetadata?: {
      promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number;
    } }).usageMetadata;

    return {
      text: response.text() || 'No response generated',
      usage: meta && {
        promptTokens: meta.promptTokenCount,
        completionTokens: meta.candidatesTokenCount,
        totalTokens: meta.totalTokenCount,
      },
    };
  }

  private async logChat(data: {
    userId?: number;
    sessionId?: string;
    module: string;
    message: string;
    reply: string;
    model: string;
    responseTime: number;
  }) {
    // Get turn number for this session
    let turn = 1;
    if (data.sessionId) {
      const lastLog = await prisma.chatLog.findFirst({
        where: { sessionId: data.sessionId },
        orderBy: { turn: 'desc' },
      });
      turn = (lastLog?.turn || 0) + 1;
    }

    // Log user message
    await prisma.chatLog.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        timestamp: new Date(),
        module: data.module,
        sender: 'User',
        turn,
        message: data.message,
        aiModel: data.model,
      },
    });

    // Log AI response
    await prisma.chatLog.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        timestamp: new Date(),
        module: data.module,
        sender: 'AI',
        turn,
        message: data.reply,
        aiModel: data.model,
        responseTimeSec: data.responseTime,
      },
    });
  }

  async getChatHistory(sessionId: string, userId: number, limit = 50) {
    // First verify user owns this session
    const sessionCheck = await prisma.chatLog.findFirst({
      where: { sessionId },
      select: { userId: true },
    });

    if (!sessionCheck) {
      throw new AppError('Session not found', 404);
    }

    // Only allow access to own sessions (null userId means legacy data, allow access)
    if (sessionCheck.userId !== null && sessionCheck.userId !== userId) {
      throw new AppError('Not authorized to access this session', 403);
    }

    const logs = await prisma.chatLog.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
      take: limit,
    });

    return logs;
  }

  async getUserChatHistory(userId: number, module?: string, limit = 100) {
    const where: any = { userId };
    if (module) {
      where.module = module;
    }

    const logs = await prisma.chatLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return logs;
  }

  // Data analysis specific method
  async analyzeData(data: string, prompt: string, userId?: number): Promise<ChatResponse> {
    const systemPrompt = `You are a data analysis expert. Analyze the following data and provide insights.
    Focus on:
    1. Key patterns and trends
    2. Statistical observations
    3. Anomalies or outliers
    4. Recommendations based on the data

    Data to analyze:
    ${data}`;

    return this.chat({
      message: prompt,
      module: 'data-analyzer',
      systemPrompt,
    }, userId);
  }
}

export const chatService = new ChatService();
