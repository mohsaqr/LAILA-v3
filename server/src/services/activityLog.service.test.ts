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
    $queryRawUnsafe: vi.fn(),
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
        verb: 'viewed',
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
  // logActivity — new object types
  // ===========================================================================

  describe('logActivity — new object types', () => {
    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.learningActivityLog.create).mockResolvedValue(mockActivityLog as any);
    });

    it('should log forum post (interacted/forum)', async () => {
      await activityLogService.logActivity({
        userId: 1,
        verb: 'interacted',
        objectType: 'forum',
        objectId: 42,
        extensions: { postType: 'reply', threadId: 10 },
      });

      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          verb: 'interacted',
          objectType: 'forum',
          objectId: 42,
          extensions: JSON.stringify({ postType: 'reply', threadId: 10 }),
        }),
      });
    });

    it('should log quiz started (started/quiz)', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);

      await activityLogService.logActivity({
        userId: 1,
        verb: 'started',
        objectType: 'quiz',
        objectId: 5,
        courseId: 1,
      });

      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          verb: 'started',
          objectType: 'quiz',
          objectId: 5,
        }),
      });
    });

    it('should log quiz submitted with score (submitted/quiz)', async () => {
      await activityLogService.logActivity({
        userId: 1,
        verb: 'submitted',
        objectType: 'quiz',
        objectId: 5,
        score: 8,
        maxScore: 10,
        success: true,
      });

      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          verb: 'submitted',
          objectType: 'quiz',
          score: 8,
          maxScore: 10,
          success: true,
        }),
      });
    });

    it('should log certificate viewed (viewed/certificate)', async () => {
      await activityLogService.logActivity({
        userId: 1,
        verb: 'viewed',
        objectType: 'certificate',
        objectId: 99,
      });

      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          verb: 'viewed',
          objectType: 'certificate',
          objectId: 99,
        }),
      });
    });

    it('should log certificate downloaded (downloaded/certificate)', async () => {
      await activityLogService.logActivity({
        userId: 1,
        verb: 'downloaded',
        objectType: 'certificate',
        objectId: 99,
      });

      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          verb: 'downloaded',
          objectType: 'certificate',
          objectId: 99,
        }),
      });
    });

    it('should log survey submitted with extensions (submitted/survey)', async () => {
      await activityLogService.logActivity({
        userId: 1,
        verb: 'submitted',
        objectType: 'survey',
        objectId: 7,
        extensions: { questionCount: 12, completionTime: 45 },
      });

      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          verb: 'submitted',
          objectType: 'survey',
          objectId: 7,
          extensions: JSON.stringify({ questionCount: 12, completionTime: 45 }),
        }),
      });
    });

    it('should log gradebook viewed with courseId only (viewed/gradebook)', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(mockCourse as any);

      await activityLogService.logActivity({
        userId: 1,
        verb: 'viewed',
        objectType: 'gradebook',
        courseId: 1,
      });

      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          verb: 'viewed',
          objectType: 'gradebook',
          courseTitle: 'Test Course',
        }),
      });
    });

    it('should log catalog viewed (viewed/course without objectId)', async () => {
      await activityLogService.logActivity({
        userId: 1,
        verb: 'viewed',
        objectType: 'course',
        objectTitle: 'Course Catalog',
      });

      expect(prisma.learningActivityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          verb: 'viewed',
          objectType: 'course',
          objectTitle: 'Course Catalog',
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

    it('restrictToUserId returns only that user, never the platform directory', async () => {
      // The distinct-scan branch (which would leak every user's email) must not
      // run; the user list is exactly the one requesting student.
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 42, fullname: 'Only Me', email: 'me@test.com',
      } as any);
      vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([] as any); // own courses
      vi.mocked(prisma.learningActivityLog.groupBy)
        .mockResolvedValueOnce([{ verb: 'viewed', _count: { id: 3 } }] as any)
        .mockResolvedValueOnce([{ objectType: 'lecture', _count: { id: 2 } }] as any);

      const result = await activityLogService.getFilterOptions({ restrictToUserId: 42, courseId: 999 });

      expect(result.users).toEqual([{ id: 42, fullname: 'Only Me', email: 'me@test.com' }]);
      // The enrollment/distinct-scan roster query is never issued for a student.
      expect(prisma.learningActivityLog.findMany).toHaveBeenCalledTimes(1);
      const call = vi.mocked(prisma.learningActivityLog.findMany).mock.calls[0][0] as any;
      expect(call.where).toMatchObject({ userId: 42 });
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

describe('getResourceMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const resourceRow = {
    objectType: 'lecture',
    objectTitle: 'Intro to TNA',
    objectId: 7,
    count: 40n,
    uniqueUsers: 12n,
    uniqueSessions: 20n,
    firstAccess: new Date('2026-08-01T10:00:00Z'),
    lastAccess: new Date('2026-08-07T09:30:00Z'),
    totalDuration: 3600n,
  };

  it('merges per-resource aggregates with the verb breakdown', async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([resourceRow] as any)
      .mockResolvedValueOnce([
        { objectType: 'lecture', objectTitle: 'Intro to TNA', objectId: 7, verb: 'viewed', count: 30n },
        { objectType: 'lecture', objectTitle: 'Intro to TNA', objectId: 7, verb: 'completed', count: 10n },
      ] as any);

    const result = await activityLogService.getResourceMetrics({ courseId: 3 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      objectType: 'lecture',
      objectTitle: 'Intro to TNA',
      objectId: 7,
      count: 40,
      uniqueUsers: 12,
      uniqueSessions: 20,
      totalDuration: 3600,
      verbCounts: { viewed: 30, completed: 10 },
    });
    expect(result.data[0].firstAccess).toBe(new Date('2026-08-01T10:00:00Z').getTime());
    expect(result.data[0].lastAccess).toBe(new Date('2026-08-07T09:30:00Z').getTime());
  });

  it('normalizes SQLite epoch-ms timestamps the same as Postgres Dates', async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([{ ...resourceRow, firstAccess: 1754042400000, lastAccess: 1754559000000 }] as any)
      .mockResolvedValueOnce([] as any);

    const result = await activityLogService.getResourceMetrics();

    expect(result.data[0].firstAccess).toBe(1754042400000);
    expect(result.data[0].lastAccess).toBe(1754559000000);
    expect(result.data[0].verbCounts).toEqual({});
  });

  it('excludes untitled rows via the WHERE clause and passes filters through', async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any);

    await activityLogService.getResourceMetrics({ courseId: 5, userId: 9, limit: 50 });

    const [sql, ...args] = vi.mocked(prisma.$queryRawUnsafe).mock.calls[0];
    expect(sql).toContain("object_title IS NOT NULL");
    expect(sql).toContain("object_title != ''");
    expect(sql).toContain('COUNT(DISTINCT user_id)');
    expect(args).toEqual([5, 9, 50]);

    // Second query reuses the same filters but must not receive the limit.
    const secondArgs = vi.mocked(prisma.$queryRawUnsafe).mock.calls[1].slice(1);
    expect(secondArgs).toEqual([5, 9]);
  });

  it('keeps resources with the same title but different ids separate', async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([
        { ...resourceRow, objectId: 1, count: 10n },
        { ...resourceRow, objectId: 2, count: 5n },
      ] as any)
      .mockResolvedValueOnce([
        { objectType: 'lecture', objectTitle: 'Intro to TNA', objectId: 1, verb: 'viewed', count: 10n },
        { objectType: 'lecture', objectTitle: 'Intro to TNA', objectId: 2, verb: 'started', count: 5n },
      ] as any);

    const result = await activityLogService.getResourceMetrics();

    expect(result.data[0].verbCounts).toEqual({ viewed: 10 });
    expect(result.data[1].verbCounts).toEqual({ started: 5 });
  });
});

