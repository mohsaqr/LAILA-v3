import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssignmentService } from './assignment.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    assignment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    assignmentSubmission: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
    },
    assignmentAttachment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock learning analytics
vi.mock('./learningAnalytics.service.js', () => ({
  learningAnalyticsService: {
    logAssessmentEvent: vi.fn().mockResolvedValue(undefined),
    logSystemEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  assignmentLogger: {
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

describe('AssignmentService', () => {
  let assignmentService: AssignmentService;

  beforeEach(() => {
    assignmentService = new AssignmentService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAssignments', () => {
    it('should return all assignments for instructor', async () => {
      const mockAssignments = [
        {
          id: 1,
          title: 'Assignment 1',
          isPublished: true,
          module: { id: 1, title: 'Module 1' },
          _count: { submissions: 5 },
        },
        {
          id: 2,
          title: 'Draft Assignment',
          isPublished: false,
          module: null,
          _count: { submissions: 0 },
        },
      ];

      vi.mocked(prisma.assignment.findMany).mockResolvedValue(mockAssignments as any);

      const result = await assignmentService.getAssignments(1, 10, true, false);

      expect(result).toHaveLength(2);
      expect(prisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { courseId: 1 },
        })
      );
    });

    it('should only return published assignments for students', async () => {
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 1,
        userId: 20,
        courseId: 1,
      } as any);

      vi.mocked(prisma.assignment.findMany).mockResolvedValue([
        {
          id: 1,
          title: 'Assignment 1',
          isPublished: true,
          module: { id: 1, title: 'Module 1' },
          _count: { submissions: 5 },
        },
      ] as any);

      vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue([
        {
          assignmentId: 1,
          status: 'submitted',
          grade: null,
          submittedAt: new Date(),
        },
      ] as any);

      const result = await assignmentService.getAssignments(1, 20, false, false);

      expect(prisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { courseId: 1, isPublished: true },
        })
      );
      expect(result[0].mySubmission).toBeDefined();
    });

    it('should throw error if student not enrolled', async () => {
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(assignmentService.getAssignments(1, 20, false, false)).rejects.toThrow(AppError);
      await expect(assignmentService.getAssignments(1, 20, false, false)).rejects.toThrow(
        'You must be enrolled in this course to view assignments'
      );
    });
  });

  describe('createAssignment', () => {
    const mockCourse = {
      id: 1,
      title: 'Test Course',
      instructorId: 10,
    };

    const validInput = {
      title: 'New Assignment',
      description: 'Description here',
      points: 100,
      submissionType: 'text' as const,
    };

    it('should create assignment for course owner', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.assignment.create).mockResolvedValue({
        id: 1,
        ...validInput,
        courseId: 1,
        module: null,
      } as any);

      const result = await assignmentService.createAssignment(1, 10, validInput);

      expect(result.title).toBe('New Assignment');
      expect(prisma.assignment.create).toHaveBeenCalled();
    });

    it('should create assignment for admin', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.assignment.create).mockResolvedValue({
        id: 1,
        ...validInput,
        courseId: 1,
        module: null,
      } as any);

      const result = await assignmentService.createAssignment(1, 99, validInput, true);

      expect(result.title).toBe('New Assignment');
    });

    it('should throw error if course not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(assignmentService.createAssignment(999, 10, validInput)).rejects.toThrow(AppError);
      await expect(assignmentService.createAssignment(999, 10, validInput)).rejects.toThrow('Course not found');
    });

    it('should throw error if not authorized', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);

      await expect(assignmentService.createAssignment(1, 99, validInput, false)).rejects.toThrow(AppError);
      await expect(assignmentService.createAssignment(1, 99, validInput, false)).rejects.toThrow('Not authorized');
    });
  });

  describe('submitAssignment', () => {
    const mockAssignment = {
      id: 1,
      title: 'Test Assignment',
      courseId: 1,
      isPublished: true,
      dueDate: new Date(Date.now() + 86400000), // Tomorrow
      points: 100,
      course: { id: 1, instructorId: 10 },
    };

    it('should successfully submit assignment', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 1,
        userId: 20,
        courseId: 1,
      } as any);
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.assignmentSubmission.upsert).mockResolvedValue({
        id: 1,
        assignmentId: 1,
        userId: 20,
        content: 'My submission',
        status: 'submitted',
        submittedAt: new Date(),
      } as any);

      const result = await assignmentService.submitAssignment(1, 20, {
        content: 'My submission',
      });

      expect(result.status).toBe('submitted');
      expect(prisma.assignmentSubmission.upsert).toHaveBeenCalled();
    });

    it('should throw error if assignment not published', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        ...mockAssignment,
        isPublished: false,
      } as any);

      await expect(
        assignmentService.submitAssignment(1, 20, { content: 'Test' })
      ).rejects.toThrow(AppError);
      await expect(
        assignmentService.submitAssignment(1, 20, { content: 'Test' })
      ).rejects.toThrow('Assignment is not available');
    });

    it('should throw error if not enrolled', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(
        assignmentService.submitAssignment(1, 20, { content: 'Test' })
      ).rejects.toThrow(AppError);
      await expect(
        assignmentService.submitAssignment(1, 20, { content: 'Test' })
      ).rejects.toThrow('You must be enrolled to submit');
    });

    it('should throw error if due date passed', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        ...mockAssignment,
        dueDate: new Date(Date.now() - 86400000), // Yesterday
      } as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: 1,
        userId: 20,
        courseId: 1,
      } as any);

      await expect(
        assignmentService.submitAssignment(1, 20, { content: 'Test' })
      ).rejects.toThrow(AppError);
      await expect(
        assignmentService.submitAssignment(1, 20, { content: 'Test' })
      ).rejects.toThrow('Assignment due date has passed');
    });
  });

  describe('gradeSubmission', () => {
    const mockSubmission = {
      id: 1,
      assignmentId: 1,
      userId: 20,
      content: 'Student work',
      status: 'submitted',
      grade: null,
      assignment: {
        id: 1,
        title: 'Test Assignment',
        points: 100,
        courseId: 1,
        course: { id: 1, instructorId: 10 },
      },
      user: { id: 20, fullname: 'Student', email: 'student@test.com' },
    };

    it('should successfully grade submission', async () => {
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue(mockSubmission as any);
      vi.mocked(prisma.assignmentSubmission.update).mockResolvedValue({
        ...mockSubmission,
        grade: 85,
        feedback: 'Good work!',
        status: 'graded',
        gradedAt: new Date(),
        gradedById: 10,
        user: { id: 20, fullname: 'Student', email: 'student@test.com' },
      } as any);

      const result = await assignmentService.gradeSubmission(1, 10, {
        grade: 85,
        feedback: 'Good work!',
      });

      expect(result.grade).toBe(85);
      expect(result.status).toBe('graded');
    });

    it('should throw error if submission not found', async () => {
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue(null);

      await expect(
        assignmentService.gradeSubmission(999, 10, { grade: 85 })
      ).rejects.toThrow(AppError);
      await expect(
        assignmentService.gradeSubmission(999, 10, { grade: 85 })
      ).rejects.toThrow('Submission not found');
    });

    it('should throw error if not authorized', async () => {
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue(mockSubmission as any);

      await expect(
        assignmentService.gradeSubmission(1, 99, { grade: 85 }, false)
      ).rejects.toThrow(AppError);
      await expect(
        assignmentService.gradeSubmission(1, 99, { grade: 85 }, false)
      ).rejects.toThrow('Not authorized');
    });

    it('should allow admin to grade any submission', async () => {
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue(mockSubmission as any);
      vi.mocked(prisma.assignmentSubmission.update).mockResolvedValue({
        ...mockSubmission,
        grade: 90,
        status: 'graded',
        user: { id: 20, fullname: 'Student', email: 'student@test.com' },
      } as any);

      const result = await assignmentService.gradeSubmission(1, 99, { grade: 90 }, true);

      expect(result.grade).toBe(90);
    });
  });

  describe('getCourseGradebook', () => {
    it('should return gradebook with all assignments and students', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 1,
        instructorId: 10,
      } as any);

      vi.mocked(prisma.assignment.findMany).mockResolvedValue([
        { id: 1, title: 'Assignment 1', points: 100 },
        { id: 2, title: 'Assignment 2', points: 50 },
      ] as any);

      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
        { userId: 20, user: { id: 20, fullname: 'Student 1', email: 's1@test.com' } },
        { userId: 21, user: { id: 21, fullname: 'Student 2', email: 's2@test.com' } },
      ] as any);

      vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue([
        { assignmentId: 1, userId: 20, grade: 85, status: 'graded' },
        { assignmentId: 1, userId: 21, grade: 90, status: 'graded' },
        { assignmentId: 2, userId: 20, grade: 45, status: 'graded' },
      ] as any);

      const result = await assignmentService.getCourseGradebook(1, 10);

      expect(result.assignments).toHaveLength(2);
      expect(result.gradebook).toHaveLength(2);
      expect(result.gradebook[0].grades).toHaveLength(2);
    });

    it('should throw error if course not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(assignmentService.getCourseGradebook(999, 10)).rejects.toThrow(AppError);
      await expect(assignmentService.getCourseGradebook(999, 10)).rejects.toThrow('Course not found');
    });

    it('should throw error if not authorized', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 1,
        instructorId: 10,
      } as any);

      await expect(assignmentService.getCourseGradebook(1, 99, false)).rejects.toThrow(AppError);
      await expect(assignmentService.getCourseGradebook(1, 99, false)).rejects.toThrow('Not authorized');
    });
  });

  describe('deleteAssignment', () => {
    it('should delete assignment for course owner', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 1,
        courseId: 1,
        course: { id: 1, instructorId: 10 },
      } as any);

      vi.mocked(prisma.assignment.delete).mockResolvedValue({} as any);

      const result = await assignmentService.deleteAssignment(1, 10);

      expect(result.message).toBe('Assignment deleted successfully');
      expect(prisma.assignment.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw error if assignment not found', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null);

      await expect(assignmentService.deleteAssignment(999, 10)).rejects.toThrow(AppError);
      await expect(assignmentService.deleteAssignment(999, 10)).rejects.toThrow('Assignment not found');
    });

    it('should throw error if not authorized', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 1,
        courseId: 1,
        course: { id: 1, instructorId: 10 },
      } as any);

      await expect(assignmentService.deleteAssignment(1, 99, false)).rejects.toThrow(AppError);
      await expect(assignmentService.deleteAssignment(1, 99, false)).rejects.toThrow('Not authorized');
    });

    it('should allow admin to delete assignment', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 1,
        courseId: 1,
        course: { id: 1, instructorId: 10 },
      } as any);
      vi.mocked(prisma.assignment.delete).mockResolvedValue({} as any);

      const result = await assignmentService.deleteAssignment(1, 99, true);

      expect(result.message).toBe('Assignment deleted successfully');
    });
  });

  // ===========================================================================
  // getAssignmentById
  // ===========================================================================

  describe('getAssignmentById', () => {
    const mockAssignment = {
      id: 1,
      title: 'Test Assignment',
      courseId: 1,
      course: { id: 1, title: 'Test Course', instructorId: 10 },
      module: { id: 1, title: 'Module 1' },
    };

    it('should return assignment without user submission', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);

      const result = await assignmentService.getAssignmentById(1);

      expect(result.title).toBe('Test Assignment');
      expect((result as any).mySubmission).toBeUndefined();
    });

    it('should return assignment with user submission when userId provided', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue({
        id: 1,
        assignmentId: 1,
        userId: 20,
        content: 'My work',
        status: 'submitted',
      } as any);

      const result = await assignmentService.getAssignmentById(1, 20);

      expect(result.title).toBe('Test Assignment');
      expect((result as any).mySubmission.content).toBe('My work');
    });

    it('should return null submission when user has no submission', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue(null);

      const result = await assignmentService.getAssignmentById(1, 20);

      expect(result.title).toBe('Test Assignment');
      expect((result as any).mySubmission).toBeNull();
    });

    it('should throw 404 when assignment not found', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null);

      await expect(assignmentService.getAssignmentById(999)).rejects.toThrow(AppError);
      await expect(assignmentService.getAssignmentById(999)).rejects.toThrow('Assignment not found');
    });
  });

  describe('updateAssignment', () => {
    const mockAssignment = {
      id: 1,
      title: 'Test Assignment',
      courseId: 1,
      course: { id: 1, instructorId: 10 },
    };

    it('should update assignment for course owner', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);
      vi.mocked(prisma.assignment.update).mockResolvedValue({
        ...mockAssignment,
        title: 'Updated Title',
      } as any);

      const result = await assignmentService.updateAssignment(1, 10, { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
      expect(prisma.assignment.update).toHaveBeenCalled();
    });

    it('should update assignment with due date', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);
      vi.mocked(prisma.assignment.update).mockResolvedValue({
        ...mockAssignment,
        dueDate: new Date('2024-12-31'),
      } as any);

      const result = await assignmentService.updateAssignment(1, 10, { dueDate: '2024-12-31' });

      expect(prisma.assignment.update).toHaveBeenCalled();
    });

    it('should allow admin to update any assignment', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);
      vi.mocked(prisma.assignment.update).mockResolvedValue(mockAssignment as any);

      const result = await assignmentService.updateAssignment(1, 99, { title: 'Updated' }, true);

      expect(prisma.assignment.update).toHaveBeenCalled();
    });

    it('should throw error if assignment not found', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null);

      await expect(assignmentService.updateAssignment(999, 10, { title: 'Test' })).rejects.toThrow(AppError);
      await expect(assignmentService.updateAssignment(999, 10, { title: 'Test' })).rejects.toThrow('Assignment not found');
    });

    it('should throw error if not authorized', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);

      await expect(assignmentService.updateAssignment(1, 99, { title: 'Test' }, false)).rejects.toThrow(AppError);
      await expect(assignmentService.updateAssignment(1, 99, { title: 'Test' }, false)).rejects.toThrow('Not authorized');
    });
  });

  describe('getSubmissions', () => {
    const mockAssignment = {
      id: 1,
      title: 'Test Assignment',
      courseId: 1,
      course: { id: 1, instructorId: 10 },
    };

    it('should return submissions for instructor', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);
      vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue([
        { id: 1, userId: 20, content: 'Submission 1', status: 'submitted' },
        { id: 2, userId: 21, content: 'Submission 2', status: 'graded' },
      ] as any);

      const result = await assignmentService.getSubmissions(1, 10);

      expect(result).toHaveLength(2);
    });

    it('should throw error if assignment not found', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null);

      await expect(assignmentService.getSubmissions(999, 10)).rejects.toThrow(AppError);
      await expect(assignmentService.getSubmissions(999, 10)).rejects.toThrow('Assignment not found');
    });

    it('should throw error if not authorized', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);

      await expect(assignmentService.getSubmissions(1, 99, false)).rejects.toThrow(AppError);
      await expect(assignmentService.getSubmissions(1, 99, false)).rejects.toThrow('Not authorized');
    });
  });

  describe('getMySubmission', () => {
    it('should return user submission', async () => {
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue({
        id: 1,
        assignmentId: 1,
        userId: 20,
        content: 'My work',
        status: 'submitted',
        assignment: { id: 1, title: 'Assignment', points: 100 },
      } as any);

      const result = await assignmentService.getMySubmission(1, 20);

      expect(result?.content).toBe('My work');
    });

    it('should return null if no submission exists', async () => {
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue(null);

      const result = await assignmentService.getMySubmission(1, 20);

      expect(result).toBeNull();
    });
  });

  describe('submitAssignment - edge cases', () => {
    const mockAssignment = {
      id: 1,
      title: 'Test Assignment',
      courseId: 1,
      isPublished: true,
      dueDate: null, // No due date
      points: 100,
      course: { id: 1, instructorId: 10 },
    };

    it('should submit assignment without due date', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1, userId: 20, courseId: 1 } as any);
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.assignmentSubmission.upsert).mockResolvedValue({
        id: 1,
        assignmentId: 1,
        userId: 20,
        content: 'My submission',
        status: 'submitted',
      } as any);

      const result = await assignmentService.submitAssignment(1, 20, { content: 'My submission' });

      expect(result.status).toBe('submitted');
    });

    it('should throw error if assignment not found', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null);

      await expect(assignmentService.submitAssignment(999, 20, { content: 'Test' })).rejects.toThrow(AppError);
      await expect(assignmentService.submitAssignment(999, 20, { content: 'Test' })).rejects.toThrow('Assignment not found');
    });

    it('should handle resubmission', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1, userId: 20, courseId: 1 } as any);
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue({
        id: 1,
        assignmentId: 1,
        userId: 20,
        content: 'Old submission',
      } as any);
      vi.mocked(prisma.assignmentSubmission.upsert).mockResolvedValue({
        id: 1,
        assignmentId: 1,
        userId: 20,
        content: 'Updated submission',
        status: 'submitted',
      } as any);

      const result = await assignmentService.submitAssignment(1, 20, { content: 'Updated submission' });

      expect(result.content).toBe('Updated submission');
    });
  });

  // ==========================================================================
  // Error handling - analytics and email failures
  // ==========================================================================

  describe('submitAssignment - analytics failure handling', () => {
    const mockAssignment = {
      id: 1,
      title: 'Test Assignment',
      courseId: 1,
      isPublished: true,
      dueDate: null,
      points: 100,
      course: { id: 1, instructorId: 10 },
    };

    it('should continue even when analytics logging fails', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1, userId: 20, courseId: 1 } as any);
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.assignmentSubmission.upsert).mockResolvedValue({
        id: 1,
        assignmentId: 1,
        userId: 20,
        content: 'My submission',
        status: 'submitted',
      } as any);
      vi.mocked(learningAnalyticsService.logAssessmentEvent).mockRejectedValue(new Error('Analytics failed'));

      // Should not throw, should complete submission despite analytics failure
      const result = await assignmentService.submitAssignment(1, 20, { content: 'My submission' });

      expect(result.status).toBe('submitted');
      expect(learningAnalyticsService.logAssessmentEvent).toHaveBeenCalled();
    });
  });

  describe('gradeSubmission - failure handling', () => {
    const mockSubmission = {
      id: 1,
      assignmentId: 1,
      userId: 20,
      content: 'My submission',
      status: 'submitted',
      grade: null,
      assignment: {
        id: 1,
        title: 'Assignment 1',
        points: 100,
        courseId: 1,
        course: { id: 1, instructorId: 10 },
      },
      user: { id: 20, fullname: 'Student', email: 'student@test.com' },
    };

    it('should continue when grade event logging fails', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue(mockSubmission as any);
      vi.mocked(prisma.assignmentSubmission.update).mockResolvedValue({
        ...mockSubmission,
        grade: 85,
        status: 'graded',
      } as any);
      vi.mocked(learningAnalyticsService.logAssessmentEvent).mockRejectedValue(new Error('Analytics failed'));
      vi.mocked(learningAnalyticsService.logSystemEvent).mockResolvedValue(undefined);

      const result = await assignmentService.gradeSubmission(1, 10, { grade: 85 });

      expect(result.grade).toBe(85);
    });

    it('should continue when system event logging fails', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue(mockSubmission as any);
      vi.mocked(prisma.assignmentSubmission.update).mockResolvedValue({
        ...mockSubmission,
        grade: 85,
        status: 'graded',
      } as any);
      vi.mocked(learningAnalyticsService.logAssessmentEvent).mockResolvedValue(undefined);
      vi.mocked(learningAnalyticsService.logSystemEvent).mockRejectedValue(new Error('System event failed'));

      const result = await assignmentService.gradeSubmission(1, 10, { grade: 85 });

      expect(result.grade).toBe(85);
    });

    it('should continue when email notification fails', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');
      const { emailService } = await import('./email.service.js');
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue(mockSubmission as any);
      vi.mocked(prisma.assignmentSubmission.update).mockResolvedValue({
        ...mockSubmission,
        grade: 85,
        status: 'graded',
      } as any);
      vi.mocked(learningAnalyticsService.logAssessmentEvent).mockResolvedValue(undefined);
      vi.mocked(learningAnalyticsService.logSystemEvent).mockResolvedValue(undefined);
      vi.mocked(emailService.sendGradeNotification).mockRejectedValue(new Error('Email failed'));

      const result = await assignmentService.gradeSubmission(1, 10, { grade: 85 });

      expect(result.grade).toBe(85);
      expect(emailService.sendGradeNotification).toHaveBeenCalled();
    });

    it('should include previous grade when regrading', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');
      const mockSubmissionWithGrade = {
        ...mockSubmission,
        grade: 70, // Previous grade
      };
      vi.mocked(prisma.assignmentSubmission.findUnique).mockResolvedValue(mockSubmissionWithGrade as any);
      vi.mocked(prisma.assignmentSubmission.update).mockResolvedValue({
        ...mockSubmissionWithGrade,
        grade: 85,
        status: 'graded',
      } as any);

      const result = await assignmentService.gradeSubmission(1, 10, { grade: 85 });

      expect(result.grade).toBe(85);
      // Verify analytics was called with previousGrade
      expect(learningAnalyticsService.logAssessmentEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          previousGrade: 70,
        })
      );
    });
  });

  // ===========================================================================
  // getStudentGradebook
  // ===========================================================================

  describe('getStudentGradebook', () => {
    const mockEnrollments = [
      {
        userId: 1,
        courseId: 10,
        status: 'active',
        course: { id: 10, title: 'Intro to Testing' },
      },
      {
        userId: 1,
        courseId: 20,
        status: 'active',
        course: { id: 20, title: 'Advanced Mocking' },
      },
    ];

    const mockAssignments = [
      { id: 101, courseId: 10, moduleId: 1, title: 'HW1', points: 100, dueDate: null, isPublished: true, aiAssisted: false, module: null },
      { id: 102, courseId: 10, moduleId: 1, title: 'HW2', points: 50,  dueDate: null, isPublished: true, aiAssisted: false, module: null },
      { id: 201, courseId: 20, moduleId: 2, title: 'Lab1', points: 75, dueDate: null, isPublished: true, aiAssisted: false, module: null },
    ];

    const mockSubmissions = [
      { assignmentId: 101, status: 'graded', grade: 90, submittedAt: new Date(), gradedAt: new Date(), feedback: 'Good work' },
      { assignmentId: 201, status: 'submitted', grade: null, submittedAt: new Date(), gradedAt: null, feedback: null },
    ];

    it('should return empty array when student has no active enrollments', async () => {
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue([]);

      const result = await assignmentService.getStudentGradebook(1);

      expect(result).toEqual([]);
      expect(prisma.assignment.findMany).not.toHaveBeenCalled();
    });

    it('should return courses grouped with their assignments', async () => {
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue(mockEnrollments as any);
      vi.mocked(prisma.assignment.findMany).mockResolvedValue(mockAssignments as any);
      vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue(mockSubmissions as any);

      const result = await assignmentService.getStudentGradebook(1);

      expect(result).toHaveLength(2);
      expect(result[0].courseId).toBe(10);
      expect(result[0].courseTitle).toBe('Intro to Testing');
      expect(result[0].assignments).toHaveLength(2);
      expect(result[1].courseId).toBe(20);
      expect(result[1].assignments).toHaveLength(1);
    });

    it('should attach submission data to matching assignments', async () => {
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue(mockEnrollments as any);
      vi.mocked(prisma.assignment.findMany).mockResolvedValue(mockAssignments as any);
      vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue(mockSubmissions as any);

      const result = await assignmentService.getStudentGradebook(1);

      const hw1 = result[0].assignments.find((a: any) => a.id === 101);
      expect(hw1.mySubmission).not.toBeNull();
      expect(hw1.mySubmission.grade).toBe(90);
      expect(hw1.mySubmission.status).toBe('graded');
    });

    it('should set mySubmission to null when no submission exists', async () => {
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue(mockEnrollments as any);
      vi.mocked(prisma.assignment.findMany).mockResolvedValue(mockAssignments as any);
      vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue(mockSubmissions as any);

      const result = await assignmentService.getStudentGradebook(1);

      const hw2 = result[0].assignments.find((a: any) => a.id === 102);
      expect(hw2.mySubmission).toBeNull();
    });

    it('should execute exactly 3 queries', async () => {
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue(mockEnrollments as any);
      vi.mocked(prisma.assignment.findMany).mockResolvedValue(mockAssignments as any);
      vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue(mockSubmissions as any);

      await assignmentService.getStudentGradebook(1);

      expect(prisma.enrollment.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.assignment.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.assignmentSubmission.findMany).toHaveBeenCalledTimes(1);
    });

    it('should query only active and completed enrollments', async () => {
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue(mockEnrollments as any);
      vi.mocked(prisma.assignment.findMany).mockResolvedValue([]);
      vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue([]);

      await assignmentService.getStudentGradebook(1);

      expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 1, status: { in: ['active', 'completed'] } },
        })
      );
    });

    it('should query only published assignments for enrolled courses', async () => {
      vi.mocked(prisma.enrollment.findMany).mockResolvedValue(mockEnrollments as any);
      vi.mocked(prisma.assignment.findMany).mockResolvedValue([]);
      vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue([]);

      await assignmentService.getStudentGradebook(1);

      expect(prisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            courseId: { in: [10, 20] },
            isPublished: true,
          },
        })
      );
    });
  });

  // ===========================================================================
  // Rich text (HTML) instructions support
  // ===========================================================================

  describe('HTML instructions support', () => {
    const mockCourse = {
      id: 1,
      title: 'Test Course',
      instructorId: 10,
    };

    it('should create assignment with HTML instructions', async () => {
      const htmlInstructions = '<h2>Step 1</h2><p>Write your <strong>essay</strong> about the topic.</p><ul><li>Use APA format</li><li>Minimum 500 words</li></ul>';
      const input = {
        title: 'Essay Assignment',
        description: 'Write an essay',
        instructions: htmlInstructions,
        points: 100,
        submissionType: 'text' as const,
      };

      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.assignment.create).mockResolvedValue({
        id: 1,
        ...input,
        courseId: 1,
        module: null,
      } as any);

      const result = await assignmentService.createAssignment(1, 10, input);

      expect(result.instructions).toBe(htmlInstructions);
      expect(prisma.assignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instructions: htmlInstructions,
          }),
        })
      );
    });

    it('should update assignment with HTML instructions', async () => {
      const htmlInstructions = '<p>Updated instructions with <em>rich text</em></p>';
      const mockAssignment = {
        id: 1,
        title: 'Test Assignment',
        courseId: 1,
        course: { id: 1, instructorId: 10 },
      };

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);
      vi.mocked(prisma.assignment.update).mockResolvedValue({
        ...mockAssignment,
        instructions: htmlInstructions,
      } as any);

      const result = await assignmentService.updateAssignment(1, 10, { instructions: htmlInstructions });

      expect(result.instructions).toBe(htmlInstructions);
    });

    it('should return HTML instructions via getAssignmentById', async () => {
      const htmlInstructions = '<ol><li>Read chapter 5</li><li>Answer questions</li></ol>';
      const mockAssignment = {
        id: 1,
        title: 'Reading Assignment',
        instructions: htmlInstructions,
        courseId: 1,
        course: { id: 1, title: 'Test Course', instructorId: 10 },
        module: null,
      };

      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);

      const result = await assignmentService.getAssignmentById(1);

      expect(result.instructions).toBe(htmlInstructions);
    });
  });

  describe('Assignment Attachments', () => {
    it('should get attachments for an assignment', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({ id: 1 } as any);
      const mockAttachments = [
        { id: 1, assignmentId: 1, fileName: 'data.csv', fileUrl: '/uploads/abc.csv', fileType: 'csv', fileSize: 1024, createdAt: new Date() },
        { id: 2, assignmentId: 1, fileName: 'image.png', fileUrl: '/uploads/def.png', fileType: 'png', fileSize: 2048, createdAt: new Date() },
      ];
      vi.mocked(prisma.assignmentAttachment.findMany).mockResolvedValue(mockAttachments as any);

      const result = await assignmentService.getAttachments(1);
      expect(result).toHaveLength(2);
      expect(result[0].fileName).toBe('data.csv');
    });

    it('should throw 404 when getting attachments for non-existent assignment', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(null);
      await expect(assignmentService.getAttachments(999)).rejects.toThrow(AppError);
    });

    it('should add an attachment to an assignment', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 1, course: { instructorId: 10 },
      } as any);
      const mockAttachment = { id: 1, assignmentId: 1, fileName: 'report.pdf', fileUrl: '/uploads/xyz.pdf', fileType: 'pdf', fileSize: 5000 };
      vi.mocked(prisma.assignmentAttachment.create).mockResolvedValue(mockAttachment as any);

      const result = await assignmentService.addAttachment(1, 10, {
        fileName: 'report.pdf', fileUrl: '/uploads/xyz.pdf', fileType: 'pdf', fileSize: 5000,
      });
      expect(result.fileName).toBe('report.pdf');
      expect(prisma.assignmentAttachment.create).toHaveBeenCalledWith({
        data: { assignmentId: 1, fileName: 'report.pdf', fileUrl: '/uploads/xyz.pdf', fileType: 'pdf', fileSize: 5000 },
      });
    });

    it('should reject adding attachment if not authorized', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue({
        id: 1, course: { instructorId: 10 },
      } as any);
      await expect(assignmentService.addAttachment(1, 99, {
        fileName: 'file.csv', fileUrl: '/uploads/a.csv', fileType: 'csv',
      })).rejects.toThrow('Not authorized');
    });

    it('should rename an attachment', async () => {
      vi.mocked(prisma.assignmentAttachment.findUnique).mockResolvedValue({
        id: 1, assignment: { course: { instructorId: 10 } },
      } as any);
      vi.mocked(prisma.assignmentAttachment.update).mockResolvedValue({
        id: 1, fileName: 'renamed.csv',
      } as any);

      const result = await assignmentService.updateAttachment(1, 10, { fileName: 'renamed.csv' });
      expect(result.fileName).toBe('renamed.csv');
    });

    it('should delete an attachment', async () => {
      vi.mocked(prisma.assignmentAttachment.findUnique).mockResolvedValue({
        id: 1, assignment: { course: { instructorId: 10 } },
      } as any);
      vi.mocked(prisma.assignmentAttachment.delete).mockResolvedValue({} as any);

      const result = await assignmentService.deleteAttachment(1, 10);
      expect(result.message).toBe('Attachment deleted successfully');
    });

    it('should throw 404 when deleting non-existent attachment', async () => {
      vi.mocked(prisma.assignmentAttachment.findUnique).mockResolvedValue(null);
      await expect(assignmentService.deleteAttachment(999, 10)).rejects.toThrow(AppError);
    });

    it('should include attachments in getAssignmentById', async () => {
      const mockAssignment = {
        id: 1, title: 'Test', courseId: 1,
        course: { id: 1, title: 'Course', instructorId: 10 },
        module: null,
        attachments: [
          { id: 1, fileName: 'data.xlsx', fileUrl: '/uploads/x.xlsx', fileType: 'xlsx', fileSize: 1000 },
        ],
      };
      vi.mocked(prisma.assignment.findUnique).mockResolvedValue(mockAssignment as any);

      const result = await assignmentService.getAssignmentById(1);
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].fileName).toBe('data.xlsx');
    });
  });
});
