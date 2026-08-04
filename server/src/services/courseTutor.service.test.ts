import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    course: {
      findUnique: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
    },
    courseTutor: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    tutorConversation: {
      findMany: vi.fn(),
    },
    courseTutorConversation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    courseTutorMessage: {
      create: vi.fn(),
    },
  },
}));

// Mock dependencies
vi.mock('./chat.service.js', () => ({
  chatService: {
    sendMessage: vi.fn(),
    chat: vi.fn(),
  },
}));

vi.mock('./courseContext.service.js', () => ({
  buildCourseContext: vi.fn(),
}));

vi.mock('./activityLog.service.js', () => ({
  activityLogService: {
    logActivity: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./courseRole.service.js', () => ({
  courseRoleService: {
    isTeamMember: vi.fn(),
  },
}));

import prisma from '../utils/prisma.js';
import { chatService } from './chat.service.js';
import { buildCourseContext } from './courseContext.service.js';
import { courseRoleService } from './courseRole.service.js';
import { courseTutorService } from './courseTutor.service.js';

describe('CourseTutorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStudentTutors', () => {
    const mockChatbot = {
      id: 10,
      name: 'tutor-1',
      displayName: 'Tutor One',
      description: 'A helpful tutor',
      systemPrompt: 'You are helpful.',
      welcomeMessage: 'Hello!',
      avatarUrl: '/avatars/tutor1.png',
      personality: 'friendly',
      temperature: 0.7,
    };

    const mockCourseTutors = [
      {
        id: 1,
        courseId: 100,
        chatbotId: 10,
        customName: null,
        customDescription: null,
        customSystemPrompt: null,
        customWelcomeMessage: null,
        customPersonality: null,
        customTemperature: null,
        isActive: true,
        displayOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        chatbot: mockChatbot,
      },
    ];

    // ---------------------------------------------------------------
    // Enrolled student can see tutors
    // ---------------------------------------------------------------
    it('should return tutors for an enrolled student', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        instructorId: 999,
      } as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.courseTutor.findMany).mockResolvedValue(mockCourseTutors as any);

      const result = await courseTutorService.getStudentTutors(100, 5);

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Tutor One');
      expect(result[0].avatarUrl).toBe('/avatars/tutor1.png');
      expect(result[0].courseTutorId).toBe(1);
      expect(result[0].isCustomized).toBe(false);
    });

    // ---------------------------------------------------------------
    // Course instructor can see tutors
    // ---------------------------------------------------------------
    it('should return tutors for the course instructor', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        instructorId: 5,
      } as any);
      vi.mocked(prisma.courseTutor.findMany).mockResolvedValue(mockCourseTutors as any);

      const result = await courseTutorService.getStudentTutors(100, 5);

      expect(result).toHaveLength(1);
      // Should NOT check enrollment when user is the course instructor
      expect(prisma.enrollment.findUnique).not.toHaveBeenCalled();
    });

    // ---------------------------------------------------------------
    // Team member (TA / co-instructor) can see tutors
    // ---------------------------------------------------------------
    it('should return tutors for a team member', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        instructorId: 999,
      } as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null as any);
      vi.mocked(courseRoleService.isTeamMember).mockResolvedValue(true);
      vi.mocked(prisma.courseTutor.findMany).mockResolvedValue(mockCourseTutors as any);

      const result = await courseTutorService.getStudentTutors(100, 5);

      expect(result).toHaveLength(1);
      expect(courseRoleService.isTeamMember).toHaveBeenCalledWith(5, 100);
    });

    // ---------------------------------------------------------------
    // Admin bypasses enrollment check via isAdmin option
    // ---------------------------------------------------------------
    it('should return tutors for admin without enrollment check', async () => {
      vi.mocked(prisma.courseTutor.findMany).mockResolvedValue(mockCourseTutors as any);

      const result = await courseTutorService.getStudentTutors(100, 1, { isAdmin: true });

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Tutor One');
      // Admin should skip ALL enrollment checks
      expect(prisma.course.findUnique).not.toHaveBeenCalled();
      expect(prisma.enrollment.findUnique).not.toHaveBeenCalled();
      expect(courseRoleService.isTeamMember).not.toHaveBeenCalled();
    });

    // ---------------------------------------------------------------
    // isAdmin: false still checks enrollment
    // ---------------------------------------------------------------
    it('should check enrollment when isAdmin is false', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        instructorId: 999,
      } as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null as any);
      vi.mocked(courseRoleService.isTeamMember).mockResolvedValue(false);

      await expect(
        courseTutorService.getStudentTutors(100, 5, { isAdmin: false })
      ).rejects.toThrow(AppError);
    });

    // ---------------------------------------------------------------
    // Non-enrolled, non-team user gets 403
    // ---------------------------------------------------------------
    it('should throw 403 for unenrolled non-team user', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        instructorId: 999,
      } as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null as any);
      vi.mocked(courseRoleService.isTeamMember).mockResolvedValue(false);

      await expect(
        courseTutorService.getStudentTutors(100, 5)
      ).rejects.toThrow('Not enrolled in this course');
    });

    // ---------------------------------------------------------------
    // Only active tutors are returned
    // ---------------------------------------------------------------
    it('should only query active tutors', async () => {
      vi.mocked(prisma.courseTutor.findMany).mockResolvedValue([] as any);

      await courseTutorService.getStudentTutors(100, 1, { isAdmin: true });

      expect(prisma.courseTutor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { courseId: 100, isActive: true },
        })
      );
    });

    // ---------------------------------------------------------------
    // Custom fields override chatbot defaults (merged config)
    // ---------------------------------------------------------------
    it('should merge custom fields over chatbot defaults', async () => {
      const customTutor = {
        ...mockCourseTutors[0],
        customName: 'Custom Name',
        customDescription: 'Custom desc',
        customPersonality: 'socratic',
      };
      vi.mocked(prisma.courseTutor.findMany).mockResolvedValue([customTutor] as any);

      const result = await courseTutorService.getStudentTutors(100, 1, { isAdmin: true });

      expect(result[0].displayName).toBe('Custom Name');
      expect(result[0].description).toBe('Custom desc');
      expect(result[0].personality).toBe('socratic');
      expect(result[0].isCustomized).toBe(true);
      // Non-customized fields fall back to chatbot
      expect(result[0].avatarUrl).toBe('/avatars/tutor1.png');
    });

    // ---------------------------------------------------------------
    // Empty course returns empty array
    // ---------------------------------------------------------------
    it('should return empty array when no tutors assigned', async () => {
      vi.mocked(prisma.courseTutor.findMany).mockResolvedValue([] as any);

      const result = await courseTutorService.getStudentTutors(100, 1, { isAdmin: true });

      expect(result).toEqual([]);
    });
  });
});

