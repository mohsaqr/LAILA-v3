import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { adminAuditService } from './adminAudit.service.js';
import { invalidateUserStatusCache } from '../middleware/auth.middleware.js';

export interface UserFilters {
  search?: string;
  isAdmin?: boolean;
  isInstructor?: boolean;
  isActive?: boolean;
  role?: 'admin' | 'instructor' | 'student';
}

export interface UpdateUserData {
  fullname?: string;
  email?: string;
  password?: string;
  isActive?: boolean;
  isInstructor?: boolean;
  isAdmin?: boolean;
  isConfirmed?: boolean;
}

export interface AuditContext {
  adminId: number;
  adminEmail?: string;
  ipAddress?: string;
}

export class UserManagementService {
  async getUsers(
    page = 1,
    limit = 20,
    filters?: UserFilters
  ) {
    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { fullname: { contains: filters.search } },
        { email: { contains: filters.search } },
      ];
    }

    if (typeof filters?.isAdmin === 'boolean') {
      where.isAdmin = filters.isAdmin;
    }
    if (typeof filters?.isInstructor === 'boolean') {
      where.isInstructor = filters.isInstructor;
    }
    if (typeof filters?.isActive === 'boolean') {
      where.isActive = filters.isActive;
    }

    // Role filter
    if (filters?.role) {
      if (filters.role === 'admin') {
        where.isAdmin = true;
      } else if (filters.role === 'instructor') {
        where.isInstructor = true;
        where.isAdmin = false;
      } else if (filters.role === 'student') {
        where.isAdmin = false;
        where.isInstructor = false;
      }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          fullname: true,
          email: true,
          isAdmin: true,
          isInstructor: true,
          isActive: true,
          isConfirmed: true,
          createdAt: true,
          lastLogin: true,
          _count: {
            select: {
              enrollments: true,
              taughtCourses: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(id: number) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullname: true,
        email: true,
        isAdmin: true,
        isInstructor: true,
        isActive: true,
        isConfirmed: true,
        createdAt: true,
        lastLogin: true,
        _count: {
          select: {
            enrollments: true,
            taughtCourses: true,
            chatLogs: true,
            submissions: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  async getUserWithEnrollments(id: number) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: {
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
        },
        taughtCourses: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            _count: {
              select: { enrollments: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        courseRoles: {
          include: {
            course: {
              select: { id: true, title: true, slug: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user as any;
    return userWithoutPassword;
  }

  async updateUser(id: number, data: UpdateUserData, context: AuditContext) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Prepare previous values for audit
    const previousValues = {
      fullname: user.fullname,
      email: user.email,
      isAdmin: user.isAdmin,
      isInstructor: user.isInstructor,
      isActive: user.isActive,
      isConfirmed: user.isConfirmed,
    };

    const updateData: any = {};

    if (data.fullname) updateData.fullname = data.fullname;
    if (data.email && data.email !== user.email) {
      // Check if email is already taken
      const existing = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existing && existing.id !== id) {
        throw new AppError('Email already in use', 400);
      }
      updateData.email = data.email;
    }
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      // Increment tokenVersion to invalidate existing tokens when password changes
      updateData.tokenVersion = { increment: 1 };
    }
    if (typeof data.isActive === 'boolean') updateData.isActive = data.isActive;
    if (typeof data.isInstructor === 'boolean') updateData.isInstructor = data.isInstructor;
    if (typeof data.isAdmin === 'boolean') {
      // Prevent removing admin from the last admin
      if (!data.isAdmin && user.isAdmin) {
        const adminCount = await prisma.user.count({
          where: { isAdmin: true },
        });
        if (adminCount <= 1) {
          throw new AppError('Cannot remove admin role from the last admin', 400);
        }
      }
      updateData.isAdmin = data.isAdmin;
    }
    if (typeof data.isConfirmed === 'boolean') updateData.isConfirmed = data.isConfirmed;

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullname: true,
        email: true,
        isAdmin: true,
        isInstructor: true,
        isActive: true,
        isConfirmed: true,
      },
    });

    // Invalidate user status cache if isActive or password was changed
    if (data.isActive !== undefined || data.password) {
      invalidateUserStatusCache(id);
    }

    // Create audit log
    await adminAuditService.log({
      adminId: context.adminId,
      adminEmail: context.adminEmail,
      action: 'user_update',
      targetType: 'user',
      targetId: id,
      previousValues,
      newValues: updated,
      ipAddress: context.ipAddress,
    });

    return updated;
  }

  async updateUserRoles(
    id: number,
    roles: { isAdmin?: boolean; isInstructor?: boolean },
    context: AuditContext
  ) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const previousValues = {
      isAdmin: user.isAdmin,
      isInstructor: user.isInstructor,
    };

    // Prevent removing admin from the last admin
    if (typeof roles.isAdmin === 'boolean' && !roles.isAdmin && user.isAdmin) {
      const adminCount = await prisma.user.count({
        where: { isAdmin: true },
      });
      if (adminCount <= 1) {
        throw new AppError('Cannot remove admin role from the last admin', 400);
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        isAdmin: roles.isAdmin ?? user.isAdmin,
        isInstructor: roles.isInstructor ?? user.isInstructor,
      },
      select: {
        id: true,
        fullname: true,
        email: true,
        isAdmin: true,
        isInstructor: true,
      },
    });

    // Create audit log
    await adminAuditService.log({
      adminId: context.adminId,
      adminEmail: context.adminEmail,
      action: 'role_change',
      targetType: 'user',
      targetId: id,
      previousValues,
      newValues: { isAdmin: updated.isAdmin, isInstructor: updated.isInstructor },
      ipAddress: context.ipAddress,
    });

    return updated;
  }

  async deleteUser(id: number, context: AuditContext) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.isAdmin) {
      const adminCount = await prisma.user.count({
        where: { isAdmin: true },
      });
      if (adminCount <= 1) {
        throw new AppError('Cannot delete the last admin user', 400);
      }
    }

    // Store user data for audit before deletion
    const previousValues = {
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      isAdmin: user.isAdmin,
      isInstructor: user.isInstructor,
    };

    await prisma.user.delete({
      where: { id },
    });

    // Invalidate user status cache
    invalidateUserStatusCache(id);

    // Create audit log
    await adminAuditService.log({
      adminId: context.adminId,
      adminEmail: context.adminEmail,
      action: 'user_delete',
      targetType: 'user',
      targetId: id,
      previousValues,
      ipAddress: context.ipAddress,
    });

    return { message: 'User deleted successfully' };
  }

  async getUserEnrollments(userId: number, page = 1, limit = 20) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        where: { userId },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              thumbnail: true,
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
      prisma.enrollment.count({ where: { userId } }),
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

  async addUserEnrollment(
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
        course: {
          select: { id: true, title: true },
        },
        user: {
          select: { id: true, fullname: true, email: true },
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

  async removeUserEnrollment(
    userId: number,
    enrollmentId: number,
    context: AuditContext
  ) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        userId,
      },
      include: {
        course: {
          select: { id: true, title: true },
        },
        user: {
          select: { id: true, fullname: true, email: true },
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

  // Helper to get user stats
  async getUserStats() {
    const [totalUsers, activeUsers, admins, instructors] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isAdmin: true } }),
      prisma.user.count({ where: { isInstructor: true, isAdmin: false } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      admins,
      instructors,
      students: totalUsers - admins - instructors,
    };
  }
}

export const userManagementService = new UserManagementService();
