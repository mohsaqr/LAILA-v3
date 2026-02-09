import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TutorService } from './tutor.service.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    tutorSession: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    tutorConversation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tutorMessage: {
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    tutorInteractionLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    chatbot: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock chat service
vi.mock('./chat.service.js', () => ({
  chatService: {
    chat: vi.fn(),
  },
}));

// Mock activity log service
vi.mock('./activityLog.service.js', () => ({
  activityLogService: {
    logActivity: vi.fn().mockResolvedValue({}),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import prisma from '../utils/prisma.js';
import { chatService } from './chat.service.js';

describe('TutorService', () => {
  let tutorService: TutorService;

  beforeEach(() => {
    tutorService = new TutorService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getOrCreateSession', () => {
    const mockAgents = [
      { id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide', isActive: true, category: 'tutor' },
    ];

    it('should return existing session if found', async () => {
      const mockSession = {
        id: 1,
        userId: 123,
        mode: 'manual',
        activeAgentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockConversations = [
        {
          id: 1,
          sessionId: 1,
          chatbotId: 1,
          chatbot: { id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide' },
          messages: [],
        },
      ];

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue({
        ...mockSession,
        conversations: mockConversations,
      } as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);

      const result = await tutorService.getOrCreateSession(123);

      expect(result.session.id).toBe(1);
      expect(result.session.mode).toBe('manual');
      expect(prisma.tutorSession.findUnique).toHaveBeenCalledWith({
        where: { userId: 123 },
        include: expect.any(Object),
      });
    });

    it('should create new session if not found', async () => {
      const mockNewSession = {
        id: 2,
        userId: 456,
        mode: 'manual',
        activeAgentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        conversations: [],
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.tutorSession.create).mockResolvedValue(mockNewSession as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);

      const result = await tutorService.getOrCreateSession(456);

      expect(result.session.userId).toBe(456);
      expect(result.session.mode).toBe('manual');
      expect(prisma.tutorSession.create).toHaveBeenCalled();
    });

    it('should still create session when activity logging fails', async () => {
      const { activityLogService } = await import('./activityLog.service.js');

      const mockNewSession = {
        id: 3,
        userId: 789,
        mode: 'manual',
        activeAgentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        conversations: [],
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.tutorSession.create).mockResolvedValue(mockNewSession as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(activityLogService.logActivity).mockRejectedValue(new Error('Log failed'));

      const result = await tutorService.getOrCreateSession(789);

      expect(result.session.userId).toBe(789);
      expect(result.session.mode).toBe('manual');
    });
  });

  describe('updateMode', () => {
    it('should update session mode', async () => {
      const mockUpdatedSession = {
        id: 1,
        userId: 123,
        mode: 'router',
      };

      vi.mocked(prisma.tutorSession.update).mockResolvedValue(mockUpdatedSession as any);

      const result = await tutorService.updateMode(123, 'router');

      expect(result.mode).toBe('router');
      expect(prisma.tutorSession.update).toHaveBeenCalledWith({
        where: { userId: 123 },
        data: { mode: 'router' },
      });
    });

    it('should throw error if session not found', async () => {
      vi.mocked(prisma.tutorSession.update).mockRejectedValue(new Error('Record not found'));

      await expect(tutorService.updateMode(999, 'router')).rejects.toThrow();
    });

    it('should still update mode when activity logging fails', async () => {
      const { activityLogService } = await import('./activityLog.service.js');

      const mockUpdatedSession = {
        id: 1,
        userId: 123,
        mode: 'collaborative',
      };

      vi.mocked(prisma.tutorSession.update).mockResolvedValue(mockUpdatedSession as any);
      vi.mocked(activityLogService.logActivity).mockRejectedValue(new Error('Log failed'));

      const result = await tutorService.updateMode(123, 'collaborative');

      expect(result.mode).toBe('collaborative');
    });
  });

  describe('getAvailableAgents', () => {
    it('should return active tutor agents', async () => {
      const mockAgents = [
        { id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide', isActive: true },
        { id: 2, name: 'helper-tutor', displayName: 'Helpful Guide', isActive: true },
      ];

      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);

      const result = await tutorService.getAvailableAgents();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('socratic-tutor');
      expect(prisma.chatbot.findMany).toHaveBeenCalledWith({
        where: { isActive: true, category: 'tutor' },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('clearConversation', () => {
    it('should delete all messages in conversation', async () => {
      const mockSession = { id: 1, userId: 123 };
      const mockConversation = {
        id: 10,
        sessionId: 1,
        chatbotId: 5,
        chatbot: { name: 'test-agent', displayName: 'Test Agent' },
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.deleteMany).mockResolvedValue({ count: 5 });
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);

      await tutorService.clearConversation(123, 5);

      expect(prisma.tutorMessage.deleteMany).toHaveBeenCalledWith({
        where: { conversationId: 10 },
      });
      expect(prisma.tutorConversation.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { messageCount: 0, lastMessageAt: null },
      });
    });

    it('should throw error if session not found', async () => {
      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(null);

      await expect(tutorService.clearConversation(999, 1)).rejects.toThrow('Session not found');
    });

    it('should still clear conversation when activity logging fails', async () => {
      const { activityLogService } = await import('./activityLog.service.js');

      const mockSession = { id: 1, userId: 123 };
      const mockConversation = {
        id: 10,
        sessionId: 1,
        chatbotId: 5,
        chatbot: { name: 'test-agent', displayName: 'Test Agent' },
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.deleteMany).mockResolvedValue({ count: 5 });
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(activityLogService.logActivity).mockRejectedValue(new Error('Log failed'));

      // Should not throw
      await tutorService.clearConversation(123, 5);

      expect(prisma.tutorMessage.deleteMany).toHaveBeenCalledWith({
        where: { conversationId: 10 },
      });
    });
  });

  describe('analyzeWithKeywords', () => {
    const mockAgents = [
      { id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide', description: 'Guides through questions' },
      { id: 2, name: 'helper-tutor', displayName: 'Helpful Guide', description: 'Clear explanations' },
      { id: 3, name: 'project-tutor', displayName: 'Project Coach', description: 'Practical help' },
      { id: 4, name: 'beatrice-peer', displayName: 'Beatrice', description: 'Kind and encouraging' },
      { id: 5, name: 'laila-peer', displayName: 'Laila', description: 'Smart and argumentative' },
      { id: 6, name: 'carmen-peer', displayName: 'Carmen', description: 'Friendly classmate' },
    ];

    it('should route emotional messages to Beatrice', () => {
      // Access private method via any
      const result = (tutorService as any).analyzeWithKeywords(
        'I feel so frustrated and dumb, I want to give up',
        mockAgents
      );

      expect(result.selectedAgent.name).toBe('beatrice-peer');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should route debate/discussion requests to discussion-capable agents', () => {
      const result = (tutorService as any).analyzeWithKeywords(
        'I disagree with this approach, what do you think?',
        mockAgents
      );

      // Both laila-peer and socratic-tutor get boosted for debate keywords
      // When scores tie, first agent in iteration order wins
      expect(['laila-peer', 'socratic-tutor']).toContain(result.selectedAgent.name);
      expect(result.reason).toBe('Intellectual discussion');
    });

    it('should route conceptual questions to Socratic', () => {
      const result = (tutorService as any).analyzeWithKeywords(
        'Why does recursion work this way? I want to understand the concept.',
        mockAgents
      );

      // Socratic gets boosted for conceptual understanding keywords
      expect(result.selectedAgent.name).toBe('socratic-tutor');
    });

    it('should route how-to questions to Helper', () => {
      const result = (tutorService as any).analyzeWithKeywords(
        'How do I implement a binary search? Show me the steps.',
        mockAgents
      );

      expect(result.selectedAgent.name).toBe('helper-tutor');
    });

    it('should route project/debug questions to practical agents', () => {
      const result = (tutorService as any).analyzeWithKeywords(
        'My code has a bug and I need to debug this error in my project.',
        mockAgents
      );

      // Both helper-tutor and project-tutor get boosted for project/coding keywords
      // When scores tie, first agent in iteration order wins
      expect(['helper-tutor', 'project-tutor']).toContain(result.selectedAgent.name);
      expect(result.reason).toBe('Hands-on technical work');
    });

    it('should route casual/stuck messages to supportive agents', () => {
      const result = (tutorService as any).analyzeWithKeywords(
        'Hey, I am stuck on this problem and feel lost.',
        mockAgents
      );

      // Both carmen-peer and beatrice-peer get boosted for casual support keywords
      // When scores tie, first agent in iteration order wins
      expect(['carmen-peer', 'beatrice-peer']).toContain(result.selectedAgent.name);
      expect(result.reason).toBe('Casual peer support');
    });

    it('should boost score when message words match agent description', () => {
      const agentsWithDetailedDescription = [
        { id: 1, name: 'math-tutor', displayName: 'Math Tutor', description: 'Helps with calculus and algebra problems', personality: 'patient and methodical' },
        { id: 2, name: 'writing-tutor', displayName: 'Writing Tutor', description: 'Assists with essays and grammar', personality: 'creative and encouraging' },
      ];

      // Use a message with words that match the math tutor's description
      const result = (tutorService as any).analyzeWithKeywords(
        'I need help with calculus derivatives and algebra equations',
        agentsWithDetailedDescription
      );

      // The math tutor should be selected due to description matching
      expect(result.selectedAgent.name).toBe('math-tutor');
    });

    it('should boost score when message words match agent personality', () => {
      const agentsWithPersonality = [
        { id: 1, name: 'strict-tutor', displayName: 'Strict Tutor', description: 'Academic tutor', personality: 'rigorous and demanding' },
        { id: 2, name: 'creative-tutor', displayName: 'Creative Tutor', description: 'Art tutor', personality: 'creative and imaginative' },
      ];

      const result = (tutorService as any).analyzeWithKeywords(
        'I want to be more creative and imaginative with my project',
        agentsWithPersonality
      );

      expect(result.selectedAgent.name).toBe('creative-tutor');
    });

    it('should return alternatives sorted by score', () => {
      const result = (tutorService as any).analyzeWithKeywords(
        'Why does this work?',
        mockAgents
      );

      expect(result.alternatives).toBeDefined();
      expect(result.alternatives.length).toBe(mockAgents.length - 1);
      // All alternatives should not include the selected agent
      expect(result.alternatives.find((a: any) => a.agentId === result.selectedAgent.id)).toBeUndefined();
    });
  });

  // ===========================================================================
  // setActiveAgent
  // ===========================================================================

  describe('setActiveAgent', () => {
    it('should set active agent when chatbot exists and is active', async () => {
      const mockChatbot = { id: 5, name: 'helper-tutor', displayName: 'Helpful Guide', isActive: true, personality: 'helpful' };
      const mockSession = { id: 1, userId: 123, mode: 'manual', activeAgentId: 5, createdAt: new Date(), updatedAt: new Date() };

      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.tutorSession.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);

      const result = await tutorService.setActiveAgent(123, 5);

      expect(result.activeAgentId).toBe(5);
      expect(prisma.chatbot.findUnique).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(prisma.tutorSession.update).toHaveBeenCalledWith({
        where: { userId: 123 },
        data: { activeAgentId: 5 },
      });
    });

    it('should throw 404 when chatbot not found', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(null);

      await expect(tutorService.setActiveAgent(123, 999)).rejects.toThrow('Agent not found or inactive');
    });

    it('should throw 404 when chatbot is inactive', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue({ id: 5, isActive: false } as any);

      await expect(tutorService.setActiveAgent(123, 5)).rejects.toThrow('Agent not found or inactive');
    });

    it('should still set active agent when activity logging fails', async () => {
      const { activityLogService } = await import('./activityLog.service.js');

      const mockChatbot = { id: 5, name: 'helper-tutor', displayName: 'Helpful Guide', isActive: true, personality: 'helpful' };
      const mockSession = { id: 1, userId: 123, mode: 'manual', activeAgentId: 5, createdAt: new Date(), updatedAt: new Date() };

      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.tutorSession.update).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(activityLogService.logActivity).mockRejectedValue(new Error('Log failed'));

      const result = await tutorService.setActiveAgent(123, 5);

      expect(result.activeAgentId).toBe(5);
    });
  });

  // ===========================================================================
  // getConversations
  // ===========================================================================

  describe('getConversations', () => {
    it('should return empty array if no session', async () => {
      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(null);

      const result = await tutorService.getConversations(123);

      expect(result).toEqual([]);
    });

    it('should return conversations with preview', async () => {
      const mockSession = { id: 1, userId: 123 };
      const mockConversations = [
        {
          id: 10,
          sessionId: 1,
          chatbotId: 5,
          lastMessageAt: new Date(),
          messageCount: 5,
          createdAt: new Date(),
          chatbot: { id: 5, name: 'helper-tutor', displayName: 'Helpful Guide' },
          messages: [{ id: 100, role: 'assistant', content: 'Hello there!', createdAt: new Date() }],
        },
      ];

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.tutorConversation.findMany).mockResolvedValue(mockConversations as any);

      const result = await tutorService.getConversations(123);

      expect(result).toHaveLength(1);
      expect(result[0].chatbotId).toBe(5);
      expect(result[0].lastMessage?.content).toBe('Hello there!');
    });

    it('should handle conversation with no messages', async () => {
      const mockSession = { id: 1, userId: 123 };
      const mockConversations = [
        {
          id: 10,
          sessionId: 1,
          chatbotId: 5,
          lastMessageAt: null,
          messageCount: 0,
          createdAt: new Date(),
          chatbot: { id: 5, name: 'helper-tutor', displayName: 'Helpful Guide' },
          messages: [],
        },
      ];

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.tutorConversation.findMany).mockResolvedValue(mockConversations as any);

      const result = await tutorService.getConversations(123);

      expect(result[0].lastMessage).toBeNull();
    });
  });

  // ===========================================================================
  // getOrCreateConversation
  // ===========================================================================

  describe('getOrCreateConversation', () => {
    it('should throw 404 if session not found', async () => {
      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(null);

      await expect(tutorService.getOrCreateConversation(123, 5)).rejects.toThrow('Session not found');
    });

    it('should return existing conversation', async () => {
      const mockSession = { id: 1, userId: 123 };
      const mockConversation = {
        id: 10,
        sessionId: 1,
        chatbotId: 5,
        lastMessageAt: new Date(),
        messageCount: 3,
        createdAt: new Date(),
        messages: [
          { id: 1, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() },
          { id: 2, conversationId: 10, role: 'assistant', content: 'Hi!', createdAt: new Date() },
        ],
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);

      const result = await tutorService.getOrCreateConversation(123, 5);

      expect(result.id).toBe(10);
      expect(result.messages).toHaveLength(2);
      expect(prisma.tutorConversation.create).not.toHaveBeenCalled();
    });

    it('should create conversation if not exists', async () => {
      const mockSession = { id: 1, userId: 123 };
      const mockNewConversation = {
        id: 20,
        sessionId: 1,
        chatbotId: 5,
        lastMessageAt: null,
        messageCount: 0,
        createdAt: new Date(),
        messages: [],
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.tutorConversation.create).mockResolvedValue(mockNewConversation as any);

      const result = await tutorService.getOrCreateConversation(123, 5);

      expect(result.id).toBe(20);
      expect(result.messages).toHaveLength(0);
      expect(prisma.tutorConversation.create).toHaveBeenCalledWith({
        data: { sessionId: 1, chatbotId: 5 },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    });
  });

  // ===========================================================================
  // getMessageHistory
  // ===========================================================================

  describe('getMessageHistory', () => {
    it('should return message history', async () => {
      const mockMessages = [
        { id: 1, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() },
        { id: 2, conversationId: 10, role: 'assistant', content: 'Hi!', aiModel: 'gpt-4o-mini', createdAt: new Date() },
      ];

      vi.mocked(prisma.tutorMessage.findMany).mockResolvedValue(mockMessages as any);

      const result = await tutorService.getMessageHistory(10);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });

    it('should apply limit parameter', async () => {
      vi.mocked(prisma.tutorMessage.findMany).mockResolvedValue([]);

      await tutorService.getMessageHistory(10, 5);

      expect(prisma.tutorMessage.findMany).toHaveBeenCalledWith({
        where: { conversationId: 10 },
        orderBy: { createdAt: 'asc' },
        take: 5,
      });
    });

    it('should use default limit of 50', async () => {
      vi.mocked(prisma.tutorMessage.findMany).mockResolvedValue([]);

      await tutorService.getMessageHistory(10);

      expect(prisma.tutorMessage.findMany).toHaveBeenCalledWith({
        where: { conversationId: 10 },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
    });
  });

  // ===========================================================================
  // sendMessage
  // ===========================================================================

  describe('sendMessage', () => {
    const mockChatbot = {
      id: 5,
      name: 'helper-tutor',
      displayName: 'Helpful Guide',
      isActive: true,
      systemPrompt: 'You are a helpful tutor.',
      temperature: 0.7,
      dosRules: null,
      dontsRules: null,
    };

    it('should throw 404 if session not found', async () => {
      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(null);

      await expect(tutorService.sendMessage(123, 5, 'Hello')).rejects.toThrow('Session not found');
    });

    it('should throw 404 if chatbot not found', async () => {
      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue({ id: 1, userId: 123, mode: 'manual' } as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(null);

      await expect(tutorService.sendMessage(123, 5, 'Hello')).rejects.toThrow('Agent not found or inactive');
    });

    it('should throw 404 if chatbot is inactive', async () => {
      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue({ id: 1, userId: 123, mode: 'manual' } as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue({ id: 5, isActive: false } as any);

      await expect(tutorService.sendMessage(123, 5, 'Hello')).rejects.toThrow('Agent not found or inactive');
    });

    it('should handle manual mode message', async () => {
      const mockSession = { id: 1, userId: 123, mode: 'manual' };
      const mockConversation = {
        id: 10,
        sessionId: 1,
        chatbotId: 5,
        lastMessageAt: null,
        messageCount: 0,
        createdAt: new Date(),
        messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() };
      const mockAssistantMsg = {
        id: 101,
        conversationId: 10,
        role: 'assistant',
        content: 'Hi there!',
        aiModel: 'gpt-4o-mini',
        aiProvider: 'openai',
        responseTimeMs: 500,
        temperature: 0.7,
        createdAt: new Date(),
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create)
        .mockResolvedValueOnce(mockUserMsg as any)
        .mockResolvedValueOnce(mockAssistantMsg as any);
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockResolvedValue({ reply: 'Hi there!', model: 'gpt-4o-mini' });

      const result = await tutorService.sendMessage(123, 5, 'Hello');

      expect(result.userMessage.content).toBe('Hello');
      expect(result.assistantMessage.content).toBe('Hi there!');
      expect(chatService.chat).toHaveBeenCalled();
    });

    it('should handle router mode and route to best agent', async () => {
      const mockSession = { id: 1, userId: 123, mode: 'router' };
      const mockAgents = [
        { id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide', isActive: true, category: 'tutor' },
        { id: 5, name: 'helper-tutor', displayName: 'Helpful Guide', isActive: true, category: 'tutor' },
      ];
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 5, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: 'How do I code?', createdAt: new Date() };
      const mockAssistantMsg = {
        id: 101, conversationId: 10, role: 'assistant', content: 'Let me help!', aiModel: 'gpt-4o-mini',
        aiProvider: 'openai', responseTimeMs: 500, temperature: 0.7, createdAt: new Date(),
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create)
        .mockResolvedValueOnce(mockUserMsg as any)
        .mockResolvedValueOnce(mockAssistantMsg as any);
      vi.mocked(prisma.tutorMessage.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockResolvedValue({ reply: 'Let me help!', model: 'gpt-4o-mini' });

      const result = await tutorService.sendMessage(123, 5, 'How do I code?');

      expect(result.routingInfo).toBeDefined();
      expect(result.routingInfo?.selectedAgent).toBeDefined();
    });

    it('should handle random mode and pick random agent', async () => {
      const mockSession = { id: 1, userId: 123, mode: 'random' };
      const mockAgents = [
        { id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide', isActive: true, category: 'tutor' },
        { id: 5, name: 'helper-tutor', displayName: 'Helpful Guide', isActive: true, category: 'tutor' },
      ];
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 5, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() };
      const mockAssistantMsg = {
        id: 101, conversationId: 10, role: 'assistant', content: 'Hi!', aiModel: 'gpt-4o-mini',
        aiProvider: 'openai', responseTimeMs: 500, temperature: 0.7, createdAt: new Date(),
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create)
        .mockResolvedValueOnce(mockUserMsg as any)
        .mockResolvedValueOnce(mockAssistantMsg as any);
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockResolvedValue({ reply: 'Hi!', model: 'gpt-4o-mini' });

      const result = await tutorService.sendMessage(123, 5, 'Hello');

      expect(result.routingInfo).toBeDefined();
      expect(result.routingInfo?.reason).toBe('Randomly selected');
      expect(result.routingInfo?.confidence).toBe(1.0);
    });

    it('should throw error when router mode has no agents', async () => {
      const mockSession = { id: 1, userId: 123, mode: 'router' };
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 5, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue([]);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);

      await expect(tutorService.sendMessage(123, 5, 'Hello')).rejects.toThrow('No agents available');
    });

    it('should handle AI error gracefully', async () => {
      const mockSession = { id: 1, userId: 123, mode: 'manual' };
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 5, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create).mockResolvedValue(mockUserMsg as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockRejectedValue(new Error('API Error'));

      await expect(tutorService.sendMessage(123, 5, 'Hello')).rejects.toThrow('Failed to get AI response');
    });
  });

  // ===========================================================================
  // getInteractionLogs
  // ===========================================================================

  describe('getInteractionLogs', () => {
    it('should return logs with no filters', async () => {
      const mockLogs = [
        { id: 1, userId: 123, eventType: 'message_sent', timestamp: new Date() },
        { id: 2, userId: 456, eventType: 'message_received', timestamp: new Date() },
      ];

      vi.mocked(prisma.tutorInteractionLog.findMany).mockResolvedValue(mockLogs as any);

      const result = await tutorService.getInteractionLogs();

      expect(result).toHaveLength(2);
      expect(prisma.tutorInteractionLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });

    it('should apply userId filter', async () => {
      vi.mocked(prisma.tutorInteractionLog.findMany).mockResolvedValue([]);

      await tutorService.getInteractionLogs({ userId: 123 });

      expect(prisma.tutorInteractionLog.findMany).toHaveBeenCalledWith({
        where: { userId: 123 },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });

    it('should apply date range filters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      vi.mocked(prisma.tutorInteractionLog.findMany).mockResolvedValue([]);

      await tutorService.getInteractionLogs({ startDate, endDate });

      expect(prisma.tutorInteractionLog.findMany).toHaveBeenCalledWith({
        where: { timestamp: { gte: startDate, lte: endDate } },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });

    it('should apply limit filter', async () => {
      vi.mocked(prisma.tutorInteractionLog.findMany).mockResolvedValue([]);

      await tutorService.getInteractionLogs({ limit: 10 });

      expect(prisma.tutorInteractionLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { timestamp: 'desc' },
        take: 10,
      });
    });

    it('should apply all filters together', async () => {
      const startDate = new Date('2024-01-01');

      vi.mocked(prisma.tutorInteractionLog.findMany).mockResolvedValue([]);

      await tutorService.getInteractionLogs({
        userId: 123,
        sessionId: 1,
        eventType: 'message_sent',
        startDate,
        limit: 50,
      });

      expect(prisma.tutorInteractionLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: 123,
          sessionId: 1,
          eventType: 'message_sent',
          timestamp: { gte: startDate },
        },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });
    });
  });

  // ===========================================================================
  // getStats
  // ===========================================================================

  describe('getStats', () => {
    it('should return aggregate statistics', async () => {
      vi.mocked(prisma.tutorSession.count).mockResolvedValue(100);
      vi.mocked(prisma.tutorMessage.count).mockResolvedValue(500);
      vi.mocked(prisma.tutorInteractionLog.groupBy)
        .mockResolvedValueOnce([
          { mode: 'manual', _count: 300 },
          { mode: 'router', _count: 150 },
        ] as any)
        .mockResolvedValueOnce([
          { chatbotName: 'helper-tutor', _count: 200 },
          { chatbotName: 'socratic-tutor', _count: 250 },
        ] as any);
      vi.mocked(prisma.tutorInteractionLog.aggregate).mockResolvedValue({
        _avg: { responseTimeMs: 1500 },
      } as any);

      const result = await tutorService.getStats();

      expect(result.totalSessions).toBe(100);
      expect(result.totalMessages).toBe(500);
      expect(result.messagesByMode).toHaveLength(2);
      expect(result.messagesByAgent).toHaveLength(2);
      expect(result.avgResponseTimeMs).toBe(1500);
    });

    it('should apply date range filters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      vi.mocked(prisma.tutorSession.count).mockResolvedValue(50);
      vi.mocked(prisma.tutorMessage.count).mockResolvedValue(200);
      vi.mocked(prisma.tutorInteractionLog.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.tutorInteractionLog.aggregate).mockResolvedValue({ _avg: { responseTimeMs: null } } as any);

      await tutorService.getStats(startDate, endDate);

      expect(prisma.tutorInteractionLog.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: { gte: startDate, lte: endDate },
          }),
        })
      );
    });
  });

  // ===========================================================================
  // clearConversation - conversation not found
  // ===========================================================================

  describe('clearConversation - conversation not found', () => {
    it('should throw 404 when conversation not found', async () => {
      const mockSession = { id: 1, userId: 123 };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(null);

      await expect(tutorService.clearConversation(123, 999)).rejects.toThrow('Conversation not found');
    });
  });

  // ===========================================================================
  // parseMentions (private method)
  // ===========================================================================

  describe('parseMentions', () => {
    const mockAgents = [
      { id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide' },
      { id: 2, name: 'beatrice-peer', displayName: 'Beatrice' },
    ];

    it('should return empty array when no mentions', () => {
      const result = (tutorService as any).parseMentions('Hello, how are you?', mockAgents);
      expect(result).toEqual([]);
    });

    it('should parse @simple-name mentions', () => {
      const result = (tutorService as any).parseMentions('Hey @socratic-tutor help me', mockAgents);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('socratic-tutor');
    });

    it('should parse @"Display Name" mentions', () => {
      const result = (tutorService as any).parseMentions('Hi @"Socratic Guide" explain this', mockAgents);
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Socratic Guide');
    });

    it('should parse multiple mentions', () => {
      const result = (tutorService as any).parseMentions('@beatrice @socratic-tutor help me', mockAgents);
      expect(result).toHaveLength(2);
    });
  });

  // ===========================================================================
  // stripMentions (private method)
  // ===========================================================================

  describe('stripMentions', () => {
    it('should remove simple mentions', () => {
      const result = (tutorService as any).stripMentions('Hey @beatrice help me');
      expect(result).toBe('Hey help me');
    });

    it('should remove quoted mentions', () => {
      const result = (tutorService as any).stripMentions('Hi @"Socratic Guide" explain this');
      expect(result).toBe('Hi explain this');
    });

    it('should remove multiple mentions', () => {
      const result = (tutorService as any).stripMentions('@beatrice @socratic-tutor help me please');
      expect(result).toBe('help me please');
    });

    it('should handle message with no mentions', () => {
      const result = (tutorService as any).stripMentions('Hello world');
      expect(result).toBe('Hello world');
    });
  });

  // ===========================================================================
  // selectRelevantAgents (private method)
  // ===========================================================================

  describe('selectRelevantAgents', () => {
    const mockAgents = [
      { id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide', description: 'Guides through questions' },
      { id: 2, name: 'helper-tutor', displayName: 'Helpful Guide', description: 'Clear explanations' },
      { id: 3, name: 'beatrice-peer', displayName: 'Beatrice', description: 'Kind and encouraging' },
    ];

    it('should return all agents if count <= maxAgents', async () => {
      const result = await (tutorService as any).selectRelevantAgents('Hello', mockAgents, 5);
      expect(result).toHaveLength(3);
    });

    it('should select top N agents based on keyword scoring', async () => {
      const result = await (tutorService as any).selectRelevantAgents('Why does this work?', mockAgents, 2);
      expect(result).toHaveLength(2);
    });
  });

  // ===========================================================================
  // sendMessage - collaborative mode
  // ===========================================================================

  describe('sendMessage - collaborative mode', () => {
    const mockChatbot = {
      id: 5,
      name: 'helper-tutor',
      displayName: 'Helpful Guide',
      isActive: true,
      systemPrompt: 'You are a helpful tutor.',
      temperature: 0.7,
      category: 'tutor',
    };

    const mockAgents = [
      { id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide', isActive: true, category: 'tutor', systemPrompt: 'You are Socratic.', temperature: 0.7 },
      { id: 5, name: 'helper-tutor', displayName: 'Helpful Guide', isActive: true, category: 'tutor', systemPrompt: 'You are helpful.', temperature: 0.7 },
    ];

    it('should handle collaborative mode with parallel style', async () => {
      const mockSession = { id: 1, userId: 123, mode: 'collaborative' };
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 1, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() };
      const mockAssistantMsg = {
        id: 101, conversationId: 10, role: 'assistant', content: 'Response', aiModel: 'gpt-4o-mini',
        aiProvider: 'openai', responseTimeMs: 500, createdAt: new Date(), synthesizedFrom: '{}',
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create)
        .mockResolvedValueOnce(mockUserMsg as any)
        .mockResolvedValueOnce(mockAssistantMsg as any);
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockResolvedValue({ reply: 'I can help!', model: 'gpt-4o-mini' });

      const result = await tutorService.sendMessage(123, 5, 'Hello', undefined, { style: 'parallel', maxAgents: 2 });

      expect(result.collaborativeInfo).toBeDefined();
      expect(result.collaborativeInfo?.style).toBe('parallel');
    });

    it('should throw error when collaborative mode has no agents', async () => {
      const mockSession = { id: 1, userId: 123, mode: 'collaborative' };
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 5, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue([]);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);

      await expect(tutorService.sendMessage(123, 5, 'Hello')).rejects.toThrow('No agents available');
    });

    it('should handle collaborative mode with @mentions', async () => {
      const mockSession = { id: 1, userId: 123, mode: 'collaborative' };
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 1, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: '@beatrice help me', createdAt: new Date() };
      const mockAssistantMsg = {
        id: 101, conversationId: 10, role: 'assistant', content: 'Response', aiModel: 'gpt-4o-mini',
        aiProvider: 'openai', responseTimeMs: 500, createdAt: new Date(), synthesizedFrom: '{}',
      };
      const agentsWithBeatrice = [
        ...mockAgents,
        { id: 3, name: 'beatrice-peer', displayName: 'Beatrice', isActive: true, category: 'tutor', systemPrompt: 'You are Beatrice.', temperature: 0.7 },
      ];

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(agentsWithBeatrice as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create)
        .mockResolvedValueOnce(mockUserMsg as any)
        .mockResolvedValueOnce(mockAssistantMsg as any);
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockResolvedValue({ reply: 'I can help!', model: 'gpt-4o-mini' });

      const result = await tutorService.sendMessage(123, 5, '@beatrice help me');

      expect(result.collaborativeInfo).toBeDefined();
      expect(result.collaborativeInfo?.mentionedAgents).toContain('Beatrice');
    });

    it('should handle collaborative mode with sequential style', async () => {
      const mockSession = { id: 1, userId: 123, mode: 'collaborative' };
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 1, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() };
      const mockAssistantMsg = {
        id: 101, conversationId: 10, role: 'assistant', content: 'Response', aiModel: 'gpt-4o-mini',
        aiProvider: 'openai', responseTimeMs: 500, createdAt: new Date(), synthesizedFrom: '{}',
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create)
        .mockResolvedValueOnce(mockUserMsg as any)
        .mockResolvedValueOnce(mockAssistantMsg as any);
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockResolvedValue({ reply: 'Sequential response', model: 'gpt-4o-mini' });

      const result = await tutorService.sendMessage(123, 5, 'Hello', undefined, { style: 'sequential', maxAgents: 2 });

      expect(result.collaborativeInfo?.style).toBe('sequential');
    });

    it('should handle collaborative mode with debate style', async () => {
      const mockSession = { id: 1, userId: 123, mode: 'collaborative' };
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 1, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() };
      const mockAssistantMsg = {
        id: 101, conversationId: 10, role: 'assistant', content: 'Response', aiModel: 'gpt-4o-mini',
        aiProvider: 'openai', responseTimeMs: 500, createdAt: new Date(), synthesizedFrom: '{}',
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create)
        .mockResolvedValueOnce(mockUserMsg as any)
        .mockResolvedValueOnce(mockAssistantMsg as any);
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockResolvedValue({ reply: 'Debate response', model: 'gpt-4o-mini' });

      const result = await tutorService.sendMessage(123, 5, 'Hello', undefined, { style: 'debate', maxAgents: 2 });

      expect(result.collaborativeInfo?.style).toBe('debate');
      expect(result.collaborativeInfo?.totalRounds).toBe(2);
    });

    it('should handle collaborative mode with random style', async () => {
      const mockSession = { id: 1, userId: 123, mode: 'collaborative' };
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 1, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() };
      const mockAssistantMsg = {
        id: 101, conversationId: 10, role: 'assistant', content: 'Response', aiModel: 'gpt-4o-mini',
        aiProvider: 'openai', responseTimeMs: 500, createdAt: new Date(), synthesizedFrom: '{}',
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create)
        .mockResolvedValueOnce(mockUserMsg as any)
        .mockResolvedValueOnce(mockAssistantMsg as any);
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockResolvedValue({ reply: 'Random response', model: 'gpt-4o-mini' });

      const result = await tutorService.sendMessage(123, 5, 'Hello', undefined, { style: 'random' });

      expect(result.collaborativeInfo?.style).toBe('random');
    });

    it('should handle collaborative mode with selectedAgentIds', async () => {
      const mockSession = { id: 1, userId: 123, mode: 'collaborative' };
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 1, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() };
      const mockAssistantMsg = {
        id: 101, conversationId: 10, role: 'assistant', content: 'Response', aiModel: 'gpt-4o-mini',
        aiProvider: 'openai', responseTimeMs: 500, createdAt: new Date(), synthesizedFrom: '{}',
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create)
        .mockResolvedValueOnce(mockUserMsg as any)
        .mockResolvedValueOnce(mockAssistantMsg as any);
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockResolvedValue({ reply: 'Selected response', model: 'gpt-4o-mini' });

      const result = await tutorService.sendMessage(123, 5, 'Hello', undefined, { selectedAgentIds: [1, 5] });

      expect(result.collaborativeInfo).toBeDefined();
    });
  });

  // ===========================================================================
  // getAgentResponse (private method) - error handling
  // ===========================================================================

  describe('getAgentResponse - error handling', () => {
    const mockAgent = {
      id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide', systemPrompt: 'You are Socratic.', temperature: 0.7,
    };

    it('should return error message when chat fails', async () => {
      vi.mocked(chatService.chat).mockRejectedValue(new Error('API Error'));

      const result = await (tutorService as any).getAgentResponse(mockAgent, 'Hello', [], 123);

      expect(result.contribution).toBe('[Socratic Guide was unable to respond]');
    });
  });

  // ===========================================================================
  // sendMessage - dosRules and dontsRules parsing
  // ===========================================================================

  describe('sendMessage - dosRules and dontsRules parsing', () => {
    const mockChatbotWithRules = {
      id: 5,
      name: 'helper-tutor',
      displayName: 'Helpful Guide',
      isActive: true,
      systemPrompt: 'You are a helpful tutor.',
      temperature: 0.7,
      dosRules: '["Be friendly", "Use examples"]',
      dontsRules: '["Don\'t be condescending", "Don\'t use jargon"]',
    };

    it('should parse and apply dosRules and dontsRules', async () => {
      const mockSession = { id: 1, userId: 123, mode: 'manual' };
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 5, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() };
      const mockAssistantMsg = {
        id: 101, conversationId: 10, role: 'assistant', content: 'Hi there!', aiModel: 'gpt-4o-mini',
        aiProvider: 'openai', responseTimeMs: 500, temperature: 0.7, createdAt: new Date(),
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbotWithRules as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create)
        .mockResolvedValueOnce(mockUserMsg as any)
        .mockResolvedValueOnce(mockAssistantMsg as any);
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockResolvedValue({ reply: 'Hi there!', model: 'gpt-4o-mini' });

      const result = await tutorService.sendMessage(123, 5, 'Hello');

      expect(result.userMessage.content).toBe('Hello');
      // Verify the system prompt was enhanced with dos/donts
      const chatCall = vi.mocked(chatService.chat).mock.calls[0][0];
      expect(chatCall.systemPrompt).toContain('DO:');
      expect(chatCall.systemPrompt).toContain('Be friendly');
      expect(chatCall.systemPrompt).toContain("DON'T:");
      expect(chatCall.systemPrompt).toContain("Don't be condescending");
    });

    it('should handle invalid JSON in dosRules gracefully', async () => {
      const mockChatbotBadDos = {
        ...mockChatbotWithRules,
        dosRules: 'invalid json',
        dontsRules: null,
      };
      const mockSession = { id: 1, userId: 123, mode: 'manual' };
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 5, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() };
      const mockAssistantMsg = {
        id: 101, conversationId: 10, role: 'assistant', content: 'Hi!', aiModel: 'gpt-4o-mini',
        aiProvider: 'openai', responseTimeMs: 500, temperature: 0.7, createdAt: new Date(),
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbotBadDos as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create)
        .mockResolvedValueOnce(mockUserMsg as any)
        .mockResolvedValueOnce(mockAssistantMsg as any);
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockResolvedValue({ reply: 'Hi!', model: 'gpt-4o-mini' });

      // Should not throw, should just skip the invalid rules
      const result = await tutorService.sendMessage(123, 5, 'Hello');
      expect(result.assistantMessage.content).toBe('Hi!');
    });

    it('should handle invalid JSON in dontsRules gracefully', async () => {
      const mockChatbotBadDonts = {
        ...mockChatbotWithRules,
        dosRules: null,
        dontsRules: 'invalid json',
      };
      const mockSession = { id: 1, userId: 123, mode: 'manual' };
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 5, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() };
      const mockAssistantMsg = {
        id: 101, conversationId: 10, role: 'assistant', content: 'Hi!', aiModel: 'gpt-4o-mini',
        aiProvider: 'openai', responseTimeMs: 500, temperature: 0.7, createdAt: new Date(),
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbotBadDonts as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create)
        .mockResolvedValueOnce(mockUserMsg as any)
        .mockResolvedValueOnce(mockAssistantMsg as any);
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockResolvedValue({ reply: 'Hi!', model: 'gpt-4o-mini' });

      // Should not throw
      const result = await tutorService.sendMessage(123, 5, 'Hello');
      expect(result.assistantMessage.content).toBe('Hi!');
    });

    it('should handle empty arrays in dosRules and dontsRules', async () => {
      const mockChatbotEmptyRules = {
        ...mockChatbotWithRules,
        dosRules: '[]',
        dontsRules: '[]',
      };
      const mockSession = { id: 1, userId: 123, mode: 'manual' };
      const mockConversation = {
        id: 10, sessionId: 1, chatbotId: 5, lastMessageAt: null, messageCount: 0, createdAt: new Date(), messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() };
      const mockAssistantMsg = {
        id: 101, conversationId: 10, role: 'assistant', content: 'Hi!', aiModel: 'gpt-4o-mini',
        aiProvider: 'openai', responseTimeMs: 500, temperature: 0.7, createdAt: new Date(),
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbotEmptyRules as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create)
        .mockResolvedValueOnce(mockUserMsg as any)
        .mockResolvedValueOnce(mockAssistantMsg as any);
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockResolvedValue({ reply: 'Hi!', model: 'gpt-4o-mini' });

      const result = await tutorService.sendMessage(123, 5, 'Hello');
      // Empty arrays should be skipped
      const chatCall = vi.mocked(chatService.chat).mock.calls[0][0];
      expect(chatCall.systemPrompt).not.toContain('DO:');
      expect(chatCall.systemPrompt).not.toContain("DON'T:");
    });
  });

  // ===========================================================================
  // analyzeWithAI - AI-based routing
  // ===========================================================================

  describe('analyzeWithAI', () => {
    const mockAgents = [
      { id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide', description: 'Uses Socratic questioning' },
      { id: 5, name: 'helper-tutor', displayName: 'Helpful Guide', description: 'Direct help with tasks' },
    ];

    it('should parse valid JSON response from AI and return routing info', async () => {
      vi.mocked(chatService.chat).mockResolvedValue({
        reply: '{"selectedAgent": "socratic-tutor", "reason": "Question requires exploration", "confidence": 0.9, "scores": {"socratic-tutor": 0.9, "helper-tutor": 0.5}}',
        model: 'gpt-4o-mini',
      });

      const result = await (tutorService as any).analyzeWithAI('Why does gravity work?', mockAgents);

      expect(result.selectedAgent.name).toBe('socratic-tutor');
      expect(result.reason).toBe('Question requires exploration');
      expect(result.confidence).toBe(0.9);
      expect(result.alternatives).toHaveLength(1);
    });

    it('should handle JSON wrapped in markdown code block', async () => {
      vi.mocked(chatService.chat).mockResolvedValue({
        reply: '```json\n{"selectedAgent": "helper-tutor", "reason": "Needs direct help", "confidence": 0.85}\n```',
        model: 'gpt-4o-mini',
      });

      const result = await (tutorService as any).analyzeWithAI('How do I do this?', mockAgents);

      expect(result.selectedAgent.name).toBe('helper-tutor');
      expect(result.reason).toBe('Needs direct help');
    });

    it('should fallback to keyword routing when AI returns unknown agent', async () => {
      vi.mocked(chatService.chat).mockResolvedValue({
        reply: '{"selectedAgent": "unknown-agent", "reason": "Test", "confidence": 0.8}',
        model: 'gpt-4o-mini',
      });

      const result = await (tutorService as any).analyzeWithAI('How do I code?', mockAgents);

      // Should fallback to keyword routing, which returns a valid agent
      expect(result.selectedAgent).toBeDefined();
      expect(['socratic-tutor', 'helper-tutor']).toContain(result.selectedAgent.name);
    });

    it('should throw error when AI returns no JSON', async () => {
      vi.mocked(chatService.chat).mockResolvedValue({
        reply: 'I think you should use the socratic tutor.',
        model: 'gpt-4o-mini',
      });

      await expect((tutorService as any).analyzeWithAI('Hello', mockAgents))
        .rejects.toThrow('Invalid AI response format');
    });

    it('should throw error when AI returns invalid JSON', async () => {
      vi.mocked(chatService.chat).mockResolvedValue({
        reply: '{invalid json here}',
        model: 'gpt-4o-mini',
      });

      await expect((tutorService as any).analyzeWithAI('Hello', mockAgents))
        .rejects.toThrow('Invalid AI response format');
    });

    it('should provide default values for missing fields', async () => {
      vi.mocked(chatService.chat).mockResolvedValue({
        reply: '{"selectedAgent": "socratic-tutor"}',
        model: 'gpt-4o-mini',
      });

      const result = await (tutorService as any).analyzeWithAI('Hello', mockAgents);

      expect(result.selectedAgent.name).toBe('socratic-tutor');
      expect(result.reason).toBe('AI-based routing');
      expect(result.confidence).toBe(0.8);
    });
  });

  // ===========================================================================
  // analyzeAndRoute - routing orchestration
  // ===========================================================================

  describe('analyzeAndRoute', () => {
    const mockAgents = [
      { id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide', description: 'Uses Socratic questioning' },
      { id: 5, name: 'helper-tutor', displayName: 'Helpful Guide', description: 'Direct help with tasks' },
    ];

    it('should use keyword routing by default (useAI=false)', async () => {
      const result = await (tutorService as any).analyzeAndRoute('How do I do this?', mockAgents, false);

      // Keyword routing should return a valid agent
      expect(result.selectedAgent).toBeDefined();
      expect(result.reason).toBeDefined();
      expect(chatService.chat).not.toHaveBeenCalled();
    });

    it('should fallback to keyword routing when AI fails', async () => {
      vi.mocked(chatService.chat).mockRejectedValue(new Error('API Error'));

      const result = await (tutorService as any).analyzeAndRoute('Hello', mockAgents, true);

      // Should fallback to keyword routing
      expect(result.selectedAgent).toBeDefined();
    });

    it('should use AI routing when useAI=true', async () => {
      vi.mocked(chatService.chat).mockResolvedValue({
        reply: '{"selectedAgent": "socratic-tutor", "reason": "AI choice", "confidence": 0.95}',
        model: 'gpt-4o-mini',
      });

      const result = await (tutorService as any).analyzeAndRoute('Why does this work?', mockAgents, true);

      expect(result.selectedAgent.name).toBe('socratic-tutor');
      expect(result.reason).toBe('AI choice');
      expect(chatService.chat).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // logInteraction - error handling
  // ===========================================================================

  describe('logInteraction - error handling', () => {
    it('should not throw when logging fails', async () => {
      vi.mocked(prisma.tutorInteractionLog.create).mockRejectedValue(new Error('DB Error'));

      // Should not throw
      await expect((tutorService as any).logInteraction({
        userId: 123,
        sessionId: 1,
        eventType: 'message_sent',
      })).resolves.not.toThrow();
    });
  });

  // ===========================================================================
  // handleRandomMode - selected agent not found
  // ===========================================================================

  describe('handleRandomMode - error cases', () => {
    it('should throw 404 when chatbot is not found in database', async () => {
      const mockSession = {
        id: 1,
        userId: 123,
        courseId: 1,
        mode: 'random',
        activeAgentId: null,
        conversationHistory: [],
        course: {
          tutorSettings: JSON.stringify({
            dosRules: [],
            dontsRules: [],
            customPromptAdditions: '',
            enabledChatbotIds: [1],
          }),
        },
      };

      const mockAgents = [
        { id: 1, name: 'agent1', displayName: 'Agent 1', systemPrompt: 'prompt', temperature: 0.7 },
      ];

      const mockConversation = {
        id: 1,
        userId: 123,
        chatbotId: 1,
        createdAt: new Date(),
        messageCount: 0,
        messages: [],
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(null); // Chatbot not found

      await expect(
        tutorService.sendMessage(123, 1, 'Hello', 1)
      ).rejects.toThrow('Agent not found or inactive');
    });

    it('should throw 500 when no agents are available in random mode', async () => {
      const mockSession = {
        id: 1,
        userId: 123,
        courseId: 1,
        mode: 'random',
        activeAgentId: null,
        conversationHistory: [],
        course: {
          tutorSettings: JSON.stringify({
            dosRules: [],
            dontsRules: [],
            customPromptAdditions: '',
            enabledChatbotIds: [],
          }),
        },
      };

      const mockChatbot = {
        id: 1,
        name: 'agent1',
        displayName: 'Agent 1',
        systemPrompt: 'prompt',
        temperature: 0.7,
        isActive: true,
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue({
        id: 1,
        userId: 123,
        chatbotId: 1,
        createdAt: new Date(),
        messageCount: 0,
        messages: [],
      } as any);
      // handleRandomMode calls getAvailableAgents which returns empty
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue([]);

      await expect(
        tutorService.sendMessage(123, 1, 'Hello', 1)
      ).rejects.toThrow('No agents available');
    });
  });

  // ===========================================================================
  // handleRouterMode - error case
  // ===========================================================================

  describe('handleRouterMode - error case', () => {
    it('should throw 500 when routed agent is not found in database', async () => {
      const mockSession = {
        id: 1,
        userId: 123,
        courseId: 1,
        mode: 'router',
        activeAgentId: null,
        conversationHistory: [],
        course: {
          tutorSettings: JSON.stringify({
            dosRules: [],
            dontsRules: [],
            customPromptAdditions: '',
            enabledChatbotIds: [1, 2],
          }),
        },
      };

      const mockChatbot = {
        id: 1,
        name: 'agent1',
        displayName: 'Agent 1',
        systemPrompt: 'prompt',
        temperature: 0.7,
        isActive: true,
      };

      const mockAgents = [
        { id: 1, name: 'agent1', displayName: 'Agent 1', systemPrompt: 'prompt', temperature: 0.7, isActive: true },
        { id: 2, name: 'agent2', displayName: 'Agent 2', systemPrompt: 'prompt2', temperature: 0.7, isActive: true },
      ];

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      // First call for sendMessage validation
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValueOnce(mockChatbot as any);
      // getAvailableAgents returns agents
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue({
        id: 1,
        userId: 123,
        chatbotId: 1,
        createdAt: new Date(),
        messageCount: 0,
        messages: [],
      } as any);
      // handleRouterMode looks up selected agent - returns null
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValueOnce(null);

      await expect(
        tutorService.sendMessage(123, 1, 'Hello', 1)
      ).rejects.toThrow('Selected agent not found');
    });
  });

  // ===========================================================================
  // analyzeAndRoute - scores sorting
  // ===========================================================================

  describe('analyzeAndRoute - with scores', () => {
    const mockAgents = [
      { id: 1, name: 'socratic-tutor', displayName: 'Socratic Tutor', systemPrompt: 'socratic' },
      { id: 2, name: 'direct-helper', displayName: 'Direct Helper', systemPrompt: 'direct' },
      { id: 3, name: 'coding-expert', displayName: 'Coding Expert', systemPrompt: 'coding' },
    ];

    it('should sort alternatives by score and return ranked results', async () => {
      vi.mocked(chatService.chat).mockResolvedValue({
        reply: JSON.stringify({
          selectedAgent: 'socratic-tutor',
          reason: 'Best for questions',
          confidence: 0.9,
          scores: { 'socratic-tutor': 0.9, 'direct-helper': 0.5, 'coding-expert': 0.7 },
        }),
        model: 'gpt-4o-mini',
      });

      const result = await (tutorService as any).analyzeAndRoute('Why?', mockAgents, true);

      expect(result.alternatives).toBeDefined();
      expect(result.alternatives.length).toBe(2); // 2 alternatives (excluding selected)
      // Alternatives should be sorted descending by score
      expect(result.alternatives[0].score).toBeGreaterThanOrEqual(result.alternatives[1].score);
    });
  });

  // ===========================================================================
  // sendCollaborativeMessage - logging failure
  // ===========================================================================

  describe('handleManualMode - logging failure', () => {
    it('should still return response when activity logging fails', async () => {
      const { activityLogService } = await import('./activityLog.service.js');

      const mockSession = { id: 1, userId: 123, mode: 'manual' };
      const mockChatbot = {
        id: 5,
        name: 'helper-tutor',
        displayName: 'Helpful Guide',
        isActive: true,
        systemPrompt: 'You are a helpful tutor.',
        temperature: 0.7,
      };
      const mockConversation = {
        id: 10,
        sessionId: 1,
        chatbotId: 5,
        lastMessageAt: null,
        messageCount: 0,
        createdAt: new Date(),
        messages: [],
      };
      const mockUserMsg = { id: 100, conversationId: 10, role: 'user', content: 'Hello', createdAt: new Date() };
      const mockAssistantMsg = {
        id: 101,
        conversationId: 10,
        role: 'assistant',
        content: 'Hi there!',
        aiModel: 'gpt-4o-mini',
        aiProvider: 'openai',
        responseTimeMs: 500,
        temperature: 0.7,
        createdAt: new Date(),
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create)
        .mockResolvedValueOnce(mockUserMsg as any)
        .mockResolvedValueOnce(mockAssistantMsg as any);
      vi.mocked(prisma.tutorConversation.update).mockResolvedValue({} as any);
      vi.mocked(prisma.tutorInteractionLog.create).mockResolvedValue({} as any);
      vi.mocked(chatService.chat).mockResolvedValue({ reply: 'Hi there!', model: 'gpt-4o-mini' });
      // Make activity logging fail
      vi.mocked(activityLogService.logActivity).mockRejectedValue(new Error('Log failed'));

      const result = await tutorService.sendMessage(123, 5, 'Hello');

      // Should still succeed despite logging failure
      expect(result.userMessage.content).toBe('Hello');
      expect(result.assistantMessage.content).toBe('Hi there!');
    });
  });

  describe('handleRandomMode - selected agent not found after selection', () => {
    it('should throw 500 when chatbot lookup fails after random selection', async () => {
      const mockSession = {
        id: 1,
        userId: 123,
        courseId: 1,
        mode: 'random',
        activeAgentId: null,
        conversationHistory: [],
        course: {
          tutorSettings: JSON.stringify({
            dosRules: [],
            dontsRules: [],
            customPromptAdditions: '',
            enabledChatbotIds: [1],
          }),
        },
      };

      const mockChatbot = {
        id: 1,
        name: 'agent1',
        displayName: 'Agent 1',
        systemPrompt: 'prompt',
        temperature: 0.7,
        isActive: true,
      };

      const mockAgents = [
        { id: 1, name: 'agent1', displayName: 'Agent 1', systemPrompt: 'prompt', temperature: 0.7, isActive: true },
      ];

      const mockConversation = {
        id: 1,
        userId: 123,
        chatbotId: 1,
        createdAt: new Date(),
        messageCount: 0,
        messages: [],
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      // First findUnique for sendMessage validation passes
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValueOnce(mockChatbot as any);
      // getAvailableAgents returns agents
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);
      // getOrCreateConversation
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      // Second findUnique in handleRandomMode - chatbot lookup fails
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValueOnce(null);

      await expect(
        tutorService.sendMessage(123, 1, 'Hello', 1)
      ).rejects.toThrow('Selected agent not found');
    });
  });

  describe('sendCollaborativeMessage - logging failure', () => {
    it('should continue even when logging fails', async () => {
      const mockSession = {
        id: 1,
        userId: 123,
        courseId: 1,
        mode: 'collaborative',
        activeAgentId: null,
        conversationHistory: [],
        course: {
          tutorSettings: JSON.stringify({
            dosRules: [],
            dontsRules: [],
            customPromptAdditions: '',
            collaborativeSettings: {
              mode: 'parallel',
              maxAgents: 2,
            },
            enabledChatbotIds: [1, 2],
          }),
        },
      };

      const mockAgents = [
        { id: 1, name: 'agent1', displayName: 'Agent 1', systemPrompt: 'prompt', temperature: 0.7, isActive: true },
        { id: 2, name: 'agent2', displayName: 'Agent 2', systemPrompt: 'prompt', temperature: 0.7, isActive: true },
      ];

      const mockConversation = {
        id: 1,
        userId: 123,
        chatbotId: 1,
        createdAt: new Date(),
        messageCount: 0,
        messages: [],
      };

      vi.mocked(prisma.tutorSession.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockAgents as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue({ ...mockAgents[0] } as any);
      vi.mocked(prisma.tutorConversation.findUnique).mockResolvedValue(mockConversation as any);
      vi.mocked(prisma.tutorMessage.create).mockResolvedValue({
        id: 1,
        conversationId: 1,
        role: 'user',
        content: 'Hello',
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.tutorMessage.findMany).mockResolvedValue([]);
      vi.mocked(chatService.chat).mockResolvedValue({
        reply: 'Agent response',
        model: 'gpt-4o-mini',
      });
      // Mock logging to fail
      vi.mocked(prisma.tutorInteractionLog.create).mockRejectedValue(new Error('Log failed'));

      const result = await tutorService.sendMessage(123, 1, 'Hello', 1);

      // Should still return a successful response despite logging failure
      expect(result).toBeDefined();
      expect(result.userMessage).toBeDefined();
    });
  });
});
