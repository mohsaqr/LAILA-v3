import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { adminAuditService } from './adminAudit.service.js';

export type CourseRoleType = 'ta' | 'co_instructor' | 'course_admin';
export type Permission = 'grade' | 'edit_content' | 'manage_students' | 'view_analytics';

export const ROLE_DEFAULT_PERMISSIONS: Record<CourseRoleType, Permission[]> = {
  ta: ['grade', 'view_analytics'],
  co_instructor: ['grade', 'edit_content', 'view_analytics'],
  course_admin: ['grade', 'edit_content', 'manage_students', 'view_analytics'],
};

export interface AuditContext {
  adminId: number;
  adminEmail?: string;
  ipAddress?: string;
}

export class CourseRoleService {
  async getCourseRoles(courseId: number) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    const roles = await prisma.courseRole.findMany({
      where: { courseId },
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            email: true,
          },
        },
        assigner: {
          select: {
            id: true,
            fullname: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Parse permissions
    return roles.map(role => ({
      ...role,
      permissions: role.permissions ? JSON.parse(role.permissions) : [],
    }));
  }

  async assignRole(
    courseId: number,
    userId: number,
    role: CourseRoleType,
    permissions: Permission[] | undefined,
    context: AuditContext
  ) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Only instructors and admins can be team members
    if (!user.isInstructor && !user.isAdmin) {
      throw new AppError('Only instructors can be assigned as team members', 400);
    }

    // Check if role already exists
    const existing = await prisma.courseRole.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (existing) {
      throw new AppError('User already has a role in this course', 400);
    }

    // Use default permissions if not provided
    const finalPermissions = permissions || ROLE_DEFAULT_PERMISSIONS[role];

    const courseRole = await prisma.courseRole.create({
      data: {
        userId,
        courseId,
        role,
        permissions: JSON.stringify(finalPermissions),
        assignedBy: context.adminId,
      },
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            email: true,
          },
        },
        assigner: {
          select: {
            id: true,
            fullname: true,
          },
        },
      },
    });

    // Create audit log
    await adminAuditService.log({
      adminId: context.adminId,
      adminEmail: context.adminEmail,
      action: 'role_assign',
      targetType: 'course_role',
      targetId: courseRole.id,
      newValues: {
        userId,
        userEmail: user.email,
        courseId,
        courseTitle: course.title,
        role,
        permissions: finalPermissions,
      },
      ipAddress: context.ipAddress,
    });

    return {
      ...courseRole,
      permissions: finalPermissions,
    };
  }

  async updateRole(
    courseId: number,
    roleId: number,
    data: { role?: CourseRoleType; permissions?: Permission[] },
    context: AuditContext
  ) {
    const courseRole = await prisma.courseRole.findUnique({
      where: { id: roleId },
      include: {
        user: {
          select: { id: true, fullname: true, email: true },
        },
        course: {
          select: { id: true, title: true },
        },
      },
    });

    if (!courseRole) {
      throw new AppError('Course role not found', 404);
    }

    if (courseRole.courseId !== courseId) {
      throw new AppError('Course role does not belong to this course', 400);
    }

    const previousValues = {
      role: courseRole.role,
      permissions: courseRole.permissions ? JSON.parse(courseRole.permissions) : [],
    };

    const updateData: any = {};
    if (data.role) {
      updateData.role = data.role;
      // If role changes and no new permissions specified, use new role's defaults
      if (!data.permissions) {
        updateData.permissions = JSON.stringify(ROLE_DEFAULT_PERMISSIONS[data.role]);
      }
    }
    if (data.permissions) {
      updateData.permissions = JSON.stringify(data.permissions);
    }

    const updated = await prisma.courseRole.update({
      where: { id: roleId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            email: true,
          },
        },
        assigner: {
          select: {
            id: true,
            fullname: true,
          },
        },
      },
    });

    // Create audit log
    await adminAuditService.log({
      adminId: context.adminId,
      adminEmail: context.adminEmail,
      action: 'role_update',
      targetType: 'course_role',
      targetId: roleId,
      previousValues,
      newValues: {
        role: data.role || courseRole.role,
        permissions: data.permissions || (updateData.permissions ? JSON.parse(updateData.permissions) : previousValues.permissions),
      },
      ipAddress: context.ipAddress,
    });

    return {
      ...updated,
      permissions: updated.permissions ? JSON.parse(updated.permissions) : [],
    };
  }

  async removeRole(courseId: number, roleId: number, context: AuditContext) {
    const courseRole = await prisma.courseRole.findUnique({
      where: { id: roleId },
      include: {
        user: {
          select: { id: true, fullname: true, email: true },
        },
        course: {
          select: { id: true, title: true },
        },
      },
    });

    if (!courseRole) {
      throw new AppError('Course role not found', 404);
    }

    if (courseRole.courseId !== courseId) {
      throw new AppError('Course role does not belong to this course', 400);
    }

    const previousValues = {
      userId: courseRole.userId,
      userEmail: courseRole.user.email,
      courseId: courseRole.courseId,
      courseTitle: courseRole.course.title,
      role: courseRole.role,
      permissions: courseRole.permissions ? JSON.parse(courseRole.permissions) : [],
    };

    await prisma.courseRole.delete({
      where: { id: roleId },
    });

    // Create audit log
    await adminAuditService.log({
      adminId: context.adminId,
      adminEmail: context.adminEmail,
      action: 'role_remove',
      targetType: 'course_role',
      targetId: roleId,
      previousValues,
      ipAddress: context.ipAddress,
    });

    return { message: 'Course role removed successfully' };
  }

  // Check if user has a specific permission in a course
  async hasPermission(userId: number, courseId: number, permission: Permission) {
    // First check if user is the course instructor (has all permissions)
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) return false;
    if (course.instructorId === userId) return true;

    // Check course role permissions
    const courseRole = await prisma.courseRole.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (!courseRole) return false;

    const permissions: Permission[] = courseRole.permissions
      ? JSON.parse(courseRole.permissions)
      : [];

    return permissions.includes(permission);
  }

  // Get user's role in a course (if any)
  async getUserCourseRole(userId: number, courseId: number) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) return null;

    // If user is instructor, return special role
    if (course.instructorId === userId) {
      return {
        role: 'instructor' as const,
        permissions: ['grade', 'edit_content', 'manage_students', 'view_analytics'] as Permission[],
        isInstructor: true,
      };
    }

    const courseRole = await prisma.courseRole.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (!courseRole) return null;

    return {
      ...courseRole,
      permissions: courseRole.permissions ? JSON.parse(courseRole.permissions) : [],
      isInstructor: false,
    };
  }

  // Check if user has any CourseRole for the course (TA, co_instructor, course_admin)
  async isTeamMember(userId: number, courseId: number): Promise<boolean> {
    const role = await prisma.courseRole.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });
    return !!role;
  }

  /**
   * Staff OF THIS COURSE: platform admin, the course owner, or any team member.
   * This is the canonical "may see unpublished content of this course" check for
   * READ endpoints — use it instead of the caller's GLOBAL isInstructor flag,
   * which is true for instructors of OTHER courses and must not grant access
   * here. (For write guards prefer the permission-aware canEditContent/canGrade.)
   */
  async isCourseStaff(userId: number | undefined, courseId: number, isAdmin = false): Promise<boolean> {
    if (isAdmin) return true;
    if (!userId) return false;
    const owns = await prisma.course.findFirst({
      where: { id: courseId, instructorId: userId },
      select: { id: true },
    });
    if (owns) return true;
    return this.isTeamMember(userId, courseId);
  }

  // Permission-aware gates for MUTATIONS. Prefer these over isTeamMember when
  // guarding a write: isTeamMember is true for ANY role (including a bare TA),
  // whereas these enforce the granular per-role permission model. Each folds in
  // admin and — via hasPermission — the course owner, so a single call replaces
  // the old owner||team||admin guard while correctly denying under-privileged
  // roles (e.g. a TA has grade + view_analytics but NOT edit_content).
  async canEditContent(userId: number, courseId: number, isAdmin = false): Promise<boolean> {
    if (isAdmin) return true;
    return this.hasPermission(userId, courseId, 'edit_content');
  }

  async canGrade(userId: number, courseId: number, isAdmin = false): Promise<boolean> {
    if (isAdmin) return true;
    return this.hasPermission(userId, courseId, 'grade');
  }

  async canManageStudents(userId: number, courseId: number, isAdmin = false): Promise<boolean> {
    if (isAdmin) return true;
    return this.hasPermission(userId, courseId, 'manage_students');
  }

  // Who may assign/edit/remove COURSE STAFF ROLES: the platform admin and the
  // course owner ONLY. A team member holding `manage_students` was previously
  // allowed here too, which let them grant themselves course_admin (or edit
  // their own role) and escalate. manage_students governs STUDENT enrollment
  // management, not staff role assignment.
  async canManageRoles(userId: number, courseId: number, isAdmin: boolean) {
    if (isAdmin) return true;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true },
    });

    if (!course) return false;

    return course.instructorId === userId;
  }
}

export const courseRoleService = new CourseRoleService();
