import { describe, it, expect, vi, beforeEach } from 'vitest';
import { forumService } from './forum.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    forumThread: { findUnique: vi.fn() },
    forumPost: { findUnique: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    chatbot: { findUnique: vi.fn() },
  },
}));

vi.mock('./courseRole.service.js', () => ({
  courseRoleService: { isTeamMember: vi.fn() },
}));

// Heavy collaborators that must never run on the rejection path.
vi.mock('./chat.service.js', () => ({ chatService: { chat: vi.fn() } }));
vi.mock('./notification.service.js', () => ({ notificationService: { notify: vi.fn() } }));
vi.mock('../utils/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import prisma from '../utils/prisma.js';
import { courseRoleService } from './courseRole.service.js';
import { chatService } from './chat.service.js';

const future = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

describe('ForumService - availability enforcement on writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(courseRoleService.isTeamMember).mockResolvedValue(false);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 5, isAdmin: false, isInstructor: false } as any);
  });

  it('createPost rejects an enrolled student posting before the thread opens', async () => {
    vi.mocked(prisma.forumThread.findUnique).mockResolvedValue({
      id: 1,
      courseId: 10,
      isLocked: false,
      isPublished: true,
      availableFrom: future(),
      availableUntil: null,
      course: { instructorId: 1 },
    } as any);

    await expect(
      forumService.createPost(1, 5, { content: 'hi' } as any),
    ).rejects.toThrow('Forum is not yet available');
    expect(prisma.forumPost.create).not.toHaveBeenCalled();
  });

  it('createAiPost rejects triggering an AI reply before the thread opens', async () => {
    vi.mocked(prisma.forumThread.findUnique).mockResolvedValue({
      id: 1,
      courseId: 10,
      isLocked: false,
      availableFrom: future(),
      availableUntil: null,
      course: { id: 10, title: 'C', instructorId: 1 },
      posts: [],
    } as any);

    await expect(
      forumService.createAiPost(1, 5, 7),
    ).rejects.toThrow('Forum is not yet available');
    // The paid LLM call must never be reached for an out-of-window request.
    expect(chatService.chat).not.toHaveBeenCalled();
  });

  it('toggleThreadLike rejects an enrolled student reacting before the thread opens', async () => {
    vi.mocked(prisma.forumThread.findUnique).mockResolvedValue({
      id: 1,
      courseId: 10,
      availableFrom: future(),
      availableUntil: null,
      course: { id: 10, instructorId: 1 },
    } as any);

    await expect(
      forumService.toggleThreadLike(1, 5, 'like'),
    ).rejects.toThrow('Forum is not yet available');
  });
});
