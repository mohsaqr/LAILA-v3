import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    course: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    enrollment: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    assignment: {
      count: vi.fn(),
    },
    chatLog: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    userInteraction: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    dataAnalysisLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    forum: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    forumThread: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    forumPost: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock('../services/chatbotRegistry.service.js', () => ({
  chatbotRegistryService: {
    getChatbots: vi.fn(),
    getFilterOptions: vi.fn(),
    getStats: vi.fn(),
    generateCSV: vi.fn(),
    exportChatbots: vi.fn(),
  },
}));

vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 1, email: 'admin@test.com', fullname: 'Admin User', isAdmin: true, isInstructor: true };
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.user?.isAdmin) {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Admin access required' });
    }
  },
}));

import prisma from '../utils/prisma.js';
import { chatbotRegistryService } from '../services/chatbotRegistry.service.js';
import adminRoutes from './admin.routes.js';

describe('Admin Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);

    // Error handler
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // GET /api/admin/stats
  // ===========================================================================

  describe('GET /api/admin/stats', () => {
    it('should return dashboard statistics', async () => {
      vi.mocked(prisma.user.count)
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(85); // activeUsers
      vi.mocked(prisma.course.count)
        .mockResolvedValueOnce(20) // totalCourses
        .mockResolvedValueOnce(15); // publishedCourses
      vi.mocked(prisma.enrollment.count).mockResolvedValue(500);
      vi.mocked(prisma.assignment.count).mockResolvedValue(50);
      vi.mocked(prisma.chatLog.count).mockResolvedValue(1000);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 1, fullname: 'User 1', email: 'user1@test.com', createdAt: new Date() },
      ] as any);
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
        { user: { fullname: 'User 1' }, course: { title: 'Course 1' } },
      ] as any);

      const response = await request(app)
        .get('/api/admin/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stats.totalUsers).toBe(100);
      expect(response.body.data.stats.activeUsers).toBe(85);
      expect(response.body.data.stats.totalCourses).toBe(20);
      expect(response.body.data.recentUsers).toHaveLength(1);
    });
  });

  // ===========================================================================
  // GET /api/admin/courses
  // ===========================================================================

  describe('GET /api/admin/courses', () => {
    it('should return paginated courses', async () => {
      const mockCourses = [
        {
          id: 1,
          title: 'Course 1',
          instructor: { id: 1, fullname: 'Instructor', email: 'inst@test.com' },
          _count: { enrollments: 10, modules: 5 },
        },
      ];
      vi.mocked(prisma.course.findMany).mockResolvedValue(mockCourses as any);
      vi.mocked(prisma.course.count).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/admin/courses')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });

    it('should filter by status', async () => {
      vi.mocked(prisma.course.findMany).mockResolvedValue([]);
      vi.mocked(prisma.course.count).mockResolvedValue(0);

      await request(app)
        .get('/api/admin/courses?status=published')
        .expect(200);

      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'published' },
        })
      );
    });
  });

  // ===========================================================================
  // GET /api/admin/enrollments
  // ===========================================================================

  describe('GET /api/admin/enrollments', () => {
    it('should return paginated enrollments', async () => {
      const mockEnrollments = [
        {
          id: 1,
          user: { id: 1, fullname: 'User', email: 'user@test.com' },
          course: { id: 1, title: 'Course' },
        },
      ];
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue(mockEnrollments as any);
      vi.mocked(prisma.enrollment.count).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/admin/enrollments')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should filter by courseId', async () => {
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([]);
      vi.mocked(prisma.enrollment.count).mockResolvedValue(0);

      await request(app)
        .get('/api/admin/enrollments?courseId=5')
        .expect(200);

      expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { courseId: 5 },
        })
      );
    });
  });

  // ===========================================================================
  // GET /api/admin/chat-logs
  // ===========================================================================

  describe('GET /api/admin/chat-logs', () => {
    it('should return paginated chat logs', async () => {
      const mockLogs = [
        {
          id: 1,
          module: 'tutor',
          user: { id: 1, fullname: 'User' },
          timestamp: new Date(),
        },
      ];
      vi.mocked(prisma.chatLog.findMany).mockResolvedValue(mockLogs as any);
      vi.mocked(prisma.chatLog.count).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/admin/chat-logs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should filter by module and userId', async () => {
      vi.mocked(prisma.chatLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.chatLog.count).mockResolvedValue(0);

      await request(app)
        .get('/api/admin/chat-logs?module=tutor&userId=5')
        .expect(200);

      expect(prisma.chatLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { module: 'tutor', userId: 5 },
        })
      );
    });
  });

  // ===========================================================================
  // GET /api/admin/interactions
  // ===========================================================================

  describe('GET /api/admin/interactions', () => {
    it('should return paginated user interactions', async () => {
      const mockInteractions = [
        { id: 1, userId: 1, user: { id: 1, fullname: 'User' }, timestamp: new Date() },
      ];
      vi.mocked(prisma.userInteraction.findMany).mockResolvedValue(mockInteractions as any);
      vi.mocked(prisma.userInteraction.count).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/admin/interactions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  // ===========================================================================
  // GET /api/admin/analysis-logs
  // ===========================================================================

  describe('GET /api/admin/analysis-logs', () => {
    it('should return paginated analysis logs', async () => {
      const mockLogs = [
        { id: 1, userId: 1, user: { id: 1, fullname: 'User' }, timestamp: new Date() },
      ];
      vi.mocked(prisma.dataAnalysisLog.findMany).mockResolvedValue(mockLogs as any);
      vi.mocked(prisma.dataAnalysisLog.count).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/admin/analysis-logs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  // ===========================================================================
  // GET /api/admin/chatbot-registry
  // ===========================================================================

  describe('GET /api/admin/chatbot-registry', () => {
    it('should return chatbots with pagination', async () => {
      vi.mocked(chatbotRegistryService.getChatbots).mockResolvedValue({
        chatbots: [{ id: 1, name: 'bot-1' }],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      } as any);

      const response = await request(app)
        .get('/api/admin/chatbot-registry')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should pass filters to service', async () => {
      vi.mocked(chatbotRegistryService.getChatbots).mockResolvedValue({
        chatbots: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      } as any);

      await request(app)
        .get('/api/admin/chatbot-registry?type=global&category=academic')
        .expect(200);

      expect(chatbotRegistryService.getChatbots).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'global',
          category: 'academic',
        })
      );
    });
  });

  // ===========================================================================
  // GET /api/admin/chatbot-registry/filter-options
  // ===========================================================================

  describe('GET /api/admin/chatbot-registry/filter-options', () => {
    it('should return filter options', async () => {
      vi.mocked(chatbotRegistryService.getFilterOptions).mockResolvedValue({
        categories: ['academic', 'support'],
        courses: [{ id: 1, title: 'Course 1' }],
      } as any);

      const response = await request(app)
        .get('/api/admin/chatbot-registry/filter-options')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toContain('academic');
    });
  });

  // ===========================================================================
  // GET /api/admin/chatbot-registry/stats
  // ===========================================================================

  describe('GET /api/admin/chatbot-registry/stats', () => {
    it('should return chatbot stats', async () => {
      vi.mocked(chatbotRegistryService.getStats).mockResolvedValue({
        totalChatbots: 10,
        activeChatbots: 8,
        globalChatbots: 3,
        sectionChatbots: 7,
      } as any);

      const response = await request(app)
        .get('/api/admin/chatbot-registry/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalChatbots).toBe(10);
    });
  });

  // ===========================================================================
  // GET /api/admin/export/:type
  // ===========================================================================

  describe('GET /api/admin/export/:type', () => {
    it('should export users', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 1, fullname: 'User', email: 'user@test.com', isAdmin: false },
      ] as any);

      const response = await request(app)
        .get('/api/admin/export/users')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should export courses', async () => {
      vi.mocked(prisma.course.findMany).mockResolvedValue([
        { id: 1, title: 'Course', instructor: { fullname: 'Inst' }, _count: { enrollments: 5 } },
      ] as any);

      const response = await request(app)
        .get('/api/admin/export/courses')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should export enrollments', async () => {
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
        { id: 1, user: { fullname: 'User', email: 'user@test.com' }, course: { title: 'Course' } },
      ] as any);

      const response = await request(app)
        .get('/api/admin/export/enrollments')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should export chat-logs', async () => {
      vi.mocked(prisma.chatLog.findMany).mockResolvedValue([
        { id: 1, module: 'tutor', user: { fullname: 'User' } },
      ] as any);

      const response = await request(app)
        .get('/api/admin/export/chat-logs')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid export type', async () => {
      const response = await request(app)
        .get('/api/admin/export/invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid export type');
    });
  });

  // ===========================================================================
  // GET /api/admin/forum-summary
  // ===========================================================================

  describe('GET /api/admin/forum-summary', () => {
    it('should return forum summary', async () => {
      vi.mocked(prisma.forumThread.count).mockResolvedValue(50);
      vi.mocked(prisma.forumPost.count)
        .mockResolvedValueOnce(200) // totalPosts
        .mockResolvedValueOnce(30); // anonymousPosts
      vi.mocked(prisma.forum.count).mockResolvedValue(10);
      vi.mocked(prisma.forum.findMany).mockResolvedValue([
        { id: 1, title: 'Forum 1', courseId: 1, course: { title: 'Course 1' }, _count: { threads: 5 } },
      ] as any);
      vi.mocked(prisma.forumPost.groupBy).mockResolvedValue([
        { authorId: 1, _count: { id: 10 } },
      ] as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 1, fullname: 'User', email: 'user@test.com' },
      ] as any);
      vi.mocked(prisma.forumThread.findMany).mockResolvedValue([
        {
          id: 1,
          title: 'Thread 1',
          createdAt: new Date(),
          authorId: 1,
          forum: { id: 1, title: 'Forum 1', courseId: 1, course: { title: 'Course 1' } },
          _count: { posts: 5 },
        },
      ] as any);
      vi.mocked(prisma.forumPost.findMany).mockResolvedValue([
        {
          id: 1,
          content: 'Post content',
          createdAt: new Date(),
          authorId: 1,
          isAnonymous: false,
          parentId: null,
          thread: {
            id: 1,
            title: 'Thread 1',
            forum: { id: 1, title: 'Forum 1', courseId: 1, course: { title: 'Course 1' } },
          },
          parent: null,
        },
      ] as any);

      const response = await request(app)
        .get('/api/admin/forum-summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalThreads).toBe(50);
      expect(response.body.data.totalPosts).toBe(200);
    });
  });
});
