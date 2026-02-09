import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ZodError } from 'zod';

// Mock services and middleware
vi.mock('../services/forum.service.js', () => ({
  forumService: {
    getAllUserForums: vi.fn(),
    getForums: vi.fn(),
    getModuleForums: vi.fn(),
    getForum: vi.fn(),
    createForum: vi.fn(),
    updateForum: vi.fn(),
    deleteForum: vi.fn(),
    getThreads: vi.fn(),
    getThread: vi.fn(),
    createThread: vi.fn(),
    updateThread: vi.fn(),
    deleteThread: vi.fn(),
    pinThread: vi.fn(),
    lockThread: vi.fn(),
    createPost: vi.fn(),
    updatePost: vi.fn(),
    deletePost: vi.fn(),
    getAvailableAgents: vi.fn(),
    createAiPost: vi.fn(),
  },
}));

vi.mock('../middleware/auth.middleware.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    // Only set default user if not already set by test
    if (!req.user) {
      req.user = { id: 1, email: 'test@test.com', fullname: 'Test User', isAdmin: false, isInstructor: false };
    }
    next();
  },
  requireInstructor: (req: any, res: any, next: any) => {
    if (req.user?.isInstructor || req.user?.isAdmin) {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Instructor access required' });
    }
  },
}));

vi.mock('../middleware/rateLimit.middleware.js', () => ({
  forumAiLimiter: (req: any, res: any, next: any) => next(),
}));

import { forumService } from '../services/forum.service.js';
import forumRoutes from './forum.routes.js';

// Helper to create test app with different user roles
const createTestApp = (user = { id: 1, email: 'test@test.com', fullname: 'Test User', isAdmin: false, isInstructor: false }) => {
  const app = express();
  app.use(express.json());

  // Override user for this app instance
  app.use((req: any, res, next) => {
    req.user = user;
    next();
  });

  app.use('/api/forums', forumRoutes);

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: err.errors.map(e => e.message).join(', '),
      });
    }
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  });

  return app;
};