describe('getResourceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes every query to the resource identity and assembles the drill-down', async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      // summary
      .mockResolvedValueOnce([{
        count: 25n, uniqueUsers: 8n, uniqueSessions: 12n,
        firstAccess: new Date('2026-08-01T00:00:00Z'), lastAccess: new Date('2026-08-07T00:00:00Z'),
        totalDuration: 900n,
      }] as any)
      // verbs
      .mockResolvedValueOnce([
        { verb: 'viewed', count: 20n },
        { verb: 'completed', count: 5n },
      ] as any)
      // top users
      .mockResolvedValueOnce([
        { userId: 119n, name: 'hamada', count: 9n },
      ] as any)
      // daily (getDailyCounts)
      .mockResolvedValueOnce([{ day: '2026-08-01', verb: 'viewed', count: 20n }] as any)
      // hourly (getHourlyCounts)
      .mockResolvedValueOnce([{ dow: 1n, hour: 10n, count: 7n }] as any);

    const result = await activityLogService.getResourceDetail({
      objectType: 'lecture', objectId: 7, objectTitle: 'Intro to TNA', courseId: 3,
    });

    expect(result.summary).toMatchObject({ count: 25, uniqueUsers: 8, uniqueSessions: 12, totalDuration: 900 });
    expect(result.verbCounts).toEqual({ viewed: 20, completed: 5 });
    expect(result.topUsers).toEqual([{ userId: 119, name: 'hamada', count: 9 }]);
    expect(result.daily.days).toEqual(['2026-08-01']);
    expect(result.hourly.data).toEqual([{ dow: 1, hour: 10, count: 7 }]);

    // Every query carries the resource filter
    for (const call of vi.mocked(prisma.$queryRawUnsafe).mock.calls) {
      const sql = call[0] as string;
      expect(sql).toContain('object_type =');
      expect(sql).toContain('object_id =');
      expect(sql).toContain('object_title =');
      expect(call.slice(1)).toEqual([3, 'lecture', 7, 'Intro to TNA']);
    }
  });

  it('matches rows with NULL object_id when objectId is explicitly null', async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([] as any);

    await activityLogService.getResourceDetail({ objectType: 'lab', objectId: null, objectTitle: 'TNA: model built' });

    const sql = vi.mocked(prisma.$queryRawUnsafe).mock.calls[0][0] as string;
    expect(sql).toContain('object_id IS NULL');
    expect(vi.mocked(prisma.$queryRawUnsafe).mock.calls[0].slice(1)).toEqual(['lab', 'TNA: model built']);
  });
});

