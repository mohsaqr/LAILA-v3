import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { learningAnalyticsService } from './learningAnalytics.service.js';

// Context for event logging
export interface EventContext {
  actorId?: number;
  ipAddress?: string;
}

export class EnrollmentService {
  /**
   * Get enrollments for a user. Admins and instructors get all published courses as virtual enrollments.
   */
  async getMyEnrollments(userId: number) {
    // Check if user is admin or instructor
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, isInstructor: true },
    });

    if (user?.isAdmin || user?.isInstructor) {
      // Admins and instructors see all published courses as virtual enrollments
      const courses = await prisma.course.findMany({
        where: { status: 'published' },
        include: {
          instructor: {
            select: { id: true, fullname: true },
          },
          _count: {
            select: { modules: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      // Return as virtual enrollments (admin/instructor can access all)
      return courses.map(course => ({
        id: -course.id, // Negative ID indicates virtual enrollment
        userId,
        courseId: course.id,
        status: 'active' as const,
        progress: 0,
        enrolledAt: course.createdAt,
        completedAt: null,
        lastAccessAt: new Date(),
        isVirtualEnrollment: true, // Flag to indicate admin/instructor access
        course,
      }));
    }

    // Regular users get their actual enrollments
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

  /**
   * Get enrollment for a user and course. Admins and instructors get virtual enrollment for any course.
   */
  async getEnrollment(userId: number, courseId: number) {
    // Check if user is admin or instructor
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, isInstructor: true },
    });

    if (user?.isAdmin || user?.isInstructor) {
      // Admins and instructors can access any published course without enrollment
      const course = await prisma.course.findUnique({
        where: { id: courseId },
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
              codeLabs: {
                where: { isPublished: true },
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
      });

      if (!course) {
        return null;
      }

      // Return virtual enrollment for admin
      return {
        id: -course.id,
        userId,
        courseId: course.id,
        status: 'active' as const,
        progress: 0,
        enrolledAt: course.createdAt,
        completedAt: null,
        lastAccessAt: new Date(),
        isVirtualEnrollment: true,
        course,
        lectureProgress: [], // Admin doesn't have progress tracking
      };
    }

    // Regular users need actual enrollment
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
                codeLabs: {
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
    // Check if user is admin or instructor - they cannot enroll as students
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, isInstructor: true },
    });

    if (user?.isAdmin || user?.isInstructor) {
      throw new AppError('Admins and instructors cannot enroll as students. Use "View As" mode to test student experience.', 403);
    }

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
    // Check if user is admin or instructor - they don't track progress
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, isInstructor: true },
    });

    if (user?.isAdmin || user?.isInstructor) {
      // Admins and instructors can view but don't track progress
      return { message: 'Viewing as admin/instructor - progress not tracked' };
    }

    // Verify enrollment for regular users
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
    // Check if user is admin or instructor - they don't track time
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, isInstructor: true },
    });

    if (user?.isAdmin || user?.isInstructor) {
      // Admins and instructors can view but don't track time
      return { message: 'Viewing as admin/instructor - time not tracked' };
    }

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
    // Check if user is admin or instructor
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, isInstructor: true },
    });

    if (user?.isAdmin || user?.isInstructor) {
      // Admins and instructors get virtual progress (no tracking)
      const course = await prisma.course.findUnique({
        where: { id: courseId },
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
      });

      if (!course) {
        throw new AppError('Course not found', 404);
      }

      // Return mock progress for admin
      const moduleProgress = course.modules.map(module => ({
        moduleId: module.id,
        title: module.title,
        lectures: module.lectures.map(lecture => ({
          lectureId: lecture.id,
          title: lecture.title,
          isCompleted: false, // Admin doesn't track completion
        })),
        completedCount: 0,
        totalCount: module.lectures.length,
      }));

      return {
        enrollmentId: -courseId, // Virtual enrollment ID
        courseId,
        progress: 0,
        status: 'active' as const,
        enrolledAt: course.createdAt,
        completedAt: null,
        lastAccessAt: new Date(),
        moduleProgress,
        isVirtualEnrollment: true,
      };
    }

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
