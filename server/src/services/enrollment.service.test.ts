import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EnrollmentService } from './enrollment.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    lectureProgress: {
      upsert: vi.fn(),
    },
    lecture: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((callback: any) => callback({
      enrollment: {
        update: vi.fn(),
      },
    })),
  },
}));

// Mock learning analytics
vi.mock('./learningAnalytics.service.js', () => ({
  learningAnalyticsService: {
    logSystemEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  enrollmentLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock email service
vi.mock('./email.service.js', () => ({
  emailService: {
    sendEnrollmentNotification: vi.fn().mockResolvedValue(true),
    sendGradeNotification: vi.fn().mockResolvedValue(true),
    sendQuizResultNotification: vi.fn().mockResolvedValue(true),
    sendEmail: vi.fn().mockResolvedValue(true),
  },
}));

import prisma from '../utils/prisma.js';

describe('EnrollmentService', () => {
  let enrollmentService: EnrollmentService;

  beforeEach(() => {
    enrollmentService = new EnrollmentService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getMyEnrollments', () => {
    it('should return virtual enrollments for admin users', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: true,
        isInstructor: false,
      } as any);

      vi.mocked(prisma.course.findMany).mockResolvedValue([
        {
          id: 1,
          title: 'Test Course',
          status: 'published',
          createdAt: new Date(),
          instructor: { id: 10, fullname: 'Instructor' },
          _count: { modules: 3 },
        },
      ] as any);

      const result = await enrollmentService.getMyEnrollments(1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(-1); // Negative ID for virtual enrollment
      expect(result[0].isVirtualEnrollment).toBe(true);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'published' },
        })
      );
    });

    it('should return virtual enrollments for instructor users (only their courses)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: false,
        isInstructor: true,
      } as any);

      vi.mocked(prisma.course.findMany).mockResolvedValue([
        {
          id: 2,
          title: 'Instructor Course',
          status: 'draft',
          createdAt: new Date(),
          instructor: { id: 5, fullname: 'Me' },
          _count: { modules: 2 },
        },
      ] as any);

      const result = await enrollmentService.getMyEnrollments(5);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(-2);
      expect(result[0].isVirtualEnrollment).toBe(true);
      expect(prisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { instructorId: 5 },
        })
      );
    });

    it('should return actual enrollments for regular students', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: false,
        isInstructor: false,
      } as any);

      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
        {
          id: 100,
          userId: 20,
          courseId: 1,
          status: 'active',
          progress: 50,
          course: {
            id: 1,
            title: 'Student Course',
            instructor: { id: 10, fullname: 'Teacher' },
            _count: { modules: 4 },
          },
        },
      ] as any);

      const result = await enrollmentService.getMyEnrollments(20);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(100);
      expect(result[0].isVirtualEnrollment).toBeUndefined();
    });
  });

  describe('enroll', () => {
    it('should successfully enroll a student in a published course', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: false,
        isInstructor: false,
      } as any);

      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 1,
        title: 'Test Course',
        status: 'published',
      } as any);

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      vi.mocked(prisma.enrollment.create).mockResolvedValue({
        id: 1,
        userId: 10,
        courseId: 1,
        status: 'active',
        course: { id: 1, title: 'Test Course', slug: 'test-course' },
        user: { id: 10, fullname: 'Student', email: 'student@test.com' },
      } as any);

      const result = await enrollmentService.enroll(10, 1);

      expect(result.userId).toBe(10);
      expect(result.courseId).toBe(1);
      expect(prisma.enrollment.create).toHaveBeenCalledWith({
        data: { userId: 10, courseId: 1 },
        include: expect.any(Object),
      });
    });

    it('should throw error if user is admin', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: true,
        isInstructor: false,
      } as any);

      await expect(enrollmentService.enroll(1, 1)).rejects.toThrow(AppError);
      await expect(enrollmentService.enroll(1, 1)).rejects.toThrow(
        'Admins and instructors cannot enroll as students'
      );
    });

    it('should throw error if user is instructor', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: false,
        isInstructor: true,
      } as any);

      await expect(enrollmentService.enroll(1, 1)).rejects.toThrow(AppError);
      await expect(enrollmentService.enroll(1, 1)).rejects.toThrow(
        'Admins and instructors cannot enroll as students'
      );
    });

    it('should throw error if course not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: false,
        isInstructor: false,
      } as any);

      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(enrollmentService.enroll(10, 999)).rejects.toThrow(AppError);
      await expect(enrollmentService.enroll(10, 999)).rejects.toThrow('Course not found');
    });

    it('should throw error if course is not published', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: false,
        isInstructor: false,
      } as any);

      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 1,
        status: 'draft',
      } as any);

      await expect(enrollmentService.enroll(10, 1)).rejects.toThrow(AppError);
      await expect(enrollmentService.enroll(10, 1)).rejects.toThrow('Course is not available for enrollment');
    });

    it('should throw error if already enrolled', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: false,
        isInstructor: false,
      } as any);

      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 1,
        status: 'published',
      } as any);

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 1,
        userId: 10,
        courseId: 1,
      } as any);

      await expect(enrollmentService.enroll(10, 1)).rejects.toThrow(AppError);
      await expect(enrollmentService.enroll(10, 1)).rejects.toThrow('Already enrolled in this course');
    });
  });

  describe('unenroll', () => {
    it('should successfully unenroll a student', async () => {
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 1,
        userId: 10,
        courseId: 1,
        status: 'active',
        progress: 25,
        course: { id: 1, title: 'Test Course' },
      } as any);

      vi.mocked(prisma.enrollment.delete).mockResolvedValue({} as any);

      const result = await enrollmentService.unenroll(10, 1);

      expect(result.message).toBe('Successfully unenrolled from course');
      expect(prisma.enrollment.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw error if not enrolled', async () => {
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(enrollmentService.unenroll(10, 1)).rejects.toThrow(AppError);
      await expect(enrollmentService.unenroll(10, 1)).rejects.toThrow('Not enrolled in this course');
    });
  });

  describe('markLectureComplete', () => {
    it('should mark lecture as complete for enrolled student', async () => {
      const mockEnrollmentBasic = {
        id: 1,
        userId: 10,
        courseId: 1,
      };

      const mockEnrollmentWithCourse = {
        id: 1,
        userId: 10,
        courseId: 1,
        course: {
          modules: [
            { isPublished: true, lectures: [{ id: 5, isPublished: true }] },
          ],
        },
        lectureProgress: [],
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: false,
        isInstructor: false,
      } as any);

      // First call for enrollment check, second call for updateEnrollmentProgress
      vi.mocked(prisma.enrollment.findUnique)
        .mockResolvedValueOnce(mockEnrollmentBasic as any)
        .mockResolvedValueOnce(mockEnrollmentWithCourse as any);

      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        id: 5,
        moduleId: 2,
        module: { courseId: 1 },
      } as any);

      vi.mocked(prisma.lectureProgress.upsert).mockResolvedValue({
        enrollmentId: 1,
        lectureId: 5,
        isCompleted: true,
        completedAt: new Date(),
      } as any);

      vi.mocked(prisma.enrollment.update).mockResolvedValue({} as any);

      const result = await enrollmentService.markLectureComplete(10, 1, 5);

      expect(result.isCompleted).toBe(true);
      expect(prisma.lectureProgress.upsert).toHaveBeenCalled();
    });

    it('should skip tracking for admin users', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: true,
        isInstructor: false,
      } as any);

      const result = await enrollmentService.markLectureComplete(1, 1, 5);

      expect(result.message).toContain('admin/instructor');
      expect(prisma.lectureProgress.upsert).not.toHaveBeenCalled();
    });

    it('should throw error if not enrolled', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: false,
        isInstructor: false,
      } as any);

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(enrollmentService.markLectureComplete(10, 1, 5)).rejects.toThrow(AppError);
      await expect(enrollmentService.markLectureComplete(10, 1, 5)).rejects.toThrow('Not enrolled in this course');
    });

    it('should throw error if lecture not in course', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: false,
        isInstructor: false,
      } as any);

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 1,
        userId: 10,
        courseId: 1,
      } as any);

      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({
        id: 5,
        moduleId: 2,
        module: { courseId: 999 }, // Different course
      } as any);

      await expect(enrollmentService.markLectureComplete(10, 1, 5)).rejects.toThrow(AppError);
      await expect(enrollmentService.markLectureComplete(10, 1, 5)).rejects.toThrow(
        'Lecture not found in this course'
      );
    });
  });

  describe('getEnrollment', () => {
    it('should return virtual enrollment for admin', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: true,
        isInstructor: false,
      } as any);

      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 1,
        title: 'Test Course',
        createdAt: new Date(),
        instructor: { id: 10, fullname: 'Teacher' },
        modules: [],
      } as any);

      const result = await enrollmentService.getEnrollment(1, 1);

      expect(result?.isVirtualEnrollment).toBe(true);
      expect(result?.id).toBe(-1);
    });

    it('should return virtual enrollment for course owner instructor', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: false,
        isInstructor: true,
      } as any);

      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 1,
        title: 'Test Course',
        instructorId: 5, // Same as requesting user
        createdAt: new Date(),
        instructor: { id: 5, fullname: 'Instructor' },
        modules: [],
      } as any);

      const result = await enrollmentService.getEnrollment(5, 1);

      expect(result?.isVirtualEnrollment).toBe(true);
    });

    it('should return null for instructor who does not own course', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: false,
        isInstructor: true,
      } as any);

      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 1,
        title: 'Test Course',
        instructorId: 10, // Different from requesting user
        createdAt: new Date(),
        instructor: { id: 10, fullname: 'Other Instructor' },
        modules: [],
      } as any);

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      const result = await enrollmentService.getEnrollment(5, 1);

      expect(result).toBeNull();
    });

    it('should return null for non-existent course', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        isAdmin: false,
        isInstructor: false,
      } as any);

      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      const result = await enrollmentService.getEnrollment(10, 999);

      expect(result).toBeNull();
    });
  });
});