describe('Forum Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // FORUM ROUTES
  // ===========================================================================

  describe('GET /api/forums', () => {
    it('should return all user forums', async () => {
      const mockForums = [
        { id: 1, title: 'Forum 1', courseId: 1 },
        { id: 2, title: 'Forum 2', courseId: 2 },
      ];
      vi.mocked(forumService.getAllUserForums).mockResolvedValue(mockForums as any);

      const response = await request(app)
        .get('/api/forums')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(forumService.getAllUserForums).toHaveBeenCalledWith(1, false, false);
    });
  });

  describe('GET /api/forums/course/:courseId', () => {
    it('should return forums for a course', async () => {
      const mockForums = [{ id: 1, title: 'Course Forum', courseId: 5 }];
      vi.mocked(forumService.getForums).mockResolvedValue(mockForums as any);

      const response = await request(app)
        .get('/api/forums/course/5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(forumService.getForums).toHaveBeenCalledWith(5, 1, false, false);
    });
  });

  describe('GET /api/forums/module/:moduleId', () => {
    it('should return forums for a module', async () => {
      const mockForums = [{ id: 1, title: 'Module Forum', moduleId: 3 }];
      vi.mocked(forumService.getModuleForums).mockResolvedValue(mockForums as any);

      const response = await request(app)
        .get('/api/forums/module/3')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(forumService.getModuleForums).toHaveBeenCalledWith(3, 1, false, false);
    });
  });

  describe('GET /api/forums/:forumId', () => {
    it('should return single forum with threads', async () => {
      const mockForum = { id: 1, title: 'Forum', threads: [] };
      vi.mocked(forumService.getForum).mockResolvedValue(mockForum as any);

      const response = await request(app)
        .get('/api/forums/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
    });
  });

  describe('POST /api/forums/course/:courseId', () => {
    it('should create forum as instructor', async () => {
      const instructorApp = createTestApp({ id: 1, email: 'inst@test.com', fullname: 'Instructor', isAdmin: false, isInstructor: true });
      const mockForum = { id: 1, title: 'New Forum', courseId: 5 };
      vi.mocked(forumService.createForum).mockResolvedValue(mockForum as any);

      const response = await request(instructorApp)
        .post('/api/forums/course/5')
        .send({ title: 'New Forum' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('New Forum');
    });

    it('should reject non-instructor', async () => {
      const response = await request(app)
        .post('/api/forums/course/5')
        .send({ title: 'New Forum' })
        .expect(403);

      expect(response.body.error).toContain('Instructor');
    });

    it('should validate title', async () => {
      const instructorApp = createTestApp({ id: 1, email: 'inst@test.com', fullname: 'Instructor', isAdmin: false, isInstructor: true });

      const response = await request(instructorApp)
        .post('/api/forums/course/5')
        .send({ title: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/forums/:forumId', () => {
    it('should update forum as instructor', async () => {
      const instructorApp = createTestApp({ id: 1, email: 'inst@test.com', fullname: 'Instructor', isAdmin: false, isInstructor: true });
      vi.mocked(forumService.updateForum).mockResolvedValue({ id: 1, title: 'Updated' } as any);

      const response = await request(instructorApp)
        .put('/api/forums/1')
        .send({ title: 'Updated' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated');
    });
  });

  describe('DELETE /api/forums/:forumId', () => {
    it('should delete forum as instructor', async () => {
      const instructorApp = createTestApp({ id: 1, email: 'inst@test.com', fullname: 'Instructor', isAdmin: false, isInstructor: true });
      vi.mocked(forumService.deleteForum).mockResolvedValue({ message: 'Forum deleted' });

      const response = await request(instructorApp)
        .delete('/api/forums/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Forum deleted');
    });
  });

  // ===========================================================================
  // THREAD ROUTES
  // ===========================================================================

  describe('GET /api/forums/:forumId/threads', () => {
    it('should return paginated threads', async () => {
      const mockResult = {
        threads: [{ id: 1, title: 'Thread 1' }],
        pagination: { page: 1, limit: 20, total: 1 },
      };
      vi.mocked(forumService.getThreads).mockResolvedValue(mockResult as any);

      const response = await request(app)
        .get('/api/forums/1/threads')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.threads).toHaveLength(1);
      expect(forumService.getThreads).toHaveBeenCalledWith(1, 1, 1, 20, false, false);
    });

    it('should respect pagination params', async () => {
      vi.mocked(forumService.getThreads).mockResolvedValue({ threads: [], pagination: {} } as any);

      await request(app)
        .get('/api/forums/1/threads?page=2&limit=10')
        .expect(200);

      expect(forumService.getThreads).toHaveBeenCalledWith(1, 1, 2, 10, false, false);
    });
  });

  describe('GET /api/forums/threads/:threadId', () => {
    it('should return thread with posts', async () => {
      const mockThread = { id: 1, title: 'Thread', posts: [] };
      vi.mocked(forumService.getThread).mockResolvedValue(mockThread as any);

      const response = await request(app)
        .get('/api/forums/threads/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
    });
  });

  describe('POST /api/forums/:forumId/threads', () => {
    it('should create thread', async () => {
      const mockThread = { id: 1, title: 'New Thread', content: 'Content' };
      vi.mocked(forumService.createThread).mockResolvedValue(mockThread as any);

      const response = await request(app)
        .post('/api/forums/1/threads')
        .send({ title: 'New Thread', content: 'Content' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('New Thread');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/forums/1/threads')
        .send({ title: 'Title only' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/forums/threads/:threadId', () => {
    it('should update thread', async () => {
      vi.mocked(forumService.updateThread).mockResolvedValue({ id: 1, title: 'Updated' } as any);

      const response = await request(app)
        .put('/api/forums/threads/1')
        .send({ title: 'Updated' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/forums/threads/:threadId', () => {
    it('should delete thread', async () => {
      vi.mocked(forumService.deleteThread).mockResolvedValue({ message: 'Thread deleted' });

      const response = await request(app)
        .delete('/api/forums/threads/1')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/forums/threads/:threadId/pin', () => {
    it('should pin thread as instructor', async () => {
      const instructorApp = createTestApp({ id: 1, email: 'inst@test.com', fullname: 'Instructor', isAdmin: false, isInstructor: true });
      vi.mocked(forumService.pinThread).mockResolvedValue({ id: 1, isPinned: true } as any);

      const response = await request(instructorApp)
        .put('/api/forums/threads/1/pin')
        .send({ isPinned: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isPinned).toBe(true);
    });

    it('should reject non-instructor', async () => {
      const response = await request(app)
        .put('/api/forums/threads/1/pin')
        .send({ isPinned: true })
        .expect(403);

      expect(response.body.error).toContain('Instructor');
    });
  });

  describe('PUT /api/forums/threads/:threadId/lock', () => {
    it('should lock thread as instructor', async () => {
      const instructorApp = createTestApp({ id: 1, email: 'inst@test.com', fullname: 'Instructor', isAdmin: false, isInstructor: true });
      vi.mocked(forumService.lockThread).mockResolvedValue({ id: 1, isLocked: true } as any);

      const response = await request(instructorApp)
        .put('/api/forums/threads/1/lock')
        .send({ isLocked: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isLocked).toBe(true);
    });
  });

  // ===========================================================================
  // POST ROUTES
  // ===========================================================================

  describe('POST /api/forums/threads/:threadId/posts', () => {
    it('should create post', async () => {
      const mockPost = { id: 1, content: 'Reply content', threadId: 1 };
      vi.mocked(forumService.createPost).mockResolvedValue(mockPost as any);

      const response = await request(app)
        .post('/api/forums/threads/1/posts')
        .send({ content: 'Reply content' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('Reply content');
    });

    it('should create nested reply', async () => {
      const mockPost = { id: 2, content: 'Nested reply', parentId: 1 };
      vi.mocked(forumService.createPost).mockResolvedValue(mockPost as any);

      const response = await request(app)
        .post('/api/forums/threads/1/posts')
        .send({ content: 'Nested reply', parentId: 1 })
        .expect(201);

      expect(response.body.data.parentId).toBe(1);
    });

    it('should validate content', async () => {
      const response = await request(app)
        .post('/api/forums/threads/1/posts')
        .send({ content: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/forums/posts/:postId', () => {
    it('should update post', async () => {
      vi.mocked(forumService.updatePost).mockResolvedValue({ id: 1, content: 'Updated' } as any);

      const response = await request(app)
        .put('/api/forums/posts/1')
        .send({ content: 'Updated' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/forums/posts/:postId', () => {
    it('should delete post', async () => {
      vi.mocked(forumService.deletePost).mockResolvedValue({ message: 'Post deleted' });

      const response = await request(app)
        .delete('/api/forums/posts/1')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ===========================================================================
  // AI AGENT ROUTES
  // ===========================================================================

  describe('GET /api/forums/course/:courseId/agents', () => {
    it('should return available agents', async () => {
      const mockAgents = [
        { id: 1, name: 'socratic-tutor', displayName: 'Socratic Guide' },
        { id: 2, name: 'helper-tutor', displayName: 'Helpful Guide' },
      ];
      vi.mocked(forumService.getAvailableAgents).mockResolvedValue(mockAgents as any);

      const response = await request(app)
        .get('/api/forums/course/1/agents')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/forums/threads/:threadId/ai-post', () => {
    it('should create AI post', async () => {
      const mockPost = { id: 1, content: 'AI generated response', isAiGenerated: true };
      vi.mocked(forumService.createAiPost).mockResolvedValue(mockPost as any);

      const response = await request(app)
        .post('/api/forums/threads/1/ai-post')
        .send({ agentId: 1 })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isAiGenerated).toBe(true);
    });

    it('should validate agentId', async () => {
      const response = await request(app)
        .post('/api/forums/threads/1/ai-post')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
