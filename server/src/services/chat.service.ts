import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../utils/prisma.js';
import { ChatMessage, ChatRequest, ChatResponse, AIConfig } from '../types/index.js';
import { AppError } from '../middleware/error.middleware.js';

export class ChatService {
  private openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;

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
    // Try to get config from database
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
    const config = await this.getAIConfig();

    if (!config) {
      throw new AppError('No AI provider configured', 500);
    }

    let reply: string;
    let model = request.model || config.model;
    const temperature = request.temperature ?? 0.7;

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
      if (config.provider === 'openai') {
        reply = await this.chatWithOpenAI(messages, model, config.apiKey, temperature);
      } else {
        reply = await this.chatWithGemini(messages, model, config.apiKey);
      }
    } catch (error: any) {
      console.error('AI Chat Error:', error);
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
      responseTime,
    };
  }

  private async chatWithOpenAI(messages: ChatMessage[], model: string, apiKey: string, temperature = 0.7): Promise<string> {
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      max_tokens: 2000,
      temperature,
    });

    return response.choices[0]?.message?.content || 'No response generated';
  }

  private async chatWithGemini(messages: ChatMessage[], model: string, apiKey: string): Promise<string> {
    const client = new GoogleGenerativeAI(apiKey);
    const genModel = client.getGenerativeModel({ model });

    // Format messages for Gemini
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessage = messages.find(m => m.role === 'user');

    const prompt = systemMessage
      ? `${systemMessage.content}\n\nUser: ${userMessage?.content}`
      : userMessage?.content || '';

    const result = await genModel.generateContent(prompt);
    const response = await result.response;

    return response.text() || 'No response generated';
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

  async getChatHistory(sessionId: string, limit = 50) {
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
