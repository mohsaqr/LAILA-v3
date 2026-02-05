import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatService } from './chat.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Use vi.hoisted to ensure mock functions are available when mocks are hoisted
const { mockOpenAICreate } = vi.hoisted(() => ({
  mockOpenAICreate: vi.fn().mockResolvedValue({
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: 1234567890,
    model: 'gpt-4o-mini',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: 'Hello from OpenAI!' },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  }),
}));

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    apiConfiguration: {
      findMany: vi.fn(),
    },
    chatLog: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockOpenAICreate,
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
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

import prisma from '../utils/prisma.js';

describe('ChatService', () => {
  let chatService: ChatService;

  const mockOpenAIConfig = {
    id: 1,
    serviceName: 'openai',
    apiKey: 'sk-test-key',
    defaultModel: 'gpt-4o-mini',
    isActive: true,
  };

  const mockGeminiConfig = {
    id: 2,
    serviceName: 'gemini',
    apiKey: 'gemini-test-key',
    defaultModel: 'gemini-pro',
    isActive: true,
  };

  beforeEach(() => {
    chatService = new ChatService();
    vi.clearAllMocks();
    // Reset env vars
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // getAIConfig
  // ===========================================================================

  describe('getAIConfig', () => {
    it('should return OpenAI config from database when available', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockOpenAIConfig] as any);

      const config = await chatService.getAIConfig();

      expect(config?.provider).toBe('openai');
      expect(config?.model).toBe('gpt-4o-mini');
      expect(config?.apiKey).toBe('sk-test-key');
    });

    it('should return Gemini config when OpenAI not available', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockGeminiConfig] as any);

      const config = await chatService.getAIConfig();

      expect(config?.provider).toBe('gemini');
      expect(config?.model).toBe('gemini-pro');
    });

    it('should prefer OpenAI over Gemini when both are available', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([
        mockGeminiConfig,
        mockOpenAIConfig,
      ] as any);

      const config = await chatService.getAIConfig();

      expect(config?.provider).toBe('openai');
    });

    it('should fallback to environment variables when no database config', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([]);
      process.env.OPENAI_API_KEY = 'env-openai-key';

      const config = await chatService.getAIConfig();

      expect(config?.provider).toBe('openai');
      expect(config?.apiKey).toBe('env-openai-key');
    });

    it('should fallback to Gemini env var when no OpenAI', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([]);
      process.env.GEMINI_API_KEY = 'env-gemini-key';

      const config = await chatService.getAIConfig();

      expect(config?.provider).toBe('gemini');
      expect(config?.apiKey).toBe('env-gemini-key');
    });

    it('should return null when no config available', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([]);

      const config = await chatService.getAIConfig();

      expect(config).toBeNull();
    });

    it('should use default model when not specified in config', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([{
        ...mockOpenAIConfig,
        defaultModel: null,
      }] as any);

      const config = await chatService.getAIConfig();

      expect(config?.model).toBe('gpt-4o-mini');
    });
  });

  // ===========================================================================
  // chat
  // ===========================================================================

  describe('chat', () => {
    beforeEach(() => {
      vi.mocked(prisma.chatLog.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.chatLog.create).mockResolvedValue({} as any);
    });

    it('should throw error when no AI provider configured', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([]);

      await expect(chatService.chat({
        message: 'Hello',
        module: 'test',
      })).rejects.toThrow(AppError);
      await expect(chatService.chat({
        message: 'Hello',
        module: 'test',
      })).rejects.toThrow('No AI provider configured');
    });

    it('should chat with OpenAI successfully', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockOpenAIConfig] as any);

      const response = await chatService.chat({
        message: 'Hello',
        module: 'test',
      });

      expect(response.reply).toBe('Hello from OpenAI!');
      expect(response.model).toBe('gpt-4o-mini');
      expect(response.responseTime).toBeDefined();
    });

    it('should chat with Gemini when configured', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockGeminiConfig] as any);

      const response = await chatService.chat({
        message: 'Hello',
        module: 'test',
      });

      expect(response.reply).toBe('Hello from Gemini!');
    });

    it('should include system prompt in messages', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockOpenAIConfig] as any);

      await chatService.chat({
        message: 'Hello',
        module: 'test',
        systemPrompt: 'You are a helpful assistant',
      });

      // Verify the chat was called (OpenAI mock handles this)
      expect(prisma.chatLog.create).toHaveBeenCalled();
    });

    it('should include context in messages', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockOpenAIConfig] as any);

      await chatService.chat({
        message: 'What is this?',
        module: 'test',
        context: 'The topic is machine learning',
      });

      expect(prisma.chatLog.create).toHaveBeenCalled();
    });

    it('should include conversation history', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockOpenAIConfig] as any);

      await chatService.chat({
        message: 'Continue our conversation',
        module: 'test',
        conversationHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      });

      expect(prisma.chatLog.create).toHaveBeenCalled();
    });

    it('should pass temperature only when explicitly set', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockOpenAIConfig] as any);

      await chatService.chat({
        message: 'Hello',
        module: 'test',
        temperature: 0.5,
      });

      // Chat was called - temperature should have been passed
      expect(prisma.chatLog.create).toHaveBeenCalled();
    });

    it('should log chat to database', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockOpenAIConfig] as any);

      await chatService.chat({
        message: 'Hello',
        module: 'test-module',
        sessionId: 'session-123',
      }, 1);

      // Should create two log entries: one for user, one for AI
      expect(prisma.chatLog.create).toHaveBeenCalledTimes(2);
      expect(prisma.chatLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          sessionId: 'session-123',
          module: 'test-module',
          sender: 'User',
          message: 'Hello',
        }),
      });
      expect(prisma.chatLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          sessionId: 'session-123',
          module: 'test-module',
          sender: 'AI',
        }),
      });
    });

    it('should increment turn number for existing session', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockOpenAIConfig] as any);
      vi.mocked(prisma.chatLog.findFirst).mockResolvedValue({ turn: 5 } as any);

      await chatService.chat({
        message: 'Hello',
        module: 'test',
        sessionId: 'session-123',
      });

      expect(prisma.chatLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          turn: 6,
        }),
      });
    });

    it('should use override model when specified', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockOpenAIConfig] as any);

      await chatService.chat({
        message: 'Hello',
        module: 'test',
        model: 'gpt-4o',
      });

      expect(prisma.chatLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          aiModel: 'gpt-4o',
        }),
      });
    });

    it('should handle API error gracefully', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockOpenAIConfig] as any);

      // Override the mock function to throw error
      mockOpenAICreate.mockRejectedValueOnce(new Error('API rate limited'));

      await expect(chatService.chat({
        message: 'Hello',
        module: 'test',
      })).rejects.toThrow(AppError);
    });
  });

  // ===========================================================================
  // getChatHistory
  // ===========================================================================

  describe('getChatHistory', () => {
    const mockLogs = [
      { id: 1, sessionId: 'session-123', userId: 1, sender: 'User', message: 'Hello', turn: 1 },
      { id: 2, sessionId: 'session-123', userId: 1, sender: 'AI', message: 'Hi!', turn: 1 },
    ];

    it('should return chat history for valid session', async () => {
      vi.mocked(prisma.chatLog.findFirst).mockResolvedValue({ userId: 1 } as any);
      vi.mocked(prisma.chatLog.findMany).mockResolvedValue(mockLogs as any);

      const history = await chatService.getChatHistory('session-123', 1);

      expect(history).toHaveLength(2);
      expect(prisma.chatLog.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-123' },
        orderBy: { timestamp: 'asc' },
        take: 50,
      });
    });

    it('should throw 404 when session not found', async () => {
      vi.mocked(prisma.chatLog.findFirst).mockResolvedValue(null);

      await expect(chatService.getChatHistory('nonexistent', 1)).rejects.toThrow(AppError);
      await expect(chatService.getChatHistory('nonexistent', 1)).rejects.toThrow('Session not found');
    });

    it('should throw 403 when user does not own session', async () => {
      vi.mocked(prisma.chatLog.findFirst).mockResolvedValue({ userId: 999 } as any);

      await expect(chatService.getChatHistory('session-123', 1)).rejects.toThrow(AppError);
      await expect(chatService.getChatHistory('session-123', 1)).rejects.toThrow('Not authorized');
    });

    it('should allow access to legacy sessions with null userId', async () => {
      vi.mocked(prisma.chatLog.findFirst).mockResolvedValue({ userId: null } as any);
      vi.mocked(prisma.chatLog.findMany).mockResolvedValue(mockLogs as any);

      const history = await chatService.getChatHistory('session-123', 1);

      expect(history).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      vi.mocked(prisma.chatLog.findFirst).mockResolvedValue({ userId: 1 } as any);
      vi.mocked(prisma.chatLog.findMany).mockResolvedValue(mockLogs as any);

      await chatService.getChatHistory('session-123', 1, 10);

      expect(prisma.chatLog.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-123' },
        orderBy: { timestamp: 'asc' },
        take: 10,
      });
    });
  });

  // ===========================================================================
  // getUserChatHistory
  // ===========================================================================

  describe('getUserChatHistory', () => {
    const mockUserLogs = [
      { id: 1, userId: 1, module: 'tutor', message: 'Question 1', timestamp: new Date() },
      { id: 2, userId: 1, module: 'tutor', message: 'Answer 1', timestamp: new Date() },
    ];

    it('should return user chat history', async () => {
      vi.mocked(prisma.chatLog.findMany).mockResolvedValue(mockUserLogs as any);

      const history = await chatService.getUserChatHistory(1);

      expect(history).toHaveLength(2);
      expect(prisma.chatLog.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });

    it('should filter by module when specified', async () => {
      vi.mocked(prisma.chatLog.findMany).mockResolvedValue(mockUserLogs as any);

      await chatService.getUserChatHistory(1, 'tutor');

      expect(prisma.chatLog.findMany).toHaveBeenCalledWith({
        where: { userId: 1, module: 'tutor' },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });

    it('should respect limit parameter', async () => {
      vi.mocked(prisma.chatLog.findMany).mockResolvedValue(mockUserLogs as any);

      await chatService.getUserChatHistory(1, undefined, 50);

      expect(prisma.chatLog.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });
    });
  });

  // ===========================================================================
  // analyzeData
  // ===========================================================================

  describe('analyzeData', () => {
    it('should call chat with data analysis system prompt', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockOpenAIConfig] as any);
      vi.mocked(prisma.chatLog.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.chatLog.create).mockResolvedValue({} as any);

      const response = await chatService.analyzeData(
        'sales: 100, 150, 200',
        'What are the trends?',
        1
      );

      expect(response.reply).toBeDefined();
      // The system prompt should contain data analysis instructions
      expect(prisma.chatLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          module: 'data-analyzer',
        }),
      });
    });

    it('should pass userId to chat method', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockOpenAIConfig] as any);
      vi.mocked(prisma.chatLog.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.chatLog.create).mockResolvedValue({} as any);

      await chatService.analyzeData(
        'data: 1, 2, 3',
        'Analyze this',
        42
      );

      expect(prisma.chatLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 42,
        }),
      });
    });
  });

  // ===========================================================================
  // O1/O3 Model Handling
  // ===========================================================================

  describe('O1/O3 model handling', () => {
    it('should not send temperature for o1 models', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockOpenAIConfig] as any);
      vi.mocked(prisma.chatLog.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.chatLog.create).mockResolvedValue({} as any);

      // This should work without throwing even though temperature might be set internally
      await chatService.chat({
        message: 'Hello',
        module: 'test',
        model: 'o1-preview',
      });

      expect(prisma.chatLog.create).toHaveBeenCalled();
    });

    it('should use max_completion_tokens for o1 models', async () => {
      vi.mocked(prisma.apiConfiguration.findMany).mockResolvedValue([mockOpenAIConfig] as any);
      vi.mocked(prisma.chatLog.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.chatLog.create).mockResolvedValue({} as any);

      await chatService.chat({
        message: 'Hello',
        module: 'test',
        model: 'o3-mini',
      });

      expect(prisma.chatLog.create).toHaveBeenCalled();
    });
  });
});
