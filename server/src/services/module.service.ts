import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateModuleInput, UpdateModuleInput } from '../utils/validation.js';

export class ModuleService {
  private async verifyCourseOwnership(courseId: number, instructorId: number, isAdmin = false) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    return course;
  }

  async getModules(courseId: number, userId?: number, isInstructor = false, isAdmin = false) {
    // Verify authorization: instructors/admins can access any course, students need enrollment
    if (userId && !isInstructor && !isAdmin) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId },
        },
      });

      if (!enrollment) {
        throw new AppError('You must be enrolled in this course to view modules', 403);
      }
    }

    const showUnpublished = isInstructor || isAdmin;

    const modules = await prisma.courseModule.findMany({
      where: {
        courseId,
        ...(showUnpublished ? {} : { isPublished: true }),
      },
      orderBy: { orderIndex: 'asc' },
      include: {
        lectures: {
          where: showUnpublished ? {} : { isPublished: true },
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            title: true,
            contentType: true,
            duration: true,
            orderIndex: true,
            isPublished: true,
            isFree: true,
          },
        },
        codeLabs: {
          where: showUnpublished ? {} : { isPublished: true },
          orderBy: { orderIndex: 'asc' },
          include: {
            blocks: {
              orderBy: { orderIndex: 'asc' },
              select: { id: true },
            },
          },
        },
        _count: {
          select: { lectures: true, codeLabs: true },
        },
      },
    });

    return modules;
  }

  async createModule(courseId: number, instructorId: number, data: CreateModuleInput, isAdmin = false) {
    await this.verifyCourseOwnership(courseId, instructorId, isAdmin);

    // Get max order index
    const maxOrder = await prisma.courseModule.findFirst({
      where: { courseId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    const module = await prisma.courseModule.create({
      data: {
        ...data,
        courseId,
        orderIndex: data.orderIndex ?? (maxOrder?.orderIndex ?? -1) + 1,
      },
      include: {
        _count: { select: { lectures: true } },
      },
    });

    return module;
  }

  async updateModule(moduleId: number, instructorId: number, data: UpdateModuleInput, isAdmin = false) {
    const module = await prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: { course: true },
    });

    if (!module) {
      throw new AppError('Module not found', 404);
    }

    if (module.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const updated = await prisma.courseModule.update({
      where: { id: moduleId },
      data,
      include: {
        lectures: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return updated;
  }

  async deleteModule(moduleId: number, instructorId: number, isAdmin = false) {
    const module = await prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: { course: true },
    });

    if (!module) {
      throw new AppError('Module not found', 404);
    }

    if (module.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    await prisma.courseModule.delete({
      where: { id: moduleId },
    });

    return { message: 'Module deleted successfully' };
  }

  async reorderModules(courseId: number, instructorId: number, moduleIds: number[], isAdmin = false) {
    await this.verifyCourseOwnership(courseId, instructorId, isAdmin);

    // Update order for each module
    await Promise.all(
      moduleIds.map((id, index) =>
        prisma.courseModule.update({
          where: { id },
          data: { orderIndex: index },
        })
      )
    );

    return { message: 'Modules reordered successfully' };
  }
}

export const moduleService = new ModuleService();