// The tutor was given the course TITLE and nothing else, so "what does this
// course cover?" was answered from the title alone. sendMessage had no tests at
// all, so nothing held the fix — or the old behaviour — in place.
describe('CourseTutorService.sendMessage — course context in the prompt', () => {
  const CONVERSATION = {
    id: 11,
    userId: 42,
    courseTutor: {
      id: 4,
      courseTutorId: 4,
      customSystemPrompt: null,
      chatbot: { id: 2, name: 'socratic', displayName: 'Socratic Guide', systemPrompt: 'You are Socratic.', temperature: 0.7 },
      course: { id: 1, title: 'Learning Analytics' },
    },
    messages: [],
  };

  const sentPrompt = () => (vi.mocked(chatService.chat).mock.calls[0][0] as any).systemPrompt as string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.courseTutorConversation.findUnique).mockResolvedValue(CONVERSATION as any);
    vi.mocked(prisma.courseTutorMessage.create).mockResolvedValue({ id: 1, role: 'user', content: 'hi', createdAt: new Date() } as any);
    vi.mocked(prisma.courseTutorConversation.update).mockResolvedValue(CONVERSATION as any);
    vi.mocked(chatService.chat).mockResolvedValue({ reply: 'Indeed.', model: 'm', responseTime: 1 } as any);
    vi.mocked(buildCourseContext).mockResolvedValue(
      'Course: Learning Analytics\nTopics covered in this course:\n1. Foundations'
    );
  });

  it('puts the course outline in the system prompt', async () => {
    await courseTutorService.sendMessage(11, 42, 'What does this course cover?');

    expect(buildCourseContext).toHaveBeenCalledWith(1);
    expect(sentPrompt()).toContain('Topics covered in this course:');
    expect(sentPrompt()).toContain('Foundations');
  });

  it('keeps the persona and the stay-in-character instruction', async () => {
    await courseTutorService.sendMessage(11, 42, 'hi');

    expect(sentPrompt()).toContain('You are Socratic.');
    expect(sentPrompt()).toContain('Stay in character');
  });

  it('degrades to the old behaviour when the outline is empty', async () => {
    vi.mocked(buildCourseContext).mockResolvedValue('');

    await courseTutorService.sendMessage(11, 42, 'hi');

    // No blank gap, and the course is still named.
    expect(sentPrompt()).toContain('Learning Analytics');
    expect(sentPrompt()).not.toMatch(/\n\n\n/);
  });

  it('builds the context before storing the user message', async () => {
    // Ordering: a DB failure here must not leave the student's message saved
    // with no reply, or their retry stores it twice.
    vi.mocked(buildCourseContext).mockRejectedValue(new Error('db down'));

    await expect(courseTutorService.sendMessage(11, 42, 'hi')).rejects.toThrow();
    expect(prisma.courseTutorMessage.create).not.toHaveBeenCalled();
  });
});