describe('getUserDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assembles the per-user drill-down with the user filter on every query', async () => {
    vi.mocked(prisma.$queryRawUnsafe)
      // summary
      .mockResolvedValueOnce([{
        count: 100n, uniqueSessions: 30n, courses: 2n,
        firstAccess: 1754042400000, lastAccess: 1754559000000, totalDuration: 0,
      }] as any)
      // verb×objectType
      .mockResolvedValueOnce([
        { verb: 'viewed', objectType: 'lecture', count: 60n },
        { verb: 'messaged', objectType: 'chatbot', count: 40n },
      ] as any)
      // daily
      .mockResolvedValueOnce([{ day: '2026-08-01', verb: 'viewed', count: 60n }] as any)
      // hourly
      .mockResolvedValueOnce([{ dow: 2n, hour: 14n, count: 5n }] as any)
      // top resources
      .mockResolvedValueOnce([{
        objectType: 'lecture', objectTitle: 'Intro to TNA', objectId: 7,
        courseId: 3, lectureId: null, count: 60n, uniqueUsers: 1n,
      }] as any);

    const result = await activityLogService.getUserDetail({ userId: 119, courseId: 3 });

    expect(result.summary).toMatchObject({ count: 100, uniqueSessions: 30, courses: 2 });
    expect(result.verbObjectCounts).toEqual([
      { verb: 'viewed', objectType: 'lecture', count: 60 },
      { verb: 'messaged', objectType: 'chatbot', count: 40 },
    ]);
    expect(result.topResources[0]).toMatchObject({ objectTitle: 'Intro to TNA', courseId: 3 });

    for (const call of vi.mocked(prisma.$queryRawUnsafe).mock.calls) {
      expect(call[0]).toContain('user_id =');
      expect(call.slice(1, 3)).toEqual([3, 119]);
    }
  });
});

describe('getTopUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ranks users by activity and normalizes fields', async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([
      { userId: 25n, name: 'Abigail Adams', email: 'a@x.edu', count: 2039n, uniqueSessions: 189n, lastActive: 1772919011795 },
    ] as any);

    const result = await activityLogService.getTopUsers({ courseId: 3 });

    expect(result.data).toEqual([{
      userId: 25, name: 'Abigail Adams', email: 'a@x.edu',
      count: 2039, uniqueSessions: 189, lastActive: 1772919011795,
    }]);
    const [sql, ...args] = vi.mocked(prisma.$queryRawUnsafe).mock.calls[0];
    expect(sql).toContain('GROUP BY user_id');
    expect(sql).toContain('ORDER BY count DESC');
    expect(args).toEqual([3, 10]);
  });

  it('adds a name/email search condition with both placeholders', async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([] as any);

    await activityLogService.getTopUsers({ courseId: 3, search: 'adams', limit: 5 });

    const [sql, ...args] = vi.mocked(prisma.$queryRawUnsafe).mock.calls[0];
    expect(sql).toMatch(/user_fullname (I?LIKE) .+ OR user_email (I?LIKE)/);
    expect(args).toEqual([3, '%adams%', '%adams%', 5]);
  });
});

