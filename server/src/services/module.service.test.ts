import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModuleService } from './module.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    course: {
      findUnique: vi.fn(),
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
    it('should return modules for instructor', async () => {
      vi.mocked(prisma.courseModule.findMany).mockResolvedValue([mockModule] as any);

      const result = await moduleService.getModules(1, 1, true, false);

      expect(result).toHaveLength(1);
      expect(prisma.courseModule.findMany).toHaveBeenCalledWith({
        where: { courseId: 1 },
        orderBy: { orderIndex: 'asc' },
        include: expect.any(Object),
      });
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
});
