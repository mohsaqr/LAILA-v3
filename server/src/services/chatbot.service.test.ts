import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatbotService } from './chatbot.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    chatbot: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Mock chat service
vi.mock('./chat.service.js', () => ({
  chatService: {
    chat: vi.fn(),
  },
}));

import prisma from '../utils/prisma.js';
import { chatService } from './chat.service.js';

describe('ChatbotService', () => {
  let chatbotService: ChatbotService;

  const mockChatbot = {
    id: 1,
    name: 'test-bot',
    displayName: 'Test Bot',
    description: 'A test chatbot',
    systemPrompt: 'You are a test assistant.',
    category: 'support',
    isActive: true,
    isSystem: false,
  };

  const mockSystemChatbot = {
    ...mockChatbot,
    id: 2,
    name: 'system-bot',
    displayName: 'System Bot',
    isSystem: true,
  };

  beforeEach(() => {
    chatbotService = new ChatbotService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // getChatbots
  // ===========================================================================

  describe('getChatbots', () => {
    it('should return only active chatbots by default', async () => {
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue([mockChatbot] as any);

      const result = await chatbotService.getChatbots();

      expect(result).toHaveLength(1);
      expect(prisma.chatbot.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [
          { isSystem: 'desc' },
          { name: 'asc' },
        ],
      });
    });

    it('should return all chatbots when includeInactive is true', async () => {
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue([
        mockChatbot,
        { ...mockChatbot, id: 2, isActive: false },
      ] as any);

      const result = await chatbotService.getChatbots(true);

      expect(result).toHaveLength(2);
      expect(prisma.chatbot.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [
          { isSystem: 'desc' },
          { name: 'asc' },
        ],
      });
    });
  });

  // ===========================================================================
  // getChatbotByName
  // ===========================================================================

  describe('getChatbotByName', () => {
    it('should return chatbot by name', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);

      const result = await chatbotService.getChatbotByName('test-bot');

      expect(result.name).toBe('test-bot');
      expect(prisma.chatbot.findUnique).toHaveBeenCalledWith({
        where: { name: 'test-bot' },
      });
    });

    it('should throw 404 if chatbot not found', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(null);

      await expect(chatbotService.getChatbotByName('nonexistent')).rejects.toThrow(AppError);
      await expect(chatbotService.getChatbotByName('nonexistent')).rejects.toThrow('Chatbot not found');
    });
  });

  // ===========================================================================
  // getChatbotById
  // ===========================================================================

  describe('getChatbotById', () => {
    it('should return chatbot by id', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);

      const result = await chatbotService.getChatbotById(1);

      expect(result.id).toBe(1);
      expect(prisma.chatbot.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw 404 if chatbot not found', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(null);

      await expect(chatbotService.getChatbotById(999)).rejects.toThrow(AppError);
      await expect(chatbotService.getChatbotById(999)).rejects.toThrow('Chatbot not found');
    });
  });

  // ===========================================================================
  // createChatbot
  // ===========================================================================

  describe('createChatbot', () => {
    it('should create chatbot successfully', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.chatbot.create).mockResolvedValue(mockChatbot as any);

      const result = await chatbotService.createChatbot({
        name: 'test-bot',
        displayName: 'Test Bot',
        description: 'A test chatbot',
        systemPrompt: 'You are a test assistant.',
        category: 'support',
      });

      expect(result.name).toBe('test-bot');
      expect(prisma.chatbot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'test-bot',
          isSystem: false,
        }),
      });
    });

    it('should throw 409 if name already exists', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);

      await expect(chatbotService.createChatbot({
        name: 'test-bot',
        displayName: 'Test Bot',
        systemPrompt: 'Test',
      })).rejects.toThrow(AppError);
      await expect(chatbotService.createChatbot({
        name: 'test-bot',
        displayName: 'Test Bot',
        systemPrompt: 'Test',
      })).rejects.toThrow('already exists');
    });

    it('should use default isActive value if not provided', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.chatbot.create).mockResolvedValue(mockChatbot as any);

      await chatbotService.createChatbot({
        name: 'new-bot',
        displayName: 'New Bot',
        systemPrompt: 'Test',
      });

      expect(prisma.chatbot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isActive: true,
        }),
      });
    });
  });

  // ===========================================================================
  // updateChatbot
  // ===========================================================================

  describe('updateChatbot', () => {
    it('should update chatbot successfully', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.chatbot.update).mockResolvedValue({
        ...mockChatbot,
        displayName: 'Updated Name',
      } as any);

      const result = await chatbotService.updateChatbot(1, { displayName: 'Updated Name' });

      expect(result.displayName).toBe('Updated Name');
    });

    it('should throw 404 if chatbot not found', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(null);

      await expect(chatbotService.updateChatbot(999, { displayName: 'Test' })).rejects.toThrow(AppError);
      await expect(chatbotService.updateChatbot(999, { displayName: 'Test' })).rejects.toThrow('Chatbot not found');
    });

    it('should throw 400 when trying to change system chatbot name', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockSystemChatbot as any);

      await expect(chatbotService.updateChatbot(2, { name: 'new-name' })).rejects.toThrow(AppError);
      await expect(chatbotService.updateChatbot(2, { name: 'new-name' })).rejects.toThrow('Cannot change system chatbot name');
    });

    it('should allow updating system chatbot with same name', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockSystemChatbot as any);
      vi.mocked(prisma.chatbot.update).mockResolvedValue(mockSystemChatbot as any);

      const result = await chatbotService.updateChatbot(2, { name: 'system-bot', displayName: 'New Display' });

      expect(result).toBeDefined();
    });

    it('should throw 409 when changing to existing name', async () => {
      // Each call to updateChatbot makes two findUnique calls:
      // 1. Find the chatbot being updated
      // 2. Check if the new name already exists
      vi.mocked(prisma.chatbot.findUnique)
        .mockResolvedValueOnce(mockChatbot as any) // First updateChatbot: finding the chatbot to update
        .mockResolvedValueOnce(mockSystemChatbot as any) // First updateChatbot: checking name uniqueness (name exists!)
        .mockResolvedValueOnce(mockChatbot as any) // Second updateChatbot: finding the chatbot to update
        .mockResolvedValueOnce(mockSystemChatbot as any); // Second updateChatbot: checking name uniqueness (name exists!)

      await expect(chatbotService.updateChatbot(1, { name: 'system-bot' })).rejects.toThrow(AppError);
      await expect(chatbotService.updateChatbot(1, { name: 'system-bot' })).rejects.toThrow('already exists');
    });
  });

  // ===========================================================================
  // deleteChatbot
  // ===========================================================================

  describe('deleteChatbot', () => {
    it('should delete non-system chatbot', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.chatbot.delete).mockResolvedValue(mockChatbot as any);

      const result = await chatbotService.deleteChatbot(1);

      expect(result.message).toBe('Chatbot deleted successfully');
      expect(prisma.chatbot.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw 404 if chatbot not found', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(null);

      await expect(chatbotService.deleteChatbot(999)).rejects.toThrow(AppError);
      await expect(chatbotService.deleteChatbot(999)).rejects.toThrow('Chatbot not found');
    });

    it('should throw 400 when trying to delete system chatbot', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockSystemChatbot as any);

      await expect(chatbotService.deleteChatbot(2)).rejects.toThrow(AppError);
      await expect(chatbotService.deleteChatbot(2)).rejects.toThrow('Cannot delete system chatbot');
    });
  });

  // ===========================================================================
  // chatWithBot
  // ===========================================================================

  describe('chatWithBot', () => {
    it('should send message to active chatbot', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(chatService.chat).mockResolvedValue({
        reply: 'Hello! How can I help?',
        model: 'gpt-4o-mini',
        responseTime: 1000,
      });

      const result = await chatbotService.chatWithBot('test-bot', 'Hello', 'session123', 1);

      expect(result.reply).toBe('Hello! How can I help?');
      expect(chatService.chat).toHaveBeenCalledWith({
        message: 'Hello',
        module: 'chatbot-test-bot',
        sessionId: 'session123',
        systemPrompt: 'You are a test assistant.',
      }, 1);
    });

    it('should throw 400 if chatbot is inactive', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue({
        ...mockChatbot,
        isActive: false,
      } as any);

      await expect(chatbotService.chatWithBot('test-bot', 'Hello')).rejects.toThrow(AppError);
      await expect(chatbotService.chatWithBot('test-bot', 'Hello')).rejects.toThrow('currently inactive');
    });

    it('should throw 404 if chatbot not found', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(null);

      await expect(chatbotService.chatWithBot('nonexistent', 'Hello')).rejects.toThrow(AppError);
      await expect(chatbotService.chatWithBot('nonexistent', 'Hello')).rejects.toThrow('Chatbot not found');
    });
  });

  // ===========================================================================
  // seedDefaultChatbots
  // ===========================================================================

  describe('seedDefaultChatbots', () => {
    it('should seed default chatbots', async () => {
      vi.mocked(prisma.chatbot.upsert).mockResolvedValue(mockChatbot as any);

      const result = await chatbotService.seedDefaultChatbots();

      expect(result.message).toBe('Default chatbots seeded successfully');
      expect(prisma.chatbot.upsert).toHaveBeenCalledTimes(3);
    });

    it('should upsert each default chatbot', async () => {
      vi.mocked(prisma.chatbot.upsert).mockResolvedValue(mockChatbot as any);

      await chatbotService.seedDefaultChatbots();

      expect(prisma.chatbot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'research-methods' },
        })
      );
      expect(prisma.chatbot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'academic-writing' },
        })
      );
      expect(prisma.chatbot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'platform-guide' },
        })
      );
    });
  });
});
