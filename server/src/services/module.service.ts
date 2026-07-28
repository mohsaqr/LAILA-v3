import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { CreateModuleInput, UpdateModuleInput } from '../utils/validation.js';
import { courseRoleService } from './courseRole.service.js';

export class ModuleService {
  private async verifyCourseOwnership(courseId: number, instructorId: number, isAdmin = false) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (!(await courseRoleService.canEditContent(instructorId, course.id, isAdmin))) {
      throw new AppError('Not authorized', 403);
    }

    return course;
  }

  async getModules(courseId: number, userId?: number, _isInstructor = false, isAdmin = false) {
    // Staff of THIS course see unpublished content; the caller's GLOBAL
    // isInstructor flag is ignored (an instructor of another course was
    // previously shown this course's unpublished modules, and skipped the
    // enrollment check entirely). Non-staff must be enrolled.
    const isCourseStaff = await courseRoleService.isCourseStaff(userId, courseId, isAdmin);
    if (userId && !isCourseStaff) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId },
        },
      });

      if (!enrollment) {
        throw new AppError('You must be enrolled in this course to view modules', 403);
      }
    }

    const showUnpublished = isCourseStaff;

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

    if (!(await courseRoleService.canEditContent(instructorId, module.course.id, isAdmin))) {
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

    if (!(await courseRoleService.canEditContent(instructorId, module.course.id, isAdmin))) {
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

  /**
   * Unified cross-type reorder. Accepts a flat sequence of items from a
   * single module and rewrites every item's `orderIndex` to its position
   * in the array, regardless of type. The client always sends the full
   * ordered list — server normalizes positions to 0..N.
   */
  async reorderModuleItems(
    moduleId: number,
    instructorId: number,
    items: { type: 'lecture' | 'codelab' | 'assignment' | 'forum' | 'quiz' | 'survey'; id: number }[],
    isAdmin = false,
  ) {
    const module = await prisma.courseModule.findUnique({ where: { id: moduleId } });
    if (!module) throw new Error('Module not found');
    await this.verifyCourseOwnership(module.courseId, instructorId, isAdmin);

    // Build one update op per item at its array position. Skip items with an
    // unknown type or a non-integer id (e.g. a malformed request or client/
    // server type drift) so a single bad entry can't inject `undefined` into
    // the transaction array or hit Prisma with `where: { id: undefined }`,
    // both of which would surface as an opaque 500. Well-formed clients are
    // unaffected — index alignment is preserved by mapping over the originals.
    const ops = items
      .map((item, index) => {
        // Coerce numeric-string ids (a JSON body may carry "5") and skip
        // anything that still isn't a positive integer.
        const id = Number(item.id);
        if (!Number.isInteger(id)) return null;
        const data = { orderIndex: index };
        switch (item.type) {
          case 'lecture':
            return prisma.lecture.update({ where: { id }, data });
          case 'codelab':
            return prisma.codeLab.update({ where: { id }, data });
          case 'assignment':
            return prisma.assignment.update({ where: { id }, data });
          case 'forum':
            return prisma.forumThread.update({ where: { id }, data });
          case 'quiz':
            return prisma.quiz.update({ where: { id }, data });
          case 'survey':
            // ModuleSurvey id (the junction row), not the surveyId.
            return prisma.moduleSurvey.update({ where: { id }, data });
          default:
            return null;
        }
      })
      .filter((op): op is NonNullable<typeof op> => op !== null);

    await prisma.$transaction(ops);

    return { message: 'Module items reordered' };
  }
}

export const moduleService = new ModuleService();
