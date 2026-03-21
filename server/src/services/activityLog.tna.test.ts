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
      { userId: 2, verb: 'viewed', timestamp: new Date('2024-01-01T09:00:00Z'), courseTitle: 'Course A' },
      { userId: 2, verb: 'viewed', timestamp: new Date('2024-01-01T10:00:00Z'), courseTitle: 'Course A' },
      { userId: 2, verb: 'submitted', timestamp: new Date('2024-01-01T12:00:00Z'), courseTitle: 'Course A' },
    ] as any);

    const result = await activityLogService.getTnaSequences({ minVerbPct: 0 });

    expect(result.sequences).toHaveLength(2);
    expect(result.sequences).toContainEqual(['viewed', 'completed']);
    expect(result.sequences).toContainEqual(['viewed', 'viewed', 'submitted']);
    expect(result.metadata.totalSequences).toBe(2);
    expect(result.metadata.totalEvents).toBe(5);
  });

  it('should filter out sequences shorter than minSequenceLength', async () => {
    vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([
      { userId: 1, verb: 'viewed', timestamp: new Date('2024-01-01T10:00:00Z'), courseTitle: null },
      { userId: 2, verb: 'viewed', timestamp: new Date('2024-01-01T09:00:00Z'), courseTitle: null },
      { userId: 2, verb: 'viewed', timestamp: new Date('2024-01-01T10:00:00Z'), courseTitle: null },
      { userId: 2, verb: 'submitted', timestamp: new Date('2024-01-01T12:00:00Z'), courseTitle: null },
    ] as any);

    // Default minSequenceLength is 2, so user 1 with only 1 event is excluded
    const result = await activityLogService.getTnaSequences({ minVerbPct: 0 });

    expect(result.sequences).toHaveLength(1);
    expect(result.sequences[0]).toEqual(['viewed', 'viewed', 'submitted']);
    expect(result.metadata.totalSequences).toBe(1);
  });

  it('should respect custom minSequenceLength', async () => {
    vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([
      { userId: 1, verb: 'viewed', timestamp: new Date('2024-01-01T10:00:00Z'), courseTitle: null },
      { userId: 1, verb: 'completed', timestamp: new Date('2024-01-01T11:00:00Z'), courseTitle: null },
      { userId: 2, verb: 'viewed', timestamp: new Date('2024-01-01T09:00:00Z'), courseTitle: null },
      { userId: 2, verb: 'viewed', timestamp: new Date('2024-01-01T10:00:00Z'), courseTitle: null },
      { userId: 2, verb: 'submitted', timestamp: new Date('2024-01-01T12:00:00Z'), courseTitle: null },
    ] as any);

    const result = await activityLogService.getTnaSequences({ minSequenceLength: 3, minVerbPct: 0 });

    expect(result.sequences).toHaveLength(1);
    expect(result.sequences[0]).toEqual(['viewed', 'viewed', 'submitted']);
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
    expect(result.metadata.totalSequences).toBe(0);
    expect(result.metadata.totalEvents).toBe(0);
    expect(result.metadata.uniqueVerbs).toEqual([]);
    expect(result.metadata.dateRange).toBeNull();
    expect(result.metadata.courseTitle).toBeNull();
  });

  it('should pass verbs through unchanged (no merges)', async () => {
    vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([
      { userId: 1, verb: 'viewed', timestamp: new Date('2024-01-01T10:00:00Z'), courseTitle: 'C' },
      { userId: 1, verb: 'interacted', timestamp: new Date('2024-01-01T10:01:00Z'), courseTitle: 'C' },
      { userId: 1, verb: 'submitted', timestamp: new Date('2024-01-01T10:02:00Z'), courseTitle: 'C' },
      { userId: 1, verb: 'progressed', timestamp: new Date('2024-01-01T10:03:00Z'), courseTitle: 'C' },
      { userId: 1, verb: 'downloaded', timestamp: new Date('2024-01-01T10:04:00Z'), courseTitle: 'C' },
    ] as any);

    const result = await activityLogService.getTnaSequences({ minVerbPct: 0 });

    expect(result.sequences[0]).toEqual(['viewed', 'interacted', 'submitted', 'progressed', 'downloaded']);
  });

  it('should replace rare verbs with "other" when minVerbPct threshold is set', async () => {
    // 10 events: viewed=5 (50%), completed=3 (30%), downloaded=1 (10%), selected=1 (10%)
    vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([
      { userId: 1, verb: 'viewed', timestamp: new Date('2024-01-01T10:00:00Z'), courseTitle: 'C' },
      { userId: 1, verb: 'viewed', timestamp: new Date('2024-01-01T10:01:00Z'), courseTitle: 'C' },
      { userId: 1, verb: 'viewed', timestamp: new Date('2024-01-01T10:02:00Z'), courseTitle: 'C' },
      { userId: 1, verb: 'viewed', timestamp: new Date('2024-01-01T10:03:00Z'), courseTitle: 'C' },
      { userId: 1, verb: 'viewed', timestamp: new Date('2024-01-01T10:04:00Z'), courseTitle: 'C' },
      { userId: 1, verb: 'completed', timestamp: new Date('2024-01-01T10:05:00Z'), courseTitle: 'C' },
      { userId: 1, verb: 'completed', timestamp: new Date('2024-01-01T10:06:00Z'), courseTitle: 'C' },
      { userId: 1, verb: 'completed', timestamp: new Date('2024-01-01T10:07:00Z'), courseTitle: 'C' },
      { userId: 1, verb: 'downloaded', timestamp: new Date('2024-01-01T10:08:00Z'), courseTitle: 'C' },
      { userId: 1, verb: 'selected', timestamp: new Date('2024-01-01T10:09:00Z'), courseTitle: 'C' },
    ] as any);

    // 20% threshold: downloaded (10%) and selected (10%) should become "other"
    const result = await activityLogService.getTnaSequences({ minVerbPct: 0.2 });

    expect(result.sequences[0]).toEqual([
      'viewed', 'viewed', 'viewed', 'viewed', 'viewed',
      'completed', 'completed', 'completed',
      'other', 'other',
    ]);
    expect(result.metadata.uniqueVerbs).toContain('other');
    expect(result.metadata.uniqueVerbs).not.toContain('downloaded');
    expect(result.metadata.uniqueVerbs).not.toContain('selected');
  });
});
