import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TutorService } from './tutor.service.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    tutorSession: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
    },
    tutorInteractionLog: {
      create: vi.fn(),
      findMany: vi.fn(),
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
});
