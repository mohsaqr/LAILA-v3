import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
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
  /**
   * Run an admin-affecting mutation (delete / demote / deactivate an admin)
   * only if at least one OTHER active admin remains — atomically, so two
   * concurrent requests can't both pass the check and leave zero usable admins.
   * Serializable isolation means a conflicting concurrent write fails safe with
   * an error rather than silently breaking the invariant.
   */
  private async mutateKeepingAnAdmin<T>(
    excludeUserId: number,
    message: string,
    mutate: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return prisma.$transaction(
      async tx => {
        const remaining = await tx.user.count({
          where: { isAdmin: true, isActive: true, id: { not: excludeUserId } },
        });
        if (remaining < 1) throw new AppError(message, 400);
        return mutate(tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

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
      updateData.isAdmin = data.isAdmin;
    }
    if (typeof data.isConfirmed === 'boolean') updateData.isConfirmed = data.isConfirmed;

    // isAdmin/isInstructor are baked into the JWT, so a role change must bump
    // tokenVersion — otherwise a demoted admin keeps elevated access until the
    // (30-day) token expires. The affected user simply re-logs-in.
    const rolesChanged =
      (updateData.isInstructor !== undefined && updateData.isInstructor !== user.isInstructor) ||
      (updateData.isAdmin !== undefined && updateData.isAdmin !== user.isAdmin);
    if (rolesChanged) {
      updateData.tokenVersion = { increment: 1 };
    }

    // Deactivating or demoting an admin must not leave zero usable admins.
    const deactivatingAdmin = data.isActive === false && user.isAdmin && user.isActive;
    const demotingAdmin = data.isAdmin === false && user.isAdmin;
    const applyUpdate = (client: Prisma.TransactionClient) =>
      client.user.update({
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

    const updated =
      deactivatingAdmin || demotingAdmin
        ? await this.mutateKeepingAnAdmin(
            id,
            deactivatingAdmin
              ? 'Cannot deactivate the last active admin'
              : 'Cannot remove admin role from the last admin',
            tx => applyUpdate(tx)
          )
        : await applyUpdate(prisma);

    // Invalidate user status cache if isActive, password, or role was changed
    if (data.isActive !== undefined || data.password || rolesChanged) {
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

    const nextIsAdmin = roles.isAdmin ?? user.isAdmin;
    const nextIsInstructor = roles.isInstructor ?? user.isInstructor;
    const rolesChanged = nextIsAdmin !== user.isAdmin || nextIsInstructor !== user.isInstructor;
    const demotingAdmin = user.isAdmin && !nextIsAdmin;

    const applyUpdate = (client: Prisma.TransactionClient) =>
      client.user.update({
        where: { id },
        data: {
          isAdmin: nextIsAdmin,
          isInstructor: nextIsInstructor,
          // Roles live in the JWT; bump tokenVersion so the change is enforced on
          // the target's next request instead of after token expiry.
          ...(rolesChanged ? { tokenVersion: { increment: 1 } } : {}),
        },
        select: {
          id: true,
          fullname: true,
          email: true,
          isAdmin: true,
          isInstructor: true,
        },
      });

    // Demoting an admin must not leave zero usable admins (race-safe).
    const updated = demotingAdmin
      ? await this.mutateKeepingAnAdmin(id, 'Cannot remove admin role from the last admin', tx =>
          applyUpdate(tx)
        )
      : await applyUpdate(prisma);

    // Drop the cached status so the bumped tokenVersion is re-read immediately.
    if (rolesChanged) {
      invalidateUserStatusCache(id);
    }

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

    // Store user data for audit before deletion
    const previousValues = {
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      isAdmin: user.isAdmin,
      isInstructor: user.isInstructor,
    };

    // Deleting an admin must not leave zero usable admins (race-safe).
    if (user.isAdmin) {
      await this.mutateKeepingAnAdmin(id, 'Cannot delete the last admin user', tx =>
        tx.user.delete({ where: { id } })
      );
    } else {
      await prisma.user.delete({ where: { id } });
    }

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

  // Admin-create a user directly (confirmed + active), bypassing the email
  // verification flow. Role is mapped to the isAdmin/isInstructor flags.
  async createUser(
    data: {
      fullname: string;
      email: string;
      password: string;
      role: 'admin' | 'instructor' | 'student';
      isActive?: boolean;
    },
    context: AuditContext
  ) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError('A user with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        fullname: data.fullname,
        email: data.email,
        passwordHash,
        isAdmin: data.role === 'admin',
        isInstructor: data.role === 'admin' || data.role === 'instructor',
        isActive: data.isActive ?? true,
        isConfirmed: true,
      },
      select: {
        id: true, fullname: true, email: true,
        isAdmin: true, isInstructor: true, isActive: true, createdAt: true,
      },
    });

    await adminAuditService.log({
      adminId: context.adminId,
      adminEmail: context.adminEmail,
      action: 'user_create',
      targetType: 'user',
      targetId: user.id,
      newValues: { email: user.email, fullname: user.fullname, role: data.role },
      ipAddress: context.ipAddress,
    });

    return user;
  }

  // Enroll/unenroll many users in a single course. Idempotent per user:
  // already-enrolled (enroll) or not-enrolled (unenroll) users are skipped, not
  // errored, so a bulk run over a mixed selection reports cleanly.
  async bulkEnroll(
    userIds: number[],
    courseId: number,
    action: 'enroll' | 'unenroll',
    context: AuditContext
  ) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });
    if (!course) throw new AppError('Course not found', 404);

    const uniqueIds = [...new Set(userIds)];
    const errors: Array<{ userId: number; error: string }> = [];

    // Non-existent user ids are reported as errors, not silently skipped, so a
    // bad selection is visible to the caller.
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    const validIds = new Set(existingUsers.map(u => u.id));
    uniqueIds
      .filter(id => !validIds.has(id))
      .forEach(id => errors.push({ userId: id, error: 'User not found' }));
    const targetIds = uniqueIds.filter(id => validIds.has(id));

    // Current enrollment state for the valid targets, fetched once instead of
    // per-user, so we can pre-filter and issue a single bulk write.
    const enrolled = await prisma.enrollment.findMany({
      where: { courseId, userId: { in: targetIds } },
      select: { userId: true },
    });
    const enrolledIds = new Set(enrolled.map(e => e.userId));

    let changed = 0;
    let skipped = 0;

    if (action === 'enroll') {
      // Pre-filter already-enrolled so we don't rely on skipDuplicates (which
      // Prisma does not support on SQLite / local dev).
      const toCreate = targetIds.filter(id => !enrolledIds.has(id));
      skipped = targetIds.length - toCreate.length;
      if (toCreate.length > 0) {
        const res = await prisma.enrollment.createMany({
          data: toCreate.map(userId => ({ userId, courseId })),
        });
        changed = res.count;
      }
    } else {
      const toDelete = targetIds.filter(id => enrolledIds.has(id));
      skipped = targetIds.length - toDelete.length;
      if (toDelete.length > 0) {
        const res = await prisma.enrollment.deleteMany({
          where: { courseId, userId: { in: toDelete } },
        });
        changed = res.count;
      }
    }

    await adminAuditService.log({
      adminId: context.adminId,
      adminEmail: context.adminEmail,
      action: action === 'enroll' ? 'bulk_enrollment_add' : 'bulk_enrollment_remove',
      targetType: 'batch_enrollment',
      targetId: courseId,
      newValues: { courseId, courseTitle: course.title, userIds: uniqueIds, changed, skipped },
      ipAddress: context.ipAddress,
    });

    return { action, courseId, courseTitle: course.title, total: uniqueIds.length, changed, skipped, errors };
  }
}

export const userManagementService = new UserManagementService();
