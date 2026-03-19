import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateAssignmentInput, UpdateAssignmentInput, CreateSubmissionInput, GradeSubmissionInput } from '../utils/validation.js';
import { learningAnalyticsService } from './learningAnalytics.service.js';
import { emailService } from './email.service.js';
import { notificationService } from './notification.service.js';
import { assignmentLogger } from '../utils/logger.js';
import { courseRoleService } from './courseRole.service.js';

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
      const isTeam = await courseRoleService.isTeamMember(userId, courseId);
      if (!isTeam) {
        const enrollment = await prisma.enrollment.findUnique({
          where: {
            userId_courseId: { userId, courseId },
          },
        });

        if (!enrollment) {
          throw new AppError('You must be enrolled in this course to view assignments', 403);
        }
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
        attachments: {
          orderBy: { createdAt: 'asc' },
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
      const isTeam = await courseRoleService.isTeamMember(instructorId, courseId);
      if (!isTeam) {
        throw new AppError('Not authorized', 403);
      }
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
      const isTeam = await courseRoleService.isTeamMember(instructorId, assignment.course.id);
      if (!isTeam) {
        throw new AppError('Not authorized', 403);
      }
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
      const isTeam = await courseRoleService.isTeamMember(instructorId, assignment.course.id);
      if (!isTeam) {
        throw new AppError('Not authorized', 403);
      }
    }

    await prisma.assignment.delete({
      where: { id: assignmentId },
    });

    return { message: 'Assignment deleted successfully' };
  }

  // Attachment methods
  async getAttachments(assignmentId: number) {
    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new AppError('Assignment not found', 404);

    return prisma.assignmentAttachment.findMany({
      where: { assignmentId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addAttachment(assignmentId: number, instructorId: number, data: { fileName: string; fileUrl: string; fileType: string; fileSize?: number }, isAdmin = false) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { course: true },
    });
    if (!assignment) throw new AppError('Assignment not found', 404);
    if (assignment.course.instructorId !== instructorId && !isAdmin) {
      const isTeam = await courseRoleService.isTeamMember(instructorId, assignment.course.id);
      if (!isTeam) throw new AppError('Not authorized', 403);
    }

    return prisma.assignmentAttachment.create({
      data: {
        assignmentId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: data.fileSize || null,
      },
    });
  }

  async updateAttachment(attachmentId: number, instructorId: number, data: { fileName: string }, isAdmin = false) {
    const attachment = await prisma.assignmentAttachment.findUnique({
      where: { id: attachmentId },
      include: { assignment: { include: { course: true } } },
    });
    if (!attachment) throw new AppError('Attachment not found', 404);
    if (attachment.assignment.course.instructorId !== instructorId && !isAdmin) {
      const isTeam = await courseRoleService.isTeamMember(instructorId, attachment.assignment.course.id);
      if (!isTeam) throw new AppError('Not authorized', 403);
    }

    return prisma.assignmentAttachment.update({
      where: { id: attachmentId },
      data: { fileName: data.fileName },
    });
  }

  async deleteAttachment(attachmentId: number, instructorId: number, isAdmin = false) {
    const attachment = await prisma.assignmentAttachment.findUnique({
      where: { id: attachmentId },
      include: { assignment: { include: { course: true } } },
    });
    if (!attachment) throw new AppError('Attachment not found', 404);
    if (attachment.assignment.course.instructorId !== instructorId && !isAdmin) {
      const isTeam = await courseRoleService.isTeamMember(instructorId, attachment.assignment.course.id);
      if (!isTeam) throw new AppError('Not authorized', 403);
    }

    await prisma.assignmentAttachment.delete({ where: { id: attachmentId } });
    return { message: 'Attachment deleted successfully' };
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
      const isTeam = await courseRoleService.isTeamMember(instructorId, assignment.course.id);
      if (!isTeam) {
        throw new AppError('Not authorized', 403);
      }
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

  async getSubmissionById(submissionId: number, instructorId: number, isAdmin = false) {
    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        user: {
          select: { id: true, fullname: true, email: true },
        },
        gradedBy: {
          select: { id: true, fullname: true },
        },
        assignment: {
          include: { course: { select: { id: true, title: true, instructorId: true } } },
        },
      },
    });

    if (!submission) {
      throw new AppError('Submission not found', 404);
    }

    if (submission.assignment.course.instructorId !== instructorId && !isAdmin) {
      const isTeam = await courseRoleService.isTeamMember(instructorId, submission.assignment.course.id);
      if (!isTeam) {
        throw new AppError('Not authorized', 403);
      }
    }

    return submission;
  }

  async submitAssignment(assignmentId: number, userId: number, data: CreateSubmissionInput, context?: EventContext, isAdmin = false, isInstructor = false) {
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

    // AI agent assignments must be submitted through the agent-specific endpoint
    if (assignment.submissionType === 'ai_agent') {
      throw new AppError('AI agent assignments must be submitted through the agent builder', 400);
    }

    // Admins bypass all checks; instructors bypass only for their own course
    const isOwnCourse = isInstructor && assignment.course.instructorId === userId;
    const canBypass = isAdmin || isOwnCourse;

    // Check enrollment
    if (!canBypass) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId: assignment.courseId },
        },
      });

      if (!enrollment) {
        throw new AppError('You must be enrolled to submit', 403);
      }
    }

    // Check due date
    if (!canBypass && assignment.dueDate && new Date() > assignment.dueDate) {
      throw new AppError('Assignment due date has passed', 400);
    }

    // Check for existing submission to get attempt number
    const existingSubmission = await prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_userId: { assignmentId, userId },
      },
    });
    const effectiveStatus = data.status || 'submitted';
    const attemptNumber = existingSubmission && existingSubmission.status !== 'draft' ? 2 : 1;

    // Prevent overwriting graded submissions (admin can bypass)
    if (!isAdmin && existingSubmission?.status === 'graded') {
      throw new AppError('This submission has already been graded and cannot be modified', 400);
    }

    // Prevent resubmission of already-submitted work (draft saves are still allowed)
    if (!canBypass && existingSubmission?.status === 'submitted') {
      throw new AppError('Assignment has already been submitted', 400);
    }

    // Upsert submission
    const submittedAt = effectiveStatus !== 'draft' ? new Date() : null;
    const submission = await prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_userId: { assignmentId, userId },
      },
      create: {
        assignmentId,
        userId,
        content: data.content,
        fileUrls: data.fileUrls ? JSON.stringify(data.fileUrls) : null,
        status: effectiveStatus,
        submittedAt,
      },
      update: {
        content: data.content,
        fileUrls: data.fileUrls ? JSON.stringify(data.fileUrls) : undefined,
        status: effectiveStatus,
        ...(effectiveStatus !== 'draft' ? { submittedAt } : {}),
      },
    });

    // Log assessment submission event (only for actual submissions, not drafts)
    if (effectiveStatus !== 'draft') {
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
      assignmentLogger.warn({ err: error, userId, assignmentId }, 'Failed to log assignment submit event');
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
      const isTeam = await courseRoleService.isTeamMember(instructorId, submission.assignment.course.id);
      if (!isTeam) {
        throw new AppError('Not authorized', 403);
      }
    }

    if (data.grade > submission.assignment.points) {
      throw new AppError(`Grade cannot exceed ${submission.assignment.points} points`, 400);
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
      assignmentLogger.warn({ err: error, submissionId }, 'Failed to log grade event');
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
      assignmentLogger.warn({ err: error, submissionId, instructorId }, 'Failed to log grading system event');
    }

    // Send grade notification email (non-blocking)
    emailService.sendGradeNotification(
      submission.userId,
      submission.assignment.courseId,
      submission.assignment.title,
      data.grade,
      submission.assignment.points
    ).catch((err) => {
      assignmentLogger.warn({ err, submissionId }, 'Failed to send grade notification');
    });

    // Send in-app notification (non-blocking)
    notificationService.notifyGradePosted({
      userId: submission.userId,
      courseId: submission.assignment.courseId,
      courseName: submission.assignment.course.title,
      assignmentTitle: submission.assignment.title,
      score: data.grade,
      maxScore: submission.assignment.points,
    }).catch((err) => {
      assignmentLogger.warn({ err, submissionId }, 'Failed to send grade in-app notification');
    });

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
      const isTeam = await courseRoleService.isTeamMember(instructorId, courseId);
      if (!isTeam) {
        throw new AppError('Not authorized', 403);
      }
    }

    const [assignments, enrollments] = await Promise.all([
      prisma.assignment.findMany({
        where: { courseId, isPublished: true },
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
        id: true,
        assignmentId: true,
        userId: true,
        grade: true,
        status: true,
        feedback: true,
      },
    });

    // Build gradebook
    const submissionMap = new Map<string, { id: number; grade: number | null; status: string; feedback: string | null }>();
    submissions.forEach(s => {
      submissionMap.set(`${s.userId}-${s.assignmentId}`, {
        id: s.id,
        grade: s.grade,
        status: s.status,
        feedback: s.feedback,
      });
    });

    const gradebook = enrollments.map(enrollment => ({
      student: enrollment.user,
      grades: assignments.map(assignment => {
        const key = `${enrollment.userId}-${assignment.id}`;
        const submission = submissionMap.get(key);
        return {
          assignmentId: assignment.id,
          submissionId: submission?.id ?? null,
          grade: submission?.grade ?? null,
          status: submission?.status ?? 'not_submitted',
          feedback: submission?.feedback ?? null,
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

  /**
   * Get all assignments with submission status for every course the student is enrolled in.
   * Executes exactly 3 queries regardless of enrollment count.
   */
  async getStudentGradebook(userId: number) {
    // 1. All active or completed enrollments with course title
    const enrollments = await prisma.enrollment.findMany({
      where: { userId, status: { in: ['active', 'completed'] } },
      include: {
        course: { select: { id: true, title: true } },
      },
    });

    if (enrollments.length === 0) return [];

    const courseIds = enrollments.map(e => e.courseId);

    // 2. All published assignments across those courses
    const assignments = await prisma.assignment.findMany({
      where: { courseId: { in: courseIds }, isPublished: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        courseId: true,
        moduleId: true,
        title: true,
        points: true,
        dueDate: true,
        isPublished: true,
        aiAssisted: true,
        module: { select: { id: true, title: true } },
      },
    });

    // 3. All submissions by this student for those assignments
    const assignmentIds = assignments.map(a => a.id);
    const submissions = assignmentIds.length > 0
      ? await prisma.assignmentSubmission.findMany({
          where: { userId, assignmentId: { in: assignmentIds } },
          select: {
            assignmentId: true,
            status: true,
            grade: true,
            submittedAt: true,
            gradedAt: true,
            feedback: true,
          },
        })
      : [];

    const submissionMap = new Map(submissions.map(s => [s.assignmentId, s]));

    // Group assignments by course, preserving enrollment order
    const courseMap = new Map<number, { courseId: number; courseTitle: string; assignments: any[] }>();
    for (const enrollment of enrollments) {
      courseMap.set(enrollment.courseId, {
        courseId: enrollment.courseId,
        courseTitle: enrollment.course.title,
        assignments: [],
      });
    }

    for (const assignment of assignments) {
      const course = courseMap.get(assignment.courseId);
      if (course) {
        course.assignments.push({
          ...assignment,
          mySubmission: submissionMap.get(assignment.id) ?? null,
        });
      }
    }

    return Array.from(courseMap.values());
  }
}

export const assignmentService = new AssignmentService();
