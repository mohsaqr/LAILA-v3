import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { learningAnalyticsService } from './learningAnalytics.service.js';

// Context for event logging
export interface EventContext {
  actorId?: number;
  ipAddress?: string;
}

export class EnrollmentService {
  async getMyEnrollments(userId: number) {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            instructor: {
              select: { id: true, fullname: true },
            },
            _count: {
              select: { modules: true },
            },
          },
        },
      },
      orderBy: { lastAccessAt: 'desc' },
    });

    return enrollments;
  }

  async getEnrollment(userId: number, courseId: number) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
      include: {
        course: {
          include: {
            instructor: {
              select: { id: true, fullname: true },
            },
            modules: {
              where: { isPublished: true },
              orderBy: { orderIndex: 'asc' },
              include: {
                lectures: {
                  where: { isPublished: true },
                  orderBy: { orderIndex: 'asc' },
                },
              },
            },
          },
        },
        lectureProgress: true,
      },
    });

    return enrollment;
  }

  async enroll(userId: number, courseId: number, context?: EventContext) {
    // Check if course exists and is published
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (course.status !== 'published') {
      throw new AppError('Course is not available for enrollment', 400);
    }

    // Check if already enrolled
    const existing = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (existing) {
      throw new AppError('Already enrolled in this course', 400);
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        userId,
        courseId,
      },
      include: {
        course: {
          select: { id: true, title: true, slug: true },
        },
        user: {
          select: { id: true, fullname: true, email: true },
        },
      },
    });

    // Log enrollment event
    try {
      await learningAnalyticsService.logSystemEvent({
        actorId: context?.actorId || userId,
        eventType: 'enrollment_create',
        eventCategory: 'enrollment',
        changeType: 'create',
        targetType: 'enrollment',
        targetId: enrollment.id,
        targetTitle: course.title,
        courseId,
        targetUserId: userId,
        newValues: { courseId, userId, status: 'active' },
      }, context?.ipAddress);
    } catch (error) {
      console.error('Failed to log enrollment event:', error);
    }

    return enrollment;
  }

  async unenroll(userId: number, courseId: number, context?: EventContext) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
      include: {
        course: {
          select: { id: true, title: true },
        },
      },
    });

    if (!enrollment) {
      throw new AppError('Not enrolled in this course', 404);
    }

    await prisma.enrollment.delete({
      where: { id: enrollment.id },
    });

    // Log unenrollment event
    try {
      await learningAnalyticsService.logSystemEvent({
        actorId: context?.actorId || userId,
        eventType: 'enrollment_remove',
        eventCategory: 'enrollment',
        changeType: 'delete',
        targetType: 'enrollment',
        targetId: enrollment.id,
        targetTitle: enrollment.course.title,
        courseId,
        targetUserId: userId,
        previousValues: { courseId, userId, status: enrollment.status, progress: enrollment.progress },
      }, context?.ipAddress);
    } catch (error) {
      console.error('Failed to log unenrollment event:', error);
    }

    return { message: 'Successfully unenrolled from course' };
  }

  async markLectureComplete(userId: number, courseId: number, lectureId: number) {
    // Verify enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (!enrollment) {
      throw new AppError('Not enrolled in this course', 403);
    }

    // Verify lecture belongs to course
    const lecture = await prisma.lecture.findUnique({
      where: { id: lectureId },
      include: {
        module: {
          select: { courseId: true },
        },
      },
    });

    if (!lecture || lecture.module.courseId !== courseId) {
      throw new AppError('Lecture not found in this course', 404);
    }

    // Create or update progress
    const progress = await prisma.lectureProgress.upsert({
      where: {
        enrollmentId_lectureId: {
          enrollmentId: enrollment.id,
          lectureId,
        },
      },
      create: {
        enrollmentId: enrollment.id,
        lectureId,
        isCompleted: true,
        completedAt: new Date(),
      },
      update: {
        isCompleted: true,
        completedAt: new Date(),
      },
    });

    // Update enrollment progress and last access
    await this.updateEnrollmentProgress(enrollment.id);

    return progress;
  }

  async updateLectureTime(userId: number, courseId: number, lectureId: number, timeSpent: number) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (!enrollment) {
      throw new AppError('Not enrolled in this course', 403);
    }

    const progress = await prisma.lectureProgress.upsert({
      where: {
        enrollmentId_lectureId: {
          enrollmentId: enrollment.id,
          lectureId,
        },
      },
      create: {
        enrollmentId: enrollment.id,
        lectureId,
        timeSpent,
      },
      update: {
        timeSpent: {
          increment: timeSpent,
        },
      },
    });

    // Update last access
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { lastAccessAt: new Date() },
    });

    return progress;
  }

  private async updateEnrollmentProgress(enrollmentId: number) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        course: {
          include: {
            modules: {
              where: { isPublished: true },
              include: {
                lectures: {
                  where: { isPublished: true },
                },
              },
            },
          },
        },
        lectureProgress: {
          where: { isCompleted: true },
        },
      },
    });

    if (!enrollment) return;

    // Count total lectures
    const totalLectures = enrollment.course.modules.reduce(
      (sum, module) => sum + module.lectures.length,
      0
    );

    if (totalLectures === 0) return;

    // Calculate progress
    const completedLectures = enrollment.lectureProgress.length;
    const progress = Math.round((completedLectures / totalLectures) * 100);

    // Update enrollment
    const updateData: any = {
      progress,
      lastAccessAt: new Date(),
    };

    if (progress === 100) {
      updateData.status = 'completed';
      updateData.completedAt = new Date();
    }

    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: updateData,
    });
  }

  async getProgress(userId: number, courseId: number) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
      include: {
        lectureProgress: {
          include: {
            lecture: {
              select: { id: true, title: true, moduleId: true },
            },
          },
        },
        course: {
          include: {
            modules: {
              where: { isPublished: true },
              orderBy: { orderIndex: 'asc' },
              include: {
                lectures: {
                  where: { isPublished: true },
                  orderBy: { orderIndex: 'asc' },
                  select: { id: true, title: true },
                },
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw new AppError('Not enrolled in this course', 404);
    }

    // Build progress map
    const completedLectureIds = new Set(
      enrollment.lectureProgress
        .filter(p => p.isCompleted)
        .map(p => p.lectureId)
    );

    const moduleProgress = enrollment.course.modules.map(module => ({
      moduleId: module.id,
      title: module.title,
      lectures: module.lectures.map(lecture => ({
        lectureId: lecture.id,
        title: lecture.title,
        isCompleted: completedLectureIds.has(lecture.id),
      })),
      completedCount: module.lectures.filter(l => completedLectureIds.has(l.id)).length,
      totalCount: module.lectures.length,
    }));

    return {
      enrollmentId: enrollment.id,
      courseId,
      progress: enrollment.progress,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      lastAccessAt: enrollment.lastAccessAt,
      moduleProgress,
    };
  }
}

export const enrollmentService = new EnrollmentService();