describe('getEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns slim events with ms timestamps and a name fallback', async () => {
    vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValueOnce([
      { userId: 25, userFullname: 'Abigail Adams', verb: 'viewed', objectType: 'lecture', objectTitle: 'Intro', timestamp: new Date(1772919011795) },
      { userId: 30, userFullname: null, verb: 'started', objectType: 'quiz', objectTitle: null, timestamp: new Date(1772919020000) },
    ] as any);

    const result = await activityLogService.getEvents({ courseId: 3 });

    expect(result.events).toEqual([
      { userId: 25, userName: 'Abigail Adams', verb: 'viewed', objectType: 'lecture', objectTitle: 'Intro', timestamp: 1772919011795 },
      { userId: 30, userName: 'User 30', verb: 'started', objectType: 'quiz', objectTitle: null, timestamp: 1772919020000 },
    ]);
    expect(result.truncated).toBe(false);
    expect(prisma.learningActivityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { courseId: 3 },
        orderBy: { timestamp: 'asc' },
        take: 50000,
      }),
    );
  });

  it('applies user and date filters and clamps the limit to 50k', async () => {
    vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValueOnce([] as any);

    const start = new Date('2026-01-01');
    const end = new Date('2026-02-01');
    await activityLogService.getEvents({ userId: 7, startDate: start, endDate: end, limit: 999999 });

    expect(prisma.learningActivityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7, timestamp: { gte: start, lte: end } },
        take: 50000,
      }),
    );
  });
});

describe('safeTimezone', () => {
  // `timezone` arrives raw from req.query and is the one caller-controlled
  // value that cannot be bound as a parameter — Postgres does not accept a
  // placeholder in `AT TIME ZONE`. It is therefore inlined into the only
  // $queryRawUnsafe statements in the codebase, so it must be validated here.
  //
  // This branch runs ONLY on Postgres; the SQLite path used in dev and CI
  // ignores the timezone entirely. Testing the function directly is the only
  // way to cover it locally.
  const safeTimezone = (tz?: string): string =>
    (activityLogService as any).safeTimezone(tz);

  it('passes through real IANA zones', () => {
    for (const tz of ['UTC', 'Europe/Helsinki', 'America/New_York', 'Asia/Riyadh']) {
      expect(safeTimezone(tz)).toBe(tz);
    }
  });

  it('defaults to UTC when absent or empty', () => {
    expect(safeTimezone(undefined)).toBe('UTC');
    expect(safeTimezone('')).toBe('UTC');
  });

  // Previously these reached Postgres, which rejects the whole statement and
  // turns a dashboard load into a 500.
  it('falls back to UTC for a nonsense zone rather than passing it to the database', () => {
    expect(safeTimezone('Not/AZone')).toBe('UTC');
    expect(safeTimezone('nonsense')).toBe('UTC');
  });

  // The old defence was `tz.replace(/'/g, '')`, which relies on
  // standard_conforming_strings being on to be sufficient. None of these
  // should survive validation regardless of database settings.
  it.each([
    "UTC'; DROP TABLE learning_activity_logs; --",
    "UTC' || (SELECT password_hash FROM users LIMIT 1) || '",
    'UTC--',
    'UTC/*x*/',
    "UTC\\'",
    'UTC; SELECT 1',
  ])('rejects SQL-bearing input: %s', (evil) => {
    expect(safeTimezone(evil)).toBe('UTC');
  });

  it('never returns a value containing SQL syntax characters', () => {
    const inputs = ["a'b", 'a;b', 'a--b', 'a b', 'a"b', 'a\\b', 'a(b)'];
    for (const input of inputs) {
      expect(safeTimezone(input)).toMatch(/^[A-Za-z0-9_+\-/]+$/);
    }
  });
});
