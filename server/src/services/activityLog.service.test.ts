import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
    },
    courseModule: {
      findUnique: vi.fn(),
    },
    lecture: {
      findUnique: vi.fn(),
    },
    lectureSection: {
      findUnique: vi.fn(),
    },
    learningActivityLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import prisma from '../utils/prisma.js';
import { activityLogService } from './activityLog.service.js';

describe('ActivityLogService', () => {
  const mockUser = {
    email: 'test@example.com',
    fullname: 'Test User',
    isAdmin: false,
    isInstructor: false,
  };

  const mockCourse = {
    id: 1,
    title: 'Test Course',
    slug: 'test-course',
  };

  const mockModule = {
    id: 1,
    title: 'Test Module',
    orderIndex: 0,
    courseId: 1,
    course: mockCourse,
  };

  const mockLecture = {
    id: 1,
    title: 'Test Lecture',
    orderIndex: 0,
    module: mockModule,
  };

  const mockSection = {
    id: 1,
    title: 'Test Section',
    order: 0,
    type: 'text',
    lecture: mockLecture,
  };

  const mockActivityLog = {
    id: 1,
    userId: 1,
    userEmail: 'test@example.com',
    userFullname: 'Test User',
    userRole: 'student',
    verb: 'viewed',
    objectType: 'lecture',
    objectId: 1,
    timestamp: new Date(),
    extensions: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // logActivity
  // ===========================================================================

  describe('logActivity', () => {
    it('should log activity with basic info', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.learningActivityLog.create).mockResolvedValue(mockActivityLog as any);

      const result = await activityLogService.logActivity({
        userId: 1,
        verb: 'viewed',
        objectType: 'lecture',
        objectId: 1,
      });

      expect(result.id).toBe(1);
      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          verb: 'viewed',
          objectType: 'lecture',
          objectId: 1,
          userEmail: 'test@example.com',
          userRole: 'student',
        }),
      });
    });

    it('should set userRole to admin for admin users', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...mockUser, isAdmin: true } as any);
      vi.mocked(prisma.learningActivityLog.create).mockResolvedValue(mockActivityLog as any);

      await activityLogService.logActivity({
        userId: 1,
        verb: 'viewed',
        objectType: 'course',
      });

      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userRole: 'admin',
        }),
      });
    });

    it('should set userRole to instructor for instructor users', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...mockUser, isInstructor: true } as any);
      vi.mocked(prisma.learningActivityLog.create).mockResolvedValue(mockActivityLog as any);

      await activityLogService.logActivity({
        userId: 1,
        verb: 'created',
        objectType: 'course',
      });

      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userRole: 'instructor',
        }),
      });
    });

    it('should throw error if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(activityLogService.logActivity({
        userId: 999,
        verb: 'viewed',
        objectType: 'lecture',
      })).rejects.toThrow('User with id 999 not found');
    });

    it('should enrich with course context when courseId provided', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);
      vi.mocked(prisma.learningActivityLog.create).mockResolvedValue(mockActivityLog as any);

      await activityLogService.logActivity({
        userId: 1,
        verb: 'enrolled',
        objectType: 'course',
        courseId: 1,
      });

      expect(prisma.course.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, title: true, slug: true },
      });
      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          courseTitle: 'Test Course',
          courseSlug: 'test-course',
        }),
      });
    });

    it('should enrich with module context when moduleId provided', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.courseModule.findUnique).mockResolvedValue(mockModule as any);
      vi.mocked(prisma.learningActivityLog.create).mockResolvedValue(mockActivityLog as any);

      await activityLogService.logActivity({
        userId: 1,
        verb: 'viewed',
        objectType: 'module',
        moduleId: 1,
      });

      expect(prisma.courseModule.findUnique).toHaveBeenCalled();
      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          moduleId: 1,
          moduleTitle: 'Test Module',
          moduleOrder: 0,
        }),
      });
    });

    it('should enrich with lecture context when lectureId provided', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.lecture.findUnique).mockResolvedValue(mockLecture as any);
      vi.mocked(prisma.learningActivityLog.create).mockResolvedValue(mockActivityLog as any);

      await activityLogService.logActivity({
        userId: 1,
        verb: 'viewed',
        objectType: 'lecture',
        lectureId: 1,
      });

      expect(prisma.lecture.findUnique).toHaveBeenCalled();
      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          lectureId: 1,
          lectureTitle: 'Test Lecture',
        }),
      });
    });

    it('should enrich with section context when sectionId provided', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.lectureSection.findUnique).mockResolvedValue(mockSection as any);
      vi.mocked(prisma.learningActivityLog.create).mockResolvedValue(mockActivityLog as any);

      await activityLogService.logActivity({
        userId: 1,
        verb: 'viewed',
        objectType: 'section',
        sectionId: 1,
      });

      expect(prisma.lectureSection.findUnique).toHaveBeenCalled();
      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sectionId: 1,
          sectionTitle: 'Test Section',
        }),
      });
    });

    it('should stringify extensions JSON', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.learningActivityLog.create).mockResolvedValue(mockActivityLog as any);

      await activityLogService.logActivity({
        userId: 1,
        verb: 'interacted',
        objectType: 'chatbot',
        extensions: { responseTime: 1500, model: 'gpt-4' },
      });

      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          extensions: '{"responseTime":1500,"model":"gpt-4"}',
        }),
      });
    });
  });

  // ===========================================================================
  // queryLogs
  // ===========================================================================

  describe('queryLogs', () => {
    it('should return paginated logs', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([mockActivityLog] as any);
      vi.mocked(prisma.learningActivityLog.count).mockResolvedValue(1);

      const result = await activityLogService.queryLogs({});

      expect(result.logs).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should apply userId filter', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.learningActivityLog.count).mockResolvedValue(0);

      await activityLogService.queryLogs({ userId: 1 });

      expect(prisma.learningActivityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 1 },
        })
      );
    });

    it('should apply date range filter', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.learningActivityLog.count).mockResolvedValue(0);

      await activityLogService.queryLogs({ startDate, endDate });

      expect(prisma.learningActivityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            timestamp: { gte: startDate, lte: endDate },
          },
        })
      );
    });

    it('should apply search filter', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.learningActivityLog.count).mockResolvedValue(0);

      await activityLogService.queryLogs({ search: 'test' });

      expect(prisma.learningActivityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: expect.arrayContaining([
              { userEmail: { contains: 'test' } },
              { userFullname: { contains: 'test' } },
            ]),
          },
        })
      );
    });

    it('should parse extensions JSON', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([
        { ...mockActivityLog, extensions: '{"key":"value"}' },
      ] as any);
      vi.mocked(prisma.learningActivityLog.count).mockResolvedValue(1);

      const result = await activityLogService.queryLogs({});

      expect(result.logs[0].extensions).toEqual({ key: 'value' });
    });

    it('should handle custom sort fields', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.learningActivityLog.count).mockResolvedValue(0);

      await activityLogService.queryLogs({ sortBy: 'userFullname', sortOrder: 'asc' });

      expect(prisma.learningActivityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { userFullname: 'asc' },
        })
      );
    });
  });

  // ===========================================================================
  // getStats
  // ===========================================================================

  describe('getStats', () => {
    it('should return aggregated statistics', async () => {
      vi.mocked(prisma.learningActivityLog.count).mockResolvedValue(100);
      vi.mocked(prisma.learningActivityLog.groupBy)
        .mockResolvedValueOnce([
          { verb: 'viewed', _count: { id: 50 } },
          { verb: 'completed', _count: { id: 30 } },
        ] as any)
        .mockResolvedValueOnce([
          { objectType: 'lecture', _count: { id: 60 } },
          { objectType: 'course', _count: { id: 40 } },
        ] as any);

      const result = await activityLogService.getStats();

      expect(result.totalActivities).toBe(100);
      expect(result.activitiesByVerb.viewed).toBe(50);
      expect(result.activitiesByObjectType.lecture).toBe(60);
    });

    it('should apply courseId filter', async () => {
      vi.mocked(prisma.learningActivityLog.count).mockResolvedValue(10);
      vi.mocked(prisma.learningActivityLog.groupBy).mockResolvedValue([]);

      await activityLogService.getStats({ courseId: 1 });

      expect(prisma.learningActivityLog.count).toHaveBeenCalledWith({
        where: { courseId: 1 },
      });
    });

    it('should apply date range filters', async () => {
      vi.mocked(prisma.learningActivityLog.count).mockResolvedValue(5);
      vi.mocked(prisma.learningActivityLog.groupBy).mockResolvedValue([]);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      await activityLogService.getStats({ startDate, endDate });

      expect(prisma.learningActivityLog.count).toHaveBeenCalledWith({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
    });

    it('should apply endDate only filter', async () => {
      vi.mocked(prisma.learningActivityLog.count).mockResolvedValue(5);
      vi.mocked(prisma.learningActivityLog.groupBy).mockResolvedValue([]);

      const endDate = new Date('2024-12-31');
      await activityLogService.getStats({ endDate });

      expect(prisma.learningActivityLog.count).toHaveBeenCalledWith({
        where: {
          timestamp: {
            lte: endDate,
          },
        },
      });
    });
  });

  // ===========================================================================
  // exportToCsv
  // ===========================================================================

  describe('exportToCsv', () => {
    it('should export logs to CSV', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([mockActivityLog] as any);

      const csv = await activityLogService.exportToCsv({});

      expect(csv).toContain('id,timestamp,userId');
      expect(csv).toContain('1,');
    });

    it('should return message when no data', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([]);

      const csv = await activityLogService.exportToCsv({});

      expect(csv).toBe('No data to export');
    });

    it('should escape CSV special characters', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([
        { ...mockActivityLog, userFullname: 'User, "Test"' },
      ] as any);

      const csv = await activityLogService.exportToCsv({});

      expect(csv).toContain('"User, ""Test"""');
    });

    it('should apply date filters to CSV export', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([]);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      await activityLogService.exportToCsv({ startDate, endDate });

      expect(prisma.learningActivityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          },
        })
      );
    });

    it('should apply search filter to CSV export', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([]);

      await activityLogService.exportToCsv({ search: 'test' });

      expect(prisma.learningActivityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { userEmail: { contains: 'test' } },
              { userFullname: { contains: 'test' } },
            ]),
          }),
        })
      );
    });
  });

  // ===========================================================================
  // getFilterOptions
  // ===========================================================================

  describe('getFilterOptions', () => {
    it('should return filter options', async () => {
      vi.mocked(prisma.learningActivityLog.findMany)
        .mockResolvedValueOnce([{ userId: 1, userFullname: 'User 1', userEmail: 'user1@test.com' }] as any)
        .mockResolvedValueOnce([{ courseId: 1, courseTitle: 'Course 1' }] as any);
      vi.mocked(prisma.learningActivityLog.groupBy)
        .mockResolvedValueOnce([{ verb: 'viewed', _count: { id: 10 } }] as any)
        .mockResolvedValueOnce([{ objectType: 'lecture', _count: { id: 5 } }] as any);

      const result = await activityLogService.getFilterOptions();

      expect(result.users).toHaveLength(1);
      expect(result.courses).toHaveLength(1);
      expect(result.verbs).toHaveLength(1);
      expect(result.objectTypes).toHaveLength(1);
    });
  });

  // ===========================================================================
  // exportToExcel
  // ===========================================================================

  describe('exportToExcel', () => {
    it('should export logs to Excel buffer', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([mockActivityLog] as any);

      const buffer = await activityLogService.exportToExcel({});

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should apply filters to export', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([]);

      await activityLogService.exportToExcel({ userId: 1, courseId: 2 });

      expect(prisma.learningActivityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 1, courseId: 2 },
        })
      );
    });

    it('should apply date filters to export', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([]);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      await activityLogService.exportToExcel({ startDate, endDate });

      expect(prisma.learningActivityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          },
        })
      );
    });

    it('should apply startDate only filter', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([]);

      const startDate = new Date('2024-01-01');
      await activityLogService.exportToExcel({ startDate });

      expect(prisma.learningActivityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            timestamp: {
              gte: startDate,
            },
          },
        })
      );
    });

    it('should apply search filter to export', async () => {
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([]);

      await activityLogService.exportToExcel({ search: 'test' });

      expect(prisma.learningActivityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { userEmail: { contains: 'test' } },
              { userFullname: { contains: 'test' } },
              { objectTitle: { contains: 'test' } },
            ]),
          }),
        })
      );
    });
  });
});
