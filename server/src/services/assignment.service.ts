import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateAssignmentInput, UpdateAssignmentInput, CreateSubmissionInput, GradeSubmissionInput } from '../utils/validation.js';
import { learningAnalyticsService } from './learningAnalytics.service.js';

// Context for event logging
export interface EventContext {
  actorId?: number;
  ipAddress?: string;
  sessionId?: string;
  deviceType?: string;
  browserName?: string;
}

export class AssignmentService {
  async getAssignments(courseId: number, userId?: number, isInstructor = false, isAdmin = false) {
    // Verify authorization: instructors/admins can access any course, students need enrollment
    if (userId && !isInstructor && !isAdmin) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId },
        },
      });

      if (!enrollment) {
        throw new AppError('You must be enrolled in this course to view assignments', 403);
      }
    }

    const where: any = { courseId };

    if (!isInstructor && !isAdmin) {
      where.isPublished = true;
    }

    const assignments = await prisma.assignment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        module: {
          select: { id: true, title: true },
        },
        _count: {
          select: { submissions: true },
        },
      },
    });

    // If student, include their submission status
    if (userId && !isInstructor && !isAdmin) {
      const submissions = await prisma.assignmentSubmission.findMany({
        where: {
          userId,
          assignmentId: { in: assignments.map(a => a.id) },
        },
        select: {
          assignmentId: true,
          status: true,
          grade: true,
          submittedAt: true,
        },
      });

      const submissionMap = new Map(submissions.map(s => [s.assignmentId, s]));

      return assignments.map(a => ({
        ...a,
        mySubmission: submissionMap.get(a.id) || null,
      }));
    }

    return assignments;
  }

  async getAssignmentById(assignmentId: number, userId?: number) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        course: {
          select: { id: true, title: true, instructorId: true },
        },
        module: {
          select: { id: true, title: true },
        },
      },
    });

    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }

    // Include user's submission if they have one
    if (userId) {
      const submission = await prisma.assignmentSubmission.findUnique({
        where: {
          assignmentId_userId: { assignmentId, userId },
        },
      });

      return { ...assignment, mySubmission: submission };
    }

    return assignment;
  }

  async createAssignment(courseId: number, instructorId: number, data: CreateAssignmentInput, isAdmin = false) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const assignment = await prisma.assignment.create({
      data: {
        ...data,
        courseId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
      include: {
        module: {
          select: { id: true, title: true },
        },
      },
    });

    return assignment;
  }

  async updateAssignment(assignmentId: number, instructorId: number, data: UpdateAssignmentInput, isAdmin = false) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { course: true },
    });

    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }

    if (assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const updated = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });

    return updated;
  }

  async deleteAssignment(assignmentId: number, instructorId: number, isAdmin = false) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { course: true },
    });

    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }

    if (assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    await prisma.assignment.delete({
      where: { id: assignmentId },
    });

    return { message: 'Assignment deleted successfully' };
  }

  // Submission methods
  async getSubmissions(assignmentId: number, instructorId: number, isAdmin = false) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { course: true },
    });

    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }

    if (assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      include: {
        user: {
          select: { id: true, fullname: true, email: true },
        },
        gradedBy: {
          select: { id: true, fullname: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return submissions;
  }

  async submitAssignment(assignmentId: number, userId: number, data: CreateSubmissionInput, context?: EventContext) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { course: true },
    });

    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }

    if (!assignment.isPublished) {
      throw new AppError('Assignment is not available', 400);
    }

    // Check enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId: assignment.courseId },
      },
    });

    if (!enrollment) {
      throw new AppError('You must be enrolled to submit', 403);
    }

    // Check due date
    if (assignment.dueDate && new Date() > assignment.dueDate) {
      throw new AppError('Assignment due date has passed', 400);
    }

    // Check for existing submission to get attempt number
    const existingSubmission = await prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_userId: { assignmentId, userId },
      },
    });
    const attemptNumber = existingSubmission ? 2 : 1; // Simplified attempt tracking

    // Upsert submission
    const submission = await prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_userId: { assignmentId, userId },
      },
      create: {
        assignmentId,
        userId,
        content: data.content,
        fileUrls: data.fileUrls ? JSON.stringify(data.fileUrls) : null,
        status: data.status || 'submitted',
      },
      update: {
        content: data.content,
        fileUrls: data.fileUrls ? JSON.stringify(data.fileUrls) : undefined,
        status: data.status || 'submitted',
        submittedAt: new Date(),
      },
    });

    // Log assessment submission event
    try {
      await learningAnalyticsService.logAssessmentEvent({
        userId,
        sessionId: context?.sessionId,
        courseId: assignment.courseId,
        assignmentId,
        submissionId: submission.id,
        eventType: 'assignment_submit',
        maxPoints: assignment.points,
        attemptNumber,
        deviceType: context?.deviceType,
        browserName: context?.browserName,
      }, context?.ipAddress);
    } catch (error) {
      console.error('Failed to log assignment submit event:', error);
    }

    return submission;
  }

  async getMySubmission(assignmentId: number, userId: number) {
    const submission = await prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_userId: { assignmentId, userId },
      },
      include: {
        assignment: {
          select: { id: true, title: true, points: true },
        },
        gradedBy: {
          select: { id: true, fullname: true },
        },
      },
    });

    return submission;
  }

  async gradeSubmission(submissionId: number, instructorId: number, data: GradeSubmissionInput, isAdmin = false, context?: EventContext) {
    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: { course: true },
        },
        user: {
          select: { id: true, fullname: true, email: true },
        },
      },
    });

    if (!submission) {
      throw new AppError('Submission not found', 404);
    }

    if (submission.assignment.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const previousGrade = submission.grade;

    const updated = await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        grade: data.grade,
        feedback: data.feedback,
        gradedAt: new Date(),
        gradedById: instructorId,
        status: 'graded',
      },
      include: {
        user: {
          select: { id: true, fullname: true, email: true },
        },
      },
    });

    // Log grade event for the student
    try {
      await learningAnalyticsService.logAssessmentEvent({
        userId: submission.userId,
        courseId: submission.assignment.courseId,
        assignmentId: submission.assignmentId,
        submissionId: submission.id,
        eventType: 'grade_received',
        grade: data.grade,
        maxPoints: submission.assignment.points,
        previousGrade: previousGrade ?? undefined,
        feedbackLength: data.feedback?.length,
      });
    } catch (error) {
      console.error('Failed to log grade event:', error);
    }

    // Log grading action as a system event
    try {
      await learningAnalyticsService.logSystemEvent({
        actorId: instructorId,
        eventType: 'assignment_grade',
        eventCategory: 'grading',
        changeType: 'update',
        targetType: 'assignment',
        targetId: submission.assignmentId,
        targetTitle: submission.assignment.title,
        courseId: submission.assignment.courseId,
        targetUserId: submission.userId,
        previousValues: previousGrade !== null ? { grade: previousGrade } : undefined,
        newValues: { grade: data.grade, feedback: data.feedback },
      }, context?.ipAddress);
    } catch (error) {
      console.error('Failed to log grading system event:', error);
    }

    return updated;
  }

  async getCourseGradebook(courseId: number, instructorId: number, isAdmin = false) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const [assignments, enrollments] = await Promise.all([
      prisma.assignment.findMany({
        where: { courseId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, title: true, points: true },
      }),
      prisma.enrollment.findMany({
        where: { courseId },
        include: {
          user: {
            select: { id: true, fullname: true, email: true },
          },
        },
      }),
    ]);

    const submissions = await prisma.assignmentSubmission.findMany({
      where: {
        assignmentId: { in: assignments.map(a => a.id) },
      },
      select: {
        assignmentId: true,
        userId: true,
        grade: true,
        status: true,
      },
    });

    // Build gradebook
    const submissionMap = new Map<string, { grade: number | null; status: string }>();
    submissions.forEach(s => {
      submissionMap.set(`${s.userId}-${s.assignmentId}`, {
        grade: s.grade,
        status: s.status,
      });
    });

    const gradebook = enrollments.map(enrollment => ({
      student: enrollment.user,
      grades: assignments.map(assignment => {
        const key = `${enrollment.userId}-${assignment.id}`;
        const submission = submissionMap.get(key);
        return {
          assignmentId: assignment.id,
          grade: submission?.grade ?? null,
          status: submission?.status ?? 'not_submitted',
        };
      }),
      totalPoints: assignments.reduce((sum, a, i) => {
        const key = `${enrollment.userId}-${a.id}`;
        const submission = submissionMap.get(key);
        return sum + (submission?.grade ?? 0);
      }, 0),
      maxPoints: assignments.reduce((sum, a) => sum + a.points, 0),
    }));

    return {
      assignments,
      gradebook,
    };
  }
}

export const assignmentService = new AssignmentService();
