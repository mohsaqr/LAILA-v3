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

  describe('updateThread', () => {
    it('should update thread as author', async () => {
      const mockThreadForUpdate = {
        ...mockThread,
        authorId: 20,
      };
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(mockThreadForUpdate as any);
      vi.mocked(prisma.forumThread.update).mockResolvedValue({
        ...mockThreadForUpdate,
        title: 'Updated Title',
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const thread = await forumService.updateThread(1, 20, { title: 'Updated Title' });

      expect(thread.title).toBe('Updated Title');
    });

    it('should allow instructor to update any thread', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(mockThread as any);
      vi.mocked(prisma.forumThread.update).mockResolvedValue({
        ...mockThread,
        title: 'Updated By Instructor',
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ fullname: 'Instructor' } as any);

      const thread = await forumService.updateThread(1, 10, { title: 'Updated By Instructor' });

      expect(thread.title).toBe('Updated By Instructor');
    });

    it('should throw 404 when thread not found', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(null);

      await expect(
        forumService.updateThread(999, 20, { title: 'Test' })
      ).rejects.toThrow(AppError);
      await expect(
        forumService.updateThread(999, 20, { title: 'Test' })
      ).rejects.toThrow('Thread not found');
    });

    it('should throw 400 when thread is locked', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue({
        ...mockThread,
        isLocked: true,
        authorId: 20,
      } as any);

      await expect(
        forumService.updateThread(1, 20, { title: 'Test' })
      ).rejects.toThrow(AppError);
      await expect(
        forumService.updateThread(1, 20, { title: 'Test' })
      ).rejects.toThrow('Thread is locked');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(mockThread as any);

      await expect(
        forumService.updateThread(1, 99, { title: 'Test' }, false)
      ).rejects.toThrow(AppError);
      await expect(
        forumService.updateThread(1, 99, { title: 'Test' }, false)
      ).rejects.toThrow('Not authorized');
    });
  });

  describe('deleteThread', () => {
    it('should delete thread as author', async () => {
      const mockThreadForDelete = {
        ...mockThread,
        authorId: 20,
        _count: { posts: 3 },
      };
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(mockThreadForDelete as any);
      vi.mocked(prisma.forumThread.delete).mockResolvedValue(mockThread as any);
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any) // Deleter
        .mockResolvedValueOnce({ fullname: 'Thread Author' } as any); // Thread author

      const result = await forumService.deleteThread(1, 20);

      expect(result.message).toBe('Thread deleted');
    });

    it('should allow instructor to delete any thread', async () => {
      const mockThreadWithCount = {
        ...mockThread,
        _count: { posts: 5 },
      };
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(mockThreadWithCount as any);
      vi.mocked(prisma.forumThread.delete).mockResolvedValue(mockThread as any);
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce({ fullname: 'Instructor' } as any)
        .mockResolvedValueOnce({ fullname: 'Thread Author' } as any);

      const result = await forumService.deleteThread(1, 10);

      expect(result.message).toBe('Thread deleted');
    });

    it('should throw 404 when thread not found', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(null);

      await expect(forumService.deleteThread(999, 20)).rejects.toThrow(AppError);
      await expect(forumService.deleteThread(999, 20)).rejects.toThrow('Thread not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(mockThread as any);

      await expect(forumService.deleteThread(1, 99, false)).rejects.toThrow(AppError);
      await expect(forumService.deleteThread(1, 99, false)).rejects.toThrow('Not authorized');
    });

    it('should delete thread with anonymous author', async () => {
      const anonThread = {
        ...mockThread,
        authorId: 20,
        isAnonymous: true,
        _count: { posts: 0 },
      };
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(anonThread as any);
      vi.mocked(prisma.forumThread.delete).mockResolvedValue(mockThread as any);
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce({ fullname: 'Thread Author' } as any);

      const result = await forumService.deleteThread(1, 20);

      expect(result.message).toBe('Thread deleted');
    });
  });

  describe('getThreads', () => {
    it('should return threads for enrolled user', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(mockForum as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.forumThread.findMany).mockResolvedValue([{
        ...mockThread,
        posts: [{ id: 1 }],
      }] as any);
      vi.mocked(prisma.forumThread.count).mockResolvedValue(1);
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 15, fullname: 'Thread Author' }] as any);

      const result = await forumService.getThreads(1, 20, 1, 20, false, false);

      expect(result.threads).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.threads[0].replyCount).toBe(1);
    });

    it('should throw 404 when forum not found', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(null);

      await expect(forumService.getThreads(999, 20)).rejects.toThrow(AppError);
      await expect(forumService.getThreads(999, 20)).rejects.toThrow('Forum not found');
    });

    it('should throw 403 when not enrolled', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(mockForum as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(forumService.getThreads(1, 99, 1, 20, false, false)).rejects.toThrow(AppError);
      await expect(forumService.getThreads(1, 99, 1, 20, false, false)).rejects.toThrow('Not enrolled');
    });

    it('should allow instructor to view threads', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(mockForum as any);
      vi.mocked(prisma.forumThread.findMany).mockResolvedValue([mockThread] as any);
      vi.mocked(prisma.forumThread.count).mockResolvedValue(1);
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 15, fullname: 'Thread Author' }] as any);

      const result = await forumService.getThreads(1, 10, 1, 20, true, false);

      expect(result.threads).toHaveLength(1);
    });

    it('should hide author for anonymous threads', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(mockForum as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.forumThread.findMany).mockResolvedValue([{
        ...mockThread,
        isAnonymous: true,
        posts: [],
      }] as any);
      vi.mocked(prisma.forumThread.count).mockResolvedValue(1);
      vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: 15, fullname: 'Thread Author' }] as any);

      const result = await forumService.getThreads(1, 20, 1, 20, false, false);

      expect(result.threads[0].author).toBeNull();
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

    it('should throw 400 when anonymous posting not allowed in forum', async () => {
      const threadWithNoAnon = {
        ...mockThread,
        forum: { ...mockThread.forum, allowAnonymous: false },
      };
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(threadWithNoAnon as any);
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce({ fullname: 'Thread Author' } as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);

      await expect(
        forumService.createPost(1, 20, { content: 'Test', isAnonymous: true })
      ).rejects.toThrow(AppError);
      await expect(
        forumService.createPost(1, 20, { content: 'Test', isAnonymous: true })
      ).rejects.toThrow('Anonymous posting is not allowed in this forum');
    });

    it('should create reply to parent post successfully', async () => {
      const threadWithAnon = {
        ...mockThread,
        forum: { ...mockThread.forum, allowAnonymous: true },
      };
      const parentPost = {
        id: 5,
        threadId: 1,
        authorId: 30,
        content: 'This is the parent post content that is fairly long and exceeds 200 characters so we can test the truncation logic properly. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        isAnonymous: false,
      };
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(threadWithAnon as any);
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any) // User check
        .mockResolvedValueOnce({ id: 30, fullname: 'Parent Author' } as any) // Parent author check
        .mockResolvedValueOnce({ fullname: 'Thread Author' } as any); // Thread author
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.forumPost.findUnique).mockResolvedValue(parentPost as any);
      vi.mocked(prisma.forumPost.create).mockResolvedValue({
        ...mockPost,
        parentId: 5,
      } as any);

      const post = await forumService.createPost(1, 20, {
        content: 'Reply to parent',
        parentId: 5,
      });

      expect(post.parentId).toBe(5);
    });

    it('should handle anonymous parent post in reply', async () => {
      const threadWithAnon = {
        ...mockThread,
        forum: { ...mockThread.forum, allowAnonymous: true },
      };
      const parentPost = {
        id: 5,
        threadId: 1,
        authorId: 30,
        content: 'Anonymous parent',
        isAnonymous: true,
      };
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(threadWithAnon as any);
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce({ id: 30, fullname: 'Parent Author' } as any)
        .mockResolvedValueOnce({ fullname: 'Thread Author' } as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.forumPost.findUnique).mockResolvedValue(parentPost as any);
      vi.mocked(prisma.forumPost.create).mockResolvedValue({
        ...mockPost,
        parentId: 5,
      } as any);

      const post = await forumService.createPost(1, 20, {
        content: 'Reply to anonymous',
        parentId: 5,
      });

      expect(post.parentId).toBe(5);
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

    it('should delete post with parentId and log parent info', async () => {
      const postWithParent = {
        ...mockPost,
        authorId: 20,
        parentId: 5,
        thread: mockThread,
      };
      const parentPost = {
        id: 5,
        authorId: 30,
        content: 'Parent post content',
        isAnonymous: false,
      };
      vi.mocked(prisma.forumPost.findUnique)
        .mockResolvedValueOnce(postWithParent as any) // First call for the post to delete
        .mockResolvedValueOnce(parentPost as any); // Second call for the parent post
      vi.mocked(prisma.forumPost.delete).mockResolvedValue(postWithParent as any);
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any) // Deleter info
        .mockResolvedValueOnce({ fullname: 'Post Author' } as any) // Post author
        .mockResolvedValueOnce({ fullname: 'Parent Author' } as any); // Parent author

      const result = await forumService.deletePost(1, 20);

      expect(result.message).toBe('Post deleted');
    });

    it('should handle delete post with anonymous parent', async () => {
      const postWithParent = {
        ...mockPost,
        authorId: 20,
        parentId: 5,
        thread: mockThread,
      };
      const parentPost = {
        id: 5,
        authorId: 30,
        content: 'Parent post content',
        isAnonymous: true,
      };
      vi.mocked(prisma.forumPost.findUnique)
        .mockResolvedValueOnce(postWithParent as any)
        .mockResolvedValueOnce(parentPost as any);
      vi.mocked(prisma.forumPost.delete).mockResolvedValue(postWithParent as any);
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce({ fullname: 'Post Author' } as any)
        .mockResolvedValueOnce({ fullname: 'Parent Author' } as any);

      const result = await forumService.deletePost(1, 20);

      expect(result.message).toBe('Post deleted');
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

    it('should throw 403 when user not enrolled and not instructor', async () => {
      // User is not admin, not instructor, and not course owner
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 30,
        fullname: 'Other User',
        email: 'other@test.com',
        isAdmin: false,
        isInstructor: false,
      } as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(forumService.createAiPost(1, 30, 1)).rejects.toThrow(AppError);
      await expect(forumService.createAiPost(1, 30, 1)).rejects.toThrow('Not enrolled in this course');
    });

    it('should throw 400 when parent post belongs to different thread', async () => {
      vi.mocked(prisma.forumPost.findUnique).mockResolvedValue({
        id: 5,
        threadId: 999, // Different thread
        content: 'Parent in different thread',
        authorId: 20,
        isAnonymous: false,
      } as any);

      await expect(forumService.createAiPost(1, 20, 1, 5)).rejects.toThrow(AppError);
      await expect(forumService.createAiPost(1, 20, 1, 5)).rejects.toThrow('Invalid parent post');
    });

    it('should create AI post with existing thread posts for context', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue({
        ...mockThread,
        isAnonymous: true,
        posts: [
          {
            id: 1,
            content: 'First post',
            authorId: 21,
            isAnonymous: false,
            isAiGenerated: false,
            aiAgentName: null,
            createdAt: new Date(),
          },
          {
            id: 2,
            content: 'AI response',
            authorId: 20,
            isAnonymous: false,
            isAiGenerated: true,
            aiAgentName: 'Math Tutor',
            createdAt: new Date(),
          },
          {
            id: 3,
            content: 'Anonymous reply',
            authorId: 22,
            isAnonymous: true,
            isAiGenerated: false,
            aiAgentName: null,
            createdAt: new Date(),
          },
        ],
      } as any);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 21, fullname: 'User 21' },
        { id: 22, fullname: 'User 22' },
      ] as any);
      vi.mocked(prisma.forumPost.create).mockResolvedValue({
        ...mockPost,
        isAiGenerated: true,
        aiAgentName: 'Math Tutor',
      } as any);

      const post = await forumService.createAiPost(1, 20, 1);

      expect(post.isAiGenerated).toBe(true);
      expect(chatService.chat).toHaveBeenCalled();
    });

    it('should handle parent post not found', async () => {
      vi.mocked(prisma.forumPost.findUnique).mockResolvedValue(null);

      await expect(forumService.createAiPost(1, 20, 1, 999)).rejects.toThrow(AppError);
      await expect(forumService.createAiPost(1, 20, 1, 999)).rejects.toThrow('Invalid parent post');
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

  // ===========================================================================
  // updateForum
  // ===========================================================================

  describe('updateForum', () => {
    const mockForumWithCourse = {
      id: 1,
      title: 'Test Forum',
      courseId: 1,
      course: { id: 1, title: 'Test Course', instructorId: 10 },
    };

    it('should update forum as instructor', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(mockForumWithCourse as any);
      vi.mocked(prisma.forum.update).mockResolvedValue({
        ...mockForumWithCourse,
        title: 'Updated Forum',
      } as any);

      const result = await forumService.updateForum(1, 10, { title: 'Updated Forum' });

      expect(result.title).toBe('Updated Forum');
      expect(prisma.forum.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { title: 'Updated Forum' },
      });
    });

    it('should update forum as admin', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(mockForumWithCourse as any);
      vi.mocked(prisma.forum.update).mockResolvedValue({
        ...mockForumWithCourse,
        description: 'New description',
      } as any);

      const result = await forumService.updateForum(1, 99, { description: 'New description' }, true);

      expect(result.description).toBe('New description');
    });

    it('should throw 404 when forum not found', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(null);

      await expect(
        forumService.updateForum(999, 10, { title: 'Updated' })
      ).rejects.toThrow(AppError);
      await expect(
        forumService.updateForum(999, 10, { title: 'Updated' })
      ).rejects.toThrow('Forum not found');
    });

    it('should throw 403 when not authorized', async () => {
      vi.mocked(prisma.forum.findUnique).mockResolvedValue(mockForumWithCourse as any);

      await expect(
        forumService.updateForum(1, 99, { title: 'Updated' }, false)
      ).rejects.toThrow(AppError);
      await expect(
        forumService.updateForum(1, 99, { title: 'Updated' }, false)
      ).rejects.toThrow('Not authorized');
    });
  });

  // ===========================================================================
  // getAllUserForums
  // ===========================================================================

  describe('getAllUserForums', () => {
    const mockForums = [
      {
        id: 1,
        title: 'Forum 1',
        description: 'Description 1',
        courseId: 1,
        course: { id: 1, title: 'Course 1' },
        _count: { threads: 5 },
        threads: [{ createdAt: new Date() }],
      },
    ];

    it('should return forums for enrolled student', async () => {
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([{ courseId: 1 }] as any);
      vi.mocked(prisma.forum.findMany).mockResolvedValue(mockForums as any);

      const result = await forumService.getAllUserForums(20, false, false);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Forum 1');
      expect(result[0].threadCount).toBe(5);
    });

    it('should return forums for instructor including own courses', async () => {
      vi.mocked(prisma.course.findMany).mockResolvedValue([{ id: 2 }] as any);
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([{ courseId: 1 }] as any);
      vi.mocked(prisma.forum.findMany).mockResolvedValue(mockForums as any);

      const result = await forumService.getAllUserForums(10, true, false);

      expect(result).toHaveLength(1);
      // Verify course.findMany was called for instructor's own courses
      expect(prisma.course.findMany).toHaveBeenCalledWith({
        where: { instructorId: 10 },
        select: { id: true },
      });
    });

    it('should return empty array when no enrollments', async () => {
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([]);

      const result = await forumService.getAllUserForums(20, false, false);

      expect(result).toEqual([]);
    });

    it('should return all forums for admin', async () => {
      vi.mocked(prisma.course.findMany).mockResolvedValue([{ id: 1 }] as any);
      vi.mocked(prisma.forum.findMany).mockResolvedValue(mockForums as any);

      const result = await forumService.getAllUserForums(99, false, true);

      expect(result).toHaveLength(1);
    });
  });

  // ===========================================================================
  // getThread - additional tests
  // ===========================================================================

  describe('getThread - enrollment check', () => {
    const mockThread = {
      id: 1,
      title: 'Test Thread',
      content: 'Content',
      authorId: 20,
      forum: {
        id: 1,
        courseId: 1,
        course: { id: 1, instructorId: 10 },
      },
      posts: [],
    };

    it('should throw 403 when not enrolled and not instructor', async () => {
      vi.mocked(prisma.forumThread.findUnique).mockResolvedValue(mockThread as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(
        forumService.getThread(1, 99, false, false)
      ).rejects.toThrow(AppError);
      await expect(
        forumService.getThread(1, 99, false, false)
      ).rejects.toThrow('Not enrolled in this course');
    });
  });
});
