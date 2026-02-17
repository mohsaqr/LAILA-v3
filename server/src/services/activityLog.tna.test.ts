import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../utils/prisma.js';
import { activityLogService } from './activityLog.service.js';

vi.mock('../utils/prisma.js', () => ({
  default: {
    learningActivityLog: {
      findMany: vi.fn(),
    },
  },
}));

describe('activityLogService.getTnaSequences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should group logs by userId into verb sequences', async () => {
    vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([
      { userId: 1, verb: 'viewed', timestamp: new Date('2024-01-01T10:00:00Z'), courseTitle: 'Course A' },
      { userId: 1, verb: 'completed', timestamp: new Date('2024-01-01T11:00:00Z'), courseTitle: 'Course A' },
      { userId: 2, verb: 'enrolled', timestamp: new Date('2024-01-01T09:00:00Z'), courseTitle: 'Course A' },
      { userId: 2, verb: 'viewed', timestamp: new Date('2024-01-01T10:00:00Z'), courseTitle: 'Course A' },
      { userId: 2, verb: 'submitted', timestamp: new Date('2024-01-01T12:00:00Z'), courseTitle: 'Course A' },
    ] as any);

    const result = await activityLogService.getTnaSequences();

    expect(result.sequences).toHaveLength(2);
    expect(result.sequences).toContainEqual(['viewed', 'completed']);
    expect(result.sequences).toContainEqual(['enrolled', 'viewed', 'submitted']);
    expect(result.metadata.totalUsers).toBe(2);
    expect(result.metadata.totalEvents).toBe(5);
    expect(result.metadata.uniqueVerbs).toEqual(['completed', 'enrolled', 'submitted', 'viewed']);
  });

  it('should filter out sequences shorter than minSequenceLength', async () => {
    vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([
      { userId: 1, verb: 'viewed', timestamp: new Date('2024-01-01T10:00:00Z'), courseTitle: null },
      { userId: 2, verb: 'enrolled', timestamp: new Date('2024-01-01T09:00:00Z'), courseTitle: null },
      { userId: 2, verb: 'viewed', timestamp: new Date('2024-01-01T10:00:00Z'), courseTitle: null },
      { userId: 2, verb: 'submitted', timestamp: new Date('2024-01-01T12:00:00Z'), courseTitle: null },
    ] as any);

    // Default minSequenceLength is 2, so user 1 with only 1 event is excluded
    const result = await activityLogService.getTnaSequences();

    expect(result.sequences).toHaveLength(1);
    expect(result.sequences[0]).toEqual(['enrolled', 'viewed', 'submitted']);
    expect(result.metadata.totalUsers).toBe(1);
  });

  it('should respect custom minSequenceLength', async () => {
    vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([
      { userId: 1, verb: 'viewed', timestamp: new Date('2024-01-01T10:00:00Z'), courseTitle: null },
      { userId: 1, verb: 'completed', timestamp: new Date('2024-01-01T11:00:00Z'), courseTitle: null },
      { userId: 2, verb: 'enrolled', timestamp: new Date('2024-01-01T09:00:00Z'), courseTitle: null },
      { userId: 2, verb: 'viewed', timestamp: new Date('2024-01-01T10:00:00Z'), courseTitle: null },
      { userId: 2, verb: 'submitted', timestamp: new Date('2024-01-01T12:00:00Z'), courseTitle: null },
    ] as any);

    const result = await activityLogService.getTnaSequences({ minSequenceLength: 3 });

    expect(result.sequences).toHaveLength(1);
    expect(result.sequences[0]).toEqual(['enrolled', 'viewed', 'submitted']);
  });

  it('should pass filters to prisma query', async () => {
    vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([]);

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');

    await activityLogService.getTnaSequences({
      courseId: 5,
      startDate,
      endDate,
    });

    expect(prisma.learningActivityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          courseId: 5,
          timestamp: { gte: startDate, lte: endDate },
        },
      })
    );
  });

  it('should return empty results when no logs exist', async () => {
    vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([]);

    const result = await activityLogService.getTnaSequences();

    expect(result.sequences).toHaveLength(0);
    expect(result.metadata.totalUsers).toBe(0);
    expect(result.metadata.totalEvents).toBe(0);
    expect(result.metadata.uniqueVerbs).toEqual([]);
    expect(result.metadata.dateRange).toBeNull();
    expect(result.metadata.courseTitle).toBeNull();
  });
});
