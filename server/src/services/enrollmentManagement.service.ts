import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { adminAuditService } from './adminAudit.service.js';

export interface EnrollmentFilters {
  courseId?: number;
  userId?: number;
  status?: string;
  search?: string;
}

export interface AuditContext {
  adminId: number;
  adminEmail?: string;
  ipAddress?: string;
}

export class EnrollmentManagementService {
  async getEnrollments(
    page = 1,
    limit = 20,
    filters?: EnrollmentFilters
  ) {
    const where: any = {};

    if (filters?.courseId) {
      where.courseId = filters.courseId;
    }
    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.search) {
      where.OR = [
        { user: { fullname: { contains: filters.search } } },
        { user: { email: { contains: filters.search } } },
        { course: { title: { contains: filters.search } } },
      ];
    }

    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullname: true,
              email: true,
            },
          },
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              instructor: {
                select: { id: true, fullname: true },
              },
            },
          },
        },
        orderBy: { enrolledAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.enrollment.count({ where }),
    ]);

    return {
      enrollments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createEnrollment(
    userId: number,
    courseId: number,
    context: AuditContext
  ) {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    // Check if already enrolled
    const existing = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (existing) {
      throw new AppError('User is already enrolled in this course', 400);
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        userId,
        courseId,
      },
      include: {
        user: {
          select: { id: true, fullname: true, email: true },
        },
        course: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    // Create audit log
    await adminAuditService.log({
      adminId: context.adminId,
      adminEmail: context.adminEmail,
      action: 'enrollment_add',
      targetType: 'enrollment',
      targetId: enrollment.id,
      newValues: {
        userId,
        courseId,
        courseTitle: course.title,
        userEmail: user.email,
      },
      ipAddress: context.ipAddress,
    });

    return enrollment;
  }

  async deleteEnrollment(enrollmentId: number, context: AuditContext) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        user: {
          select: { id: true, fullname: true, email: true },
        },
        course: {
          select: { id: true, title: true },
        },
      },
    });

    if (!enrollment) {
      throw new AppError('Enrollment not found', 404);
    }

    const previousValues = {
      id: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      courseTitle: enrollment.course.title,
      userEmail: enrollment.user.email,
      status: enrollment.status,
      progress: enrollment.progress,
    };

    await prisma.enrollment.delete({
      where: { id: enrollmentId },
    });

    // Create audit log
    await adminAuditService.log({
      adminId: context.adminId,
      adminEmail: context.adminEmail,
      action: 'enrollment_remove',
      targetType: 'enrollment',
      targetId: enrollmentId,
      previousValues,
      ipAddress: context.ipAddress,
    });

    return { message: 'Enrollment removed successfully' };
  }

  // Course-specific enrollment management
  async getCourseEnrollments(
    courseId: number,
    page = 1,
    limit = 20,
    search?: string
  ) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    const where: any = { courseId };

    if (search) {
      where.user = {
        OR: [
          { fullname: { contains: search } },
          { email: { contains: search } },
        ],
      };
    }

    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullname: true,
              email: true,
            },
          },
        },
        orderBy: { enrolledAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.enrollment.count({ where }),
    ]);

    return {
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
      },
      enrollments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addUserToCourse(
    courseId: number,
    userEmail: string,
    context: AuditContext
  ) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if already enrolled
    const existing = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId: user.id, courseId },
      },
    });

    if (existing) {
      throw new AppError('User is already enrolled in this course', 400);
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        userId: user.id,
        courseId,
      },
      include: {
        user: {
          select: { id: true, fullname: true, email: true },
        },
        course: {
          select: { id: true, title: true },
        },
      },
    });

    // Create audit log
    await adminAuditService.log({
      adminId: context.adminId,
      adminEmail: context.adminEmail,
      action: 'enrollment_add',
      targetType: 'enrollment',
      targetId: enrollment.id,
      newValues: {
        userId: user.id,
        courseId,
        courseTitle: course.title,
        userEmail: user.email,
      },
      ipAddress: context.ipAddress,
    });

    return enrollment;
  }

  async removeUserFromCourse(
    courseId: number,
    userId: number,
    context: AuditContext
  ) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
      include: {
        user: {
          select: { id: true, fullname: true, email: true },
        },
        course: {
          select: { id: true, title: true },
        },
      },
    });

    if (!enrollment) {
      throw new AppError('Enrollment not found', 404);
    }

    const previousValues = {
      id: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      courseTitle: enrollment.course.title,
      userEmail: enrollment.user.email,
      status: enrollment.status,
      progress: enrollment.progress,
    };

    await prisma.enrollment.delete({
      where: { id: enrollment.id },
    });

    // Create audit log
    await adminAuditService.log({
      adminId: context.adminId,
      adminEmail: context.adminEmail,
      action: 'enrollment_remove',
      targetType: 'enrollment',
      targetId: enrollment.id,
      previousValues,
      ipAddress: context.ipAddress,
    });

    return { message: 'User removed from course successfully' };
  }

  // Check if user has instructor access to a course
  async hasInstructorAccess(userId: number, courseId: number) {
    // Check if user is the course instructor
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return false;
    }

    if (course.instructorId === userId) {
      return true;
    }

    // Check if user has a course role with manage_students permission
    const courseRole = await prisma.courseRole.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (courseRole) {
      const permissions = courseRole.permissions ? JSON.parse(courseRole.permissions) : [];
      if (permissions.includes('manage_students')) {
        return true;
      }
    }

    return false;
  }

  // Get enrollment statistics
  async getEnrollmentStats() {
    const [
      totalEnrollments,
      activeEnrollments,
      completedEnrollments,
      recentEnrollments,
    ] = await Promise.all([
      prisma.enrollment.count(),
      prisma.enrollment.count({ where: { status: 'active' } }),
      prisma.enrollment.count({ where: { status: 'completed' } }),
      prisma.enrollment.count({
        where: {
          enrolledAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ]);

    return {
      totalEnrollments,
      activeEnrollments,
      completedEnrollments,
      recentEnrollments,
    };
  }
}

export const enrollmentManagementService = new EnrollmentManagementService();
