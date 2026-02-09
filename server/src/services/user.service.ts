import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { UpdateUserInput } from '../utils/validation.js';

export class UserService {
  async getUsers(page = 1, limit = 20, search?: string) {
    const where: any = {};

    if (search) {
      where.OR = [
        { fullname: { contains: search } },
        { email: { contains: search } },
      ];
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
        settings: true,
        _count: {
          select: {
            enrollments: true,
            taughtCourses: true,
            chatLogs: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  async updateUser(id: number, data: UpdateUserInput, isAdmin = false) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updateData: any = {};

    if (data.fullname) updateData.fullname = data.fullname;
    if (data.email) updateData.email = data.email;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    // Only admins can change these
    if (isAdmin) {
      if (typeof data.isActive === 'boolean') updateData.isActive = data.isActive;
      if (typeof data.isInstructor === 'boolean') updateData.isInstructor = data.isInstructor;
      if (typeof data.isAdmin === 'boolean') updateData.isAdmin = data.isAdmin;
    }

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
      },
    });

    return updated;
  }

  async deleteUser(id: number) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.isAdmin) {
      // Check if this is the last admin
      const adminCount = await prisma.user.count({
        where: { isAdmin: true },
      });
      if (adminCount <= 1) {
        throw new AppError('Cannot delete the last admin user', 400);
      }
    }

    await prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }

  async getUserSettings(userId: number) {
    const settings = await prisma.userSetting.findMany({
      where: { userId },
    });

    // Convert to object
    const settingsObj: Record<string, string | null> = {};
    settings.forEach(s => {
      settingsObj[s.settingKey] = s.settingValue;
    });

    return settingsObj;
  }

  async updateUserSetting(userId: number, key: string, value: string | null) {
    const setting = await prisma.userSetting.upsert({
      where: {
        userId_settingKey: { userId, settingKey: key },
      },
      create: {
        userId,
        settingKey: key,
        settingValue: value,
      },
      update: {
        settingValue: value,
      },
    });

    return setting;
  }

  async getUserStats(userId: number) {
    const [enrollments, completedCourses, totalTimeSpent, submissions] = await Promise.all([
      prisma.enrollment.count({
        where: { userId },
      }),
      prisma.enrollment.count({
        where: { userId, status: 'completed' },
      }),
      prisma.lectureProgress.aggregate({
        where: {
          enrollment: { userId },
        },
        _sum: { timeSpent: true },
      }),
      prisma.assignmentSubmission.count({
        where: { userId },
      }),
    ]);

    return {
      enrolledCourses: enrollments,
      completedCourses,
      totalTimeSpent: totalTimeSpent._sum.timeSpent || 0,
      submittedAssignments: submissions,
    };
  }

  async getInstructorStats(userId: number) {
    const [courses, totalStudents, totalAssignments, pendingGrading] = await Promise.all([
      prisma.course.count({
        where: { instructorId: userId },
      }),
      prisma.enrollment.count({
        where: {
          course: { instructorId: userId },
        },
      }),
      prisma.assignment.count({
        where: {
          course: { instructorId: userId },
        },
      }),
      prisma.assignmentSubmission.count({
        where: {
          assignment: {
            course: { instructorId: userId },
          },
          status: 'submitted',
        },
      }),
    ]);

    return {
      totalCourses: courses,
      totalStudents,
      totalAssignments,
      pendingGrading,
    };
  }

  /**
   * Get user's language preference
   */
  async getLanguagePreference(userId: number): Promise<string | null> {
    const setting = await prisma.userSetting.findUnique({
      where: { userId_settingKey: { userId, settingKey: 'language' } },
    });
    return setting?.settingValue || null;
  }

  /**
   * Update user's language preference
   */
  async updateLanguagePreference(userId: number, language: string): Promise<void> {
    await prisma.userSetting.upsert({
      where: { userId_settingKey: { userId, settingKey: 'language' } },
      update: { settingValue: language },
      create: { userId, settingKey: 'language', settingValue: language },
    });
  }
}

export const userService = new UserService();
