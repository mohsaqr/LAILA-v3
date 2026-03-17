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
  },
}));

// Mock dependencies
vi.mock('./chat.service.js', () => ({
  chatService: {
    sendMessage: vi.fn(),
  },
}));

vi.mock('./activityLog.service.js', () => ({
  activityLogService: {
    logActivity: vi.fn(),
  },
}));

vi.mock('./courseRole.service.js', () => ({
  courseRoleService: {
    isTeamMember: vi.fn(),
  },
}));

import prisma from '../utils/prisma.js';
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
