import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { forumService } from './forum.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    forum: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    forumThread: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    forumPost: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    course: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    courseModule: {
      findUnique: vi.fn(),
    },
    enrollment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    chatbot: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    courseTutor: {
      findMany: vi.fn(),
    },
  },
}));

// Mock chat service
vi.mock('./chat.service.js', () => ({
  chatService: {
    chat: vi.fn().mockResolvedValue({
      reply: 'AI generated response',
      model: 'gpt-4o-mini',
      responseTime: 0.5,
    }),
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
import { chatService } from './chat.service.js';

// Note: We need to import the class separately for testing since forumService is an instance
const ForumServiceClass = (await import('./forum.service.js')).default;

describe('ForumService', () => {
  const mockCourse = {
    id: 1,
    title: 'Test Course',
    instructorId: 10,
  };

  const mockForum = {
    id: 1,
    title: 'General Discussion',
    description: 'Discuss anything related to the course',
    courseId: 1,
    moduleId: null,
    isPublished: true,
    allowAnonymous: false,
    orderIndex: 0,
    course: mockCourse,
    _count: { threads: 5 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockThread = {
    id: 1,
    forumId: 1,
    authorId: 20,
    title: 'Question about assignment',
    content: 'I have a question about the first assignment...',
    isAnonymous: false,
    isPinned: false,
    isLocked: false,
    viewCount: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    forum: {
      ...mockForum,
      course: mockCourse,
    },
    posts: [],
    _count: { posts: 3 },
  };

  const mockPost = {
    id: 1,
    threadId: 1,
    authorId: 10,
    content: 'Here is the answer to your question...',
    parentId: null,
    isAnonymous: false,
    isEdited: false,
    isAiGenerated: false,
    aiAgentId: null,
    aiAgentName: null,
    aiRequestedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    thread: mockThread,
    _count: { replies: 0 },
  };

  const mockUser = {
    id: 20,
    fullname: 'Test Student',
    email: 'student@test.com',
    isAdmin: false,
    isInstructor: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // FORUM CRUD
  // ===========================================================================

  describe('getAllUserForums', () => {
    it('should return forums for admin (all courses)', async () => {
      vi.mocked(prisma.course.findMany).mockResolvedValue([mockCourse] as any);
      vi.mocked(prisma.forum.findMany).mockResolvedValue([{
        ...mockForum,
        threads: [{ createdAt: new Date() }],
      }] as any);

      const forums = await forumService.getAllUserForums(1, false, true);

      expect(forums).toHaveLength(1);
      expect(forums[0].courseName).toBe('Test Course');
    });

    it('should return forums for instructor (own courses)', async () => {
      vi.mocked(prisma.course.findMany).mockResolvedValue([mockCourse] as any);
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([]);
      vi.mocked(prisma.forum.findMany).mockResolvedValue([{
        ...mockForum,
        threads: [],
      }] as any);

      const forums = await forumService.getAllUserForums(10, true, false);

      expect(forums).toHaveLength(1);
    });

    it('should return forums for enrolled student', async () => {
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([{ courseId: 1 }] as any);
      vi.mocked(prisma.forum.findMany).mockResolvedValue([{
        ...mockForum,
        threads: [],
      }] as any);

      const forums = await forumService.getAllUserForums(20, false, false);

      expect(forums).toHaveLength(1);
    });

    it('should return empty array when no enrollments', async () => {
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([]);

      const forums = await forumService.getAllUserForums(99, false, false);

      expect(forums).toHaveLength(0);
    });
  });

  describe('getForums', () => {
    it('should return forums for enrolled student', async () => {
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.forum.findMany).mockResolvedValue([mockForum] as any);

      const forums = await forumService.getForums(1, 20, false, false);

      expect(forums).toHaveLength(1);
      expect(prisma.forum.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { courseId: 1, isPublished: true },
        })
      );
    });

    it('should return all forums for instructor', async () => {
      vi.mocked(prisma.forum.findMany).mockResolvedValue([mockForum] as any);

      const forums = await forumService.getForums(1, 10, true, false);

      expect(forums).toHaveLength(1);
      expect(prisma.forum.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { courseId: 1 },
        })
      );
    });

    it('should throw 403 when not enrolled', async () => {
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(forumService.getForums(1, 99, false, false)).rejects.toThrow(AppError);
      await expect(forumService.getForums(1, 99, false, false)).rejects.toThrow('Not enrolled');
    });
  });

  describe('getForum', () => {
    it('should return forum with threads', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue({
        ...mockForum,
        threads: [mockThread],
      } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser] as any);

      const forum = await forumService.getForum(1, 20, false, false);

      expect(forum.id).toBe(1);
      expect(forum.threads).toHaveLength(1);
    });

    it('should throw 404 when forum not found', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(null);

      await expect(forumService.getForum(999, 20, false, false)).rejects.toThrow(AppError);
      await expect(forumService.getForum(999, 20, false, false)).rejects.toThrow('Forum not found');
    });

    it('should throw 404 for unpublished forum (non-owner)', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue({
        ...mockForum,
        isPublished: false,
        course: { ...mockCourse, instructorId: 10 },
        threads: [],
      } as any);

      await expect(forumService.getForum(1, 99, false, false)).rejects.toThrow(AppError);
      await expect(forumService.getForum(1, 99, false, false)).rejects.toThrow('Forum not found');
    });
  });

  describe('createForum', () => {
    it('should create forum as course owner', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.forum.create).mockResolvedValue(mockForum as any);

      const forum = await forumService.createForum(1, 10, {
        title: 'New Forum',
        description: 'Description',
      });

      expect(forum.title).toBe('General Discussion');
      expect(prisma.forum.create).toHaveBeenCalled();
    });

    it('should create forum as admin', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.forum.create).mockResolvedValue(mockForum as any);

      await forumService.createForum(1, 99, { title: 'Admin Forum' }, true);

      expect(prisma.forum.create).toHaveBeenCalled();
    });

    it('should throw 404 when course not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(
        forumService.createForum(999, 10, { title: 'Test' })
      ).rejects.toThrow(AppError);
      await expect(
        forumService.createForum(999, 10, { title: 'Test' })
      ).rejects.toThrow('Course not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);

      await expect(
        forumService.createForum(1, 99, { title: 'Test' }, false)
      ).rejects.toThrow(AppError);
      await expect(
        forumService.createForum(1, 99, { title: 'Test' }, false)
      ).rejects.toThrow('Not authorized');
    });

    it('should validate moduleId belongs to course', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue({ id: 5, courseId: 999 } as any);

      await expect(
        forumService.createForum(1, 10, { title: 'Test', moduleId: 5 })
      ).rejects.toThrow(AppError);
      await expect(
        forumService.createForum(1, 10, { title: 'Test', moduleId: 5 })
      ).rejects.toThrow('Module does not belong');
    });
  });

  describe('deleteForum', () => {
    it('should delete forum as course owner', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(mockForum as any);
      vi.mocked(prisma.forum.delete).mockResolvedValue(mockForum as any);

      const result = await forumService.deleteForum(1, 10);

      expect(result.message).toBe('Forum deleted');
    });

    it('should throw 404 when forum not found', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(null);

      await expect(forumService.deleteForum(999, 10)).rejects.toThrow(AppError);
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(mockForum as any);

      await expect(forumService.deleteForum(1, 99, false)).rejects.toThrow(AppError);
    });
  });

  // ===========================================================================
  // THREAD CRUD
  // ===========================================================================

  describe('createThread', () => {
    it('should create thread as enrolled student', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(mockForum as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.forumThread.create).mockResolvedValue(mockThread as any);

      const thread = await forumService.createThread(1, 20, {
        title: 'New Question',
        content: 'Question content',
      });

      expect(thread.title).toBe('Question about assignment');
    });

    it('should throw 404 when forum not found', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(null);

      await expect(
        forumService.createThread(999, 20, { title: 'Test', content: 'Test' })
      ).rejects.toThrow(AppError);
      await expect(
        forumService.createThread(999, 20, { title: 'Test', content: 'Test' })
      ).rejects.toThrow('Forum not found');
    });

    it('should throw 400 when forum is not published', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue({
        ...mockForum,
        isPublished: false,
      } as any);

      await expect(
        forumService.createThread(1, 20, { title: 'Test', content: 'Test' })
      ).rejects.toThrow(AppError);
      await expect(
        forumService.createThread(1, 20, { title: 'Test', content: 'Test' })
      ).rejects.toThrow('not available');
    });

    it('should throw 403 when not enrolled', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(mockForum as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(
        forumService.createThread(1, 99, { title: 'Test', content: 'Test' })
      ).rejects.toThrow(AppError);
      await expect(
        forumService.createThread(1, 99, { title: 'Test', content: 'Test' })
      ).rejects.toThrow('Not enrolled');
    });

    it('should throw 400 when anonymous posting not allowed', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue({
        ...mockForum,
        allowAnonymous: false,
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);

      await expect(
        forumService.createThread(1, 20, { title: 'Test', content: 'Test', isAnonymous: true })
      ).rejects.toThrow(AppError);
      await expect(
        forumService.createThread(1, 20, { title: 'Test', content: 'Test', isAnonymous: true })
      ).rejects.toThrow('Anonymous posting is not allowed');
    });
  });

  describe('getThread', () => {
    it('should return thread with posts', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue({
        ...mockThread,
        posts: [mockPost],
      } as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.forumThread.update).mockResolvedValue(mockThread as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser] as any);

      const thread = await forumService.getThread(1, 20, false, false);

      expect(thread.id).toBe(1);
      expect(thread.posts).toHaveLength(1);
    });

    it('should throw 404 when thread not found', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(null);

      await expect(forumService.getThread(999, 20, false, false)).rejects.toThrow(AppError);
      await expect(forumService.getThread(999, 20, false, false)).rejects.toThrow('Thread not found');
    });

    it('should increment view count', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue({
        ...mockThread,
        posts: [],
      } as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.forumThread.update).mockResolvedValue(mockThread as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser] as any);

      await forumService.getThread(1, 20, false, false);

      expect(prisma.forumThread.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { viewCount: { increment: 1 } },
      });
    });
  });

  describe('pinThread', () => {
    it('should pin thread as instructor', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(mockThread as any);
      vi.mocked(prisma.forumThread.update).mockResolvedValue({ ...mockThread, isPinned: true } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ fullname: 'Instructor' } as any);

      const thread = await forumService.pinThread(1, 10, true);

      expect(thread.isPinned).toBe(true);
    });

    it('should throw 403 when not instructor', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(mockThread as any);

      await expect(forumService.pinThread(1, 99, true, false)).rejects.toThrow(AppError);
      await expect(forumService.pinThread(1, 99, true, false)).rejects.toThrow('Not authorized');
    });
  });

  describe('lockThread', () => {
    it('should lock thread as instructor', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(mockThread as any);
      vi.mocked(prisma.forumThread.update).mockResolvedValue({ ...mockThread, isLocked: true } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ fullname: 'Instructor' } as any);

      const thread = await forumService.lockThread(1, 10, true);

      expect(thread.isLocked).toBe(true);
    });

    it('should throw 403 when not instructor', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(mockThread as any);

      await expect(forumService.lockThread(1, 99, true, false)).rejects.toThrow(AppError);
    });
  });

  // ===========================================================================
  // POST CRUD
  // ===========================================================================

  describe('createPost', () => {
    it('should create post as enrolled student', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(mockThread as any);
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any) // For user check
        .mockResolvedValueOnce({ fullname: 'Thread Author' } as any); // For thread author
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.forumPost.create).mockResolvedValue(mockPost as any);

      const post = await forumService.createPost(1, 20, {
        content: 'Reply content',
      });

      expect(post.content).toBe('Here is the answer to your question...');
    });

    it('should throw 404 when thread not found', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(null);

      await expect(
        forumService.createPost(999, 20, { content: 'Test' })
      ).rejects.toThrow(AppError);
      await expect(
        forumService.createPost(999, 20, { content: 'Test' })
      ).rejects.toThrow('Thread not found');
    });

    it('should throw 400 when thread is locked', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue({
        ...mockThread,
        isLocked: true,
      } as any);

      await expect(
        forumService.createPost(1, 20, { content: 'Test' })
      ).rejects.toThrow(AppError);
      await expect(
        forumService.createPost(1, 20, { content: 'Test' })
      ).rejects.toThrow('Thread is locked');
    });

    it('should throw 400 when replying to invalid parent post', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(mockThread as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.forumPost.findUnique).mockResolvedValue({ id: 5, threadId: 999 } as any);

      await expect(
        forumService.createPost(1, 20, { content: 'Test', parentId: 5 })
      ).rejects.toThrow(AppError);
      await expect(
        forumService.createPost(1, 20, { content: 'Test', parentId: 5 })
      ).rejects.toThrow('Invalid parent post');
    });
  });

  describe('updatePost', () => {
    it('should update own post', async () => {
      vi.mocked(prisma.forumPost.findUnique).mockResolvedValue({
        ...mockPost,
        authorId: 20,
      } as any);
      vi.mocked(prisma.forumPost.update).mockResolvedValue({
        ...mockPost,
        content: 'Updated content',
        isEdited: true,
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const post = await forumService.updatePost(1, 20, 'Updated content');

      expect(post.content).toBe('Updated content');
      expect(post.isEdited).toBe(true);
    });

    it('should throw 404 when post not found', async () => {
      vi.mocked(prisma.forumPost.findUnique).mockResolvedValue(null);

      await expect(
        forumService.updatePost(999, 20, 'Test')
      ).rejects.toThrow(AppError);
      await expect(
        forumService.updatePost(999, 20, 'Test')
      ).rejects.toThrow('Post not found');
    });

    it('should throw 400 when thread is locked', async () => {
      vi.mocked(prisma.forumPost.findUnique).mockResolvedValue({
        ...mockPost,
        authorId: 20,
        thread: {
          ...mockThread,
          isLocked: true,
        },
      } as any);

      await expect(
        forumService.updatePost(1, 20, 'Test')
      ).rejects.toThrow(AppError);
      await expect(
        forumService.updatePost(1, 20, 'Test')
      ).rejects.toThrow('Thread is locked');
    });

    it('should throw 403 when not author', async () => {
      vi.mocked(prisma.forumPost.findUnique).mockResolvedValue({
        ...mockPost,
        authorId: 20,
      } as any);

      await expect(
        forumService.updatePost(1, 99, 'Test', false)
      ).rejects.toThrow(AppError);
      await expect(
        forumService.updatePost(1, 99, 'Test', false)
      ).rejects.toThrow('Not authorized');
    });
  });

  describe('deletePost', () => {
    it('should delete own post', async () => {
      vi.mocked(prisma.forumPost.findUnique).mockResolvedValue({
        ...mockPost,
        authorId: 20,
      } as any);
      vi.mocked(prisma.forumPost.delete).mockResolvedValue(mockPost as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await forumService.deletePost(1, 20);

      expect(result.message).toBe('Post deleted');
    });

    it('should allow instructor to delete any post', async () => {
      vi.mocked(prisma.forumPost.findUnique).mockResolvedValue(mockPost as any);
      vi.mocked(prisma.forumPost.delete).mockResolvedValue(mockPost as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ fullname: 'Instructor' } as any);

      const result = await forumService.deletePost(1, 10);

      expect(result.message).toBe('Post deleted');
    });

    it('should throw 404 when post not found', async () => {
      vi.mocked(prisma.forumPost.findUnique).mockResolvedValue(null);

      await expect(forumService.deletePost(999, 20)).rejects.toThrow(AppError);
      await expect(forumService.deletePost(999, 20)).rejects.toThrow('Post not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.forumPost.findUnique).mockResolvedValue(mockPost as any);

      await expect(forumService.deletePost(1, 99, false)).rejects.toThrow(AppError);
      await expect(forumService.deletePost(1, 99, false)).rejects.toThrow('Not authorized');
    });
  });

  // ===========================================================================
  // AI AGENT INTEGRATION
  // ===========================================================================

  describe('getAvailableAgents', () => {
    const mockChatbot = {
      id: 1,
      name: 'math-tutor',
      displayName: 'Math Tutor',
      description: 'Helps with math problems',
      avatarUrl: '/avatar.png',
      personality: 'friendly',
      isActive: true,
      category: 'tutor',
    };

    it('should return available AI agents', async () => {
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue([mockChatbot] as any);
      vi.mocked(prisma.courseTutor.findMany).mockResolvedValue([]);

      const agents = await forumService.getAvailableAgents(1);

      expect(agents).toHaveLength(1);
      expect(agents[0].displayName).toBe('Math Tutor');
    });

    it('should include course-specific tutors with custom names', async () => {
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue([mockChatbot] as any);
      vi.mocked(prisma.courseTutor.findMany).mockResolvedValue([{
        chatbot: mockChatbot,
        customName: 'Custom Math Helper',
        customDescription: 'Custom description',
        customPersonality: null,
      }] as any);

      const agents = await forumService.getAvailableAgents(1);

      expect(agents).toHaveLength(1);
      expect(agents[0].displayName).toBe('Custom Math Helper');
      expect(agents[0].description).toBe('Custom description');
    });
  });

  describe('createAiPost', () => {
    const mockChatbot = {
      id: 1,
      name: 'math-tutor',
      displayName: 'Math Tutor',
      systemPrompt: 'You are a helpful math tutor',
      knowledgeContext: null,
      isActive: true,
      temperature: 0.7,
    };

    beforeEach(() => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue({
        ...mockThread,
        posts: [],
      } as any);
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce({ fullname: 'Thread Author' } as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(mockChatbot as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    });

    it('should create AI-generated post', async () => {
      vi.mocked(prisma.forumPost.create).mockResolvedValue({
        ...mockPost,
        isAiGenerated: true,
        aiAgentId: 1,
        aiAgentName: 'Math Tutor',
        content: 'AI generated response',
      } as any);

      const post = await forumService.createAiPost(1, 20, 1);

      expect(post.isAiGenerated).toBe(true);
      expect(post.aiAgentName).toBe('Math Tutor');
      expect(chatService.chat).toHaveBeenCalled();
    });

    it('should throw 404 when thread not found', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(null);

      await expect(forumService.createAiPost(999, 20, 1)).rejects.toThrow(AppError);
      await expect(forumService.createAiPost(999, 20, 1)).rejects.toThrow('Thread not found');
    });

    it('should throw 400 when thread is locked', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue({
        ...mockThread,
        isLocked: true,
        posts: [],
      } as any);

      await expect(forumService.createAiPost(1, 20, 1)).rejects.toThrow(AppError);
      await expect(forumService.createAiPost(1, 20, 1)).rejects.toThrow('Thread is locked');
    });

    it('should throw 404 when agent not available', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue(null);

      await expect(forumService.createAiPost(1, 20, 999)).rejects.toThrow(AppError);
      await expect(forumService.createAiPost(1, 20, 999)).rejects.toThrow('AI agent not available');
    });

    it('should throw 404 when agent is not active', async () => {
      vi.mocked(prisma.chatbot.findUnique).mockResolvedValue({
        ...mockChatbot,
        isActive: false,
      } as any);

      await expect(forumService.createAiPost(1, 20, 1)).rejects.toThrow(AppError);
      await expect(forumService.createAiPost(1, 20, 1)).rejects.toThrow('AI agent not available');
    });

    it('should create AI post replying to specific parent post', async () => {
      vi.mocked(prisma.forumPost.findUnique).mockResolvedValue({
        id: 5,
        threadId: 1,
        content: 'Parent content',
        authorId: 20,
        isAnonymous: false,
      } as any);
      vi.mocked(prisma.forumPost.create).mockResolvedValue({
        ...mockPost,
        isAiGenerated: true,
        parentId: 5,
      } as any);

      const post = await forumService.createAiPost(1, 20, 1, 5);

      expect(prisma.forumPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentId: 5,
            isAiGenerated: true,
          }),
        })
      );
    });
  });

  // ===========================================================================
  // MODULE FORUMS
  // ===========================================================================

  describe('getModuleForums', () => {
    const mockModuleData = {
      id: 1,
      title: 'Module 1',
      courseId: 1,
      course: { id: 1, instructorId: 10 },
    };

    it('should return forums for a module', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModuleData as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.forum.findMany).mockResolvedValue([mockForum] as any);

      const forums = await forumService.getModuleForums(1, 20, false, false);

      expect(forums).toHaveLength(1);
      expect(prisma.forum.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { moduleId: 1, isPublished: true },
        })
      );
    });

    it('should throw 404 when module not found', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(null);

      await expect(
        forumService.getModuleForums(999, 20, false, false)
      ).rejects.toThrow(AppError);
      await expect(
        forumService.getModuleForums(999, 20, false, false)
      ).rejects.toThrow('Module not found');
    });

    it('should throw 403 when not enrolled', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModuleData as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(
        forumService.getModuleForums(1, 99, false, false)
      ).rejects.toThrow(AppError);
      await expect(
        forumService.getModuleForums(1, 99, false, false)
      ).rejects.toThrow('Not enrolled');
    });

    it('should show unpublished forums for instructor', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModuleData as any);
      vi.mocked(prisma.forum.findMany).mockResolvedValue([mockForum] as any);

      await forumService.getModuleForums(1, 10, true, false);

      expect(prisma.forum.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { moduleId: 1 },
        })
      );
    });
  });
});
