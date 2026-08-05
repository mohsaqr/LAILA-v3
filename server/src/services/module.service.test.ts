import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModuleService } from './module.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    course: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    courseModule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
    },
    courseRole: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    lecture: { update: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn() },
    codeLab: { update: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn() },
    assignment: { update: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn() },
    forumThread: { update: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn() },
    quiz: { update: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn() },
    moduleSurvey: { update: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn() },
    labAssignment: { update: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn() },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));

import prisma from '../utils/prisma.js';

describe('ModuleService', () => {
  let moduleService: ModuleService;

  const mockCourse = {
    id: 1,
    title: 'Test Course',
    instructorId: 1,
  };

  const mockModule = {
    id: 1,
    courseId: 1,
    title: 'Test Module',
    description: 'Module description',
    orderIndex: 0,
    course: mockCourse,
    lectures: [],
    codeLabs: [],
    _count: { lectures: 2, codeLabs: 1 },
  };

  beforeEach(() => {
    moduleService = new ModuleService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // getModules
  // ===========================================================================

  describe('getModules', () => {
    beforeEach(() => {
      // Default: caller does not own the course (owner check returns null).
      vi.mocked(prisma.course.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.courseRole.findUnique).mockResolvedValue(null);
    });

    it('should return all modules for the course owner', async () => {
      // userId 1 owns course 1 → isCourseStaff, no enrollment needed.
      vi.mocked(prisma.course.findFirst).mockResolvedValue({ id: 1 } as any);
      vi.mocked(prisma.courseModule.findMany).mockResolvedValue([mockModule] as any);

      const result = await moduleService.getModules(1, 1, true, false);

      expect(result).toHaveLength(1);
      expect(prisma.courseModule.findMany).toHaveBeenCalledWith({
        where: { courseId: 1 },
        orderBy: { orderIndex: 'asc' },
        include: expect.any(Object),
      });
    });

    it('does NOT grant a global instructor of another course staff access', async () => {
      // userId 2 is a global instructor but not owner/team of course 1.
      vi.mocked(prisma.course.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(moduleService.getModules(1, 2, true, false)).rejects.toThrow('You must be enrolled');
    });

    it('should return modules for admin', async () => {
      vi.mocked(prisma.courseModule.findMany).mockResolvedValue([mockModule] as any);

      const result = await moduleService.getModules(1, 2, false, true);

      expect(result).toHaveLength(1);
      expect(prisma.enrollment.findUnique).not.toHaveBeenCalled();
    });

    it('should check enrollment for students', async () => {
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1, userId: 2, courseId: 1 } as any);
      vi.mocked(prisma.courseModule.findMany).mockResolvedValue([mockModule] as any);

      const result = await moduleService.getModules(1, 2, false, false);

      expect(result).toHaveLength(1);
      expect(prisma.enrollment.findUnique).toHaveBeenCalledWith({
        where: { userId_courseId: { userId: 2, courseId: 1 } },
      });
    });

    it('should throw 403 for non-enrolled students', async () => {
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(moduleService.getModules(1, 2, false, false)).rejects.toThrow(AppError);
      await expect(moduleService.getModules(1, 2, false, false)).rejects.toThrow('You must be enrolled');
    });
  });

  // ===========================================================================
  // createModule
  // ===========================================================================

  describe('createModule', () => {
    it('should create module as owner', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.courseModule.findFirst).mockResolvedValue({ orderIndex: 1 } as any);
      vi.mocked(prisma.courseModule.create).mockResolvedValue(mockModule as any);

      const result = await moduleService.createModule(1, 1, { title: 'New Module' });

      expect(result.id).toBe(1);
      expect(prisma.courseModule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'New Module',
          courseId: 1,
          orderIndex: 2,
        }),
        include: expect.any(Object),
      });
    });

    it('should create module as admin', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.courseModule.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.courseModule.create).mockResolvedValue(mockModule as any);

      const result = await moduleService.createModule(1, 999, { title: 'Admin Module' }, true);

      expect(result.id).toBe(1);
    });

    it('should throw 404 if course not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(moduleService.createModule(999, 1, { title: 'Test' })).rejects.toThrow(AppError);
      await expect(moduleService.createModule(999, 1, { title: 'Test' })).rejects.toThrow('Course not found');
    });

    it('should throw 403 if not owner and not admin', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);

      await expect(moduleService.createModule(1, 999, { title: 'Test' })).rejects.toThrow(AppError);
      await expect(moduleService.createModule(1, 999, { title: 'Test' })).rejects.toThrow('Not authorized');
    });

    it('should use provided orderIndex if specified', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.courseModule.findFirst).mockResolvedValue({ orderIndex: 5 } as any);
      vi.mocked(prisma.courseModule.create).mockResolvedValue(mockModule as any);

      await moduleService.createModule(1, 1, { title: 'New Module', orderIndex: 10 });

      expect(prisma.courseModule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderIndex: 10,
        }),
        include: expect.any(Object),
      });
    });
  });

  // ===========================================================================
  // updateModule
  // ===========================================================================

  describe('updateModule', () => {
    it('should update module as owner', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);
      vi.mocked(prisma.courseModule.update).mockResolvedValue({
        ...mockModule,
        title: 'Updated Title',
      } as any);

      const result = await moduleService.updateModule(1, 1, { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
      expect(prisma.courseModule.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { title: 'Updated Title' },
        include: expect.any(Object),
      });
    });

    it('should update module as admin', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);
      vi.mocked(prisma.courseModule.update).mockResolvedValue(mockModule as any);

      await moduleService.updateModule(1, 999, { title: 'Admin Update' }, true);

      expect(prisma.courseModule.update).toHaveBeenCalled();
    });

    it('should throw 404 if module not found', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(null);

      await expect(moduleService.updateModule(999, 1, { title: 'Test' })).rejects.toThrow(AppError);
      await expect(moduleService.updateModule(999, 1, { title: 'Test' })).rejects.toThrow('Module not found');
    });

    it('should throw 403 if not owner and not admin', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);

      await expect(moduleService.updateModule(1, 999, { title: 'Test' })).rejects.toThrow(AppError);
      await expect(moduleService.updateModule(1, 999, { title: 'Test' })).rejects.toThrow('Not authorized');
    });
  });

  // ===========================================================================
  // deleteModule
  // ===========================================================================

  describe('deleteModule', () => {
    it('should delete module as owner', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);
      vi.mocked(prisma.courseModule.delete).mockResolvedValue(mockModule as any);

      const result = await moduleService.deleteModule(1, 1);

      expect(result.message).toBe('Module deleted successfully');
      expect(prisma.courseModule.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should delete module as admin', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);
      vi.mocked(prisma.courseModule.delete).mockResolvedValue(mockModule as any);

      const result = await moduleService.deleteModule(1, 999, true);

      expect(result.message).toBe('Module deleted successfully');
    });

    it('should throw 404 if module not found', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(null);

      await expect(moduleService.deleteModule(999, 1)).rejects.toThrow(AppError);
      await expect(moduleService.deleteModule(999, 1)).rejects.toThrow('Module not found');
    });

    it('should throw 403 if not owner and not admin', async () => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);

      await expect(moduleService.deleteModule(1, 999)).rejects.toThrow(AppError);
      await expect(moduleService.deleteModule(1, 999)).rejects.toThrow('Not authorized');
    });
  });

  // ===========================================================================
  // reorderModules
  // ===========================================================================

  describe('reorderModules', () => {
    it('should reorder modules as owner', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.courseModule.update).mockResolvedValue(mockModule as any);

      const result = await moduleService.reorderModules(1, 1, [3, 1, 2]);

      expect(result.message).toBe('Modules reordered successfully');
      expect(prisma.courseModule.update).toHaveBeenCalledTimes(3);
    });

    it('should reorder modules as admin', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.courseModule.update).mockResolvedValue(mockModule as any);

      const result = await moduleService.reorderModules(1, 999, [1, 2], true);

      expect(result.message).toBe('Modules reordered successfully');
    });

    it('should throw 404 if course not found', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(moduleService.reorderModules(999, 1, [1, 2])).rejects.toThrow(AppError);
      await expect(moduleService.reorderModules(999, 1, [1, 2])).rejects.toThrow('Course not found');
    });

    it('should throw 403 if not owner and not admin', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);

      await expect(moduleService.reorderModules(1, 999, [1, 2])).rejects.toThrow(AppError);
      await expect(moduleService.reorderModules(1, 999, [1, 2])).rejects.toThrow('Not authorized');
    });
  });

  describe('reorderModuleItems', () => {
    beforeEach(() => {
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue({ id: 5, courseId: 10 } as any);
      vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: 10, instructorId: 1 } as any);
    });

    it('skips items with an unknown type or missing id instead of crashing', async () => {
      const items = [
        { type: 'lecture', id: 1 },
        { type: 'bogus', id: 2 },          // unknown type
        { type: 'quiz' },                  // missing id
      ] as any;

      const result = await moduleService.reorderModuleItems(5, 1, items);

      expect(result).toEqual({ message: 'Module items reordered' });
      // Only the valid lecture op is built...
      expect(prisma.lecture.update).toHaveBeenCalledTimes(1);
      expect(prisma.lecture.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { orderIndex: 0 } });
      // ...the malformed entries never reach Prisma.
      expect(prisma.quiz.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('reorders each known item type to its array position', async () => {
      const items = [
        { type: 'quiz', id: 11 },
        { type: 'forum', id: 12 },
        { type: 'survey', id: 13 },
      ] as any;

      await moduleService.reorderModuleItems(5, 1, items);

      expect(prisma.quiz.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { orderIndex: 0 } });
      expect(prisma.forumThread.update).toHaveBeenCalledWith({ where: { id: 12 }, data: { orderIndex: 1 } });
      expect(prisma.moduleSurvey.update).toHaveBeenCalledWith({ where: { id: 13 }, data: { orderIndex: 2 } });
    });

    it('reorders an assigned lab alongside everything else', async () => {
      const items = [
        { type: 'lab', id: 7 },
        { type: 'lecture', id: 8 },
      ] as any;

      await moduleService.reorderModuleItems(5, 1, items);

      // Labs were absent from this switch, so a lab in the submitted order was
      // silently dropped and snapped back to the end of the section on refresh.
      expect(prisma.labAssignment.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { orderIndex: 0 } });
      expect(prisma.lecture.update).toHaveBeenCalledWith({ where: { id: 8 }, data: { orderIndex: 1 } });
    });

    it('coerces a numeric-string id instead of silently dropping it', async () => {
      const items = [{ type: 'lecture', id: '5' }] as any;

      await moduleService.reorderModuleItems(5, 1, items);

      // '5' -> 5, so the reorder actually happens (not a silent no-op).
      expect(prisma.lecture.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { orderIndex: 0 } });
    });
  });

  describe('moveItemToModule', () => {
    /** Destination module 5 in course 10, owned by instructor 1. */
    const destInCourse10 = () => {
      vi.mocked(prisma.courseModule.findUnique).mockImplementation((async ({ where }: any) =>
        where.id === 5 ? { id: 5, courseId: 10 }
        : where.id === 6 ? { id: 6, courseId: 10 }
        : where.id === 99 ? { id: 99, courseId: 77 }   // a DIFFERENT course
        : null) as any);
      vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: 10, instructorId: 1 } as any);
      // Empty destination, so the moved item lands at index 0.
      const empty = { _max: { orderIndex: null } } as any;
      [prisma.lecture, prisma.codeLab, prisma.assignment, prisma.quiz,
       prisma.forumThread, prisma.moduleSurvey, prisma.labAssignment]
        .forEach(t => vi.mocked(t.aggregate).mockResolvedValue(empty));
    };

    beforeEach(destInCourse10);

    it('moves an item and appends it to the destination', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({ moduleId: 6 } as any);
      vi.mocked(prisma.lecture.aggregate).mockResolvedValue({ _max: { orderIndex: 3 } } as any);

      await moduleService.moveItemToModule(5, 1, { type: 'lecture', id: 42 });

      expect(prisma.lecture.update).toHaveBeenCalledWith({
        where: { id: 42 },
        // One past the highest index in the destination, so it lands last
        // rather than colliding with whatever already sits at that position.
        data: { moduleId: 5, orderIndex: 4 },
      });
    });

    it('refuses to move an item in from another course', async () => {
      // The lecture currently lives in module 99, which belongs to course 77.
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({ moduleId: 99 } as any);

      // This is the security boundary: item ids are global, so without the
      // same-course check an instructor could name any id and pull another
      // course's resource into their own.
      await expect(
        moduleService.moveItemToModule(5, 1, { type: 'lecture', id: 42 }),
      ).rejects.toThrow('Cannot move an item between courses');
      expect(prisma.lecture.update).not.toHaveBeenCalled();
    });

    it('refuses when the caller cannot edit the destination course', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({ moduleId: 6 } as any);

      await expect(
        moduleService.moveItemToModule(5, 999, { type: 'lecture', id: 42 }),
      ).rejects.toThrow('Not authorized');
      expect(prisma.lecture.update).not.toHaveBeenCalled();
    });

    it('rejects an item that is in no section at all', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({ moduleId: null } as any);

      await expect(
        moduleService.moveItemToModule(5, 1, { type: 'lecture', id: 42 }),
      ).rejects.toThrow(/not in a section/);
    });

    it('is a no-op when the destination is where the item already is', async () => {
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue({ moduleId: 5 } as any);

      const result = await moduleService.moveItemToModule(5, 1, { type: 'lecture', id: 42 });

      expect(result.message).toMatch(/already/);
      expect(prisma.lecture.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown item type', async () => {
      await expect(
        moduleService.moveItemToModule(5, 1, { type: 'bogus' as any, id: 42 }),
      ).rejects.toThrow('Invalid item type');
    });

    it('rejects a non-integer id instead of querying with undefined', async () => {
      await expect(
        moduleService.moveItemToModule(5, 1, { type: 'lecture', id: 'abc' as any }),
      ).rejects.toThrow('Invalid item id');
    });

    it('moves an assigned lab, which used to be pinned in place', async () => {
      vi.mocked(prisma.labAssignment.findUnique).mockResolvedValue({ moduleId: 6 } as any);

      await moduleService.moveItemToModule(5, 1, { type: 'lab', id: 7 });

      expect(prisma.labAssignment.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { moduleId: 5, orderIndex: 0 },
      });
    });
  });

});
