import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prerequisiteService } from './prerequisite.service.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    course: {
      findMany: vi.fn(),
    },
    coursePrerequisite: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  },
}));

// Mock the logger so createLogger doesn't touch real transports.
vi.mock('../utils/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import prisma from '../utils/prisma.js';

describe('PrerequisiteService - setPrerequisites cycle protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drops a prerequisite that would create a cycle (B already requires A)', async () => {
    // Course 1 wants prereq 2, but 2 already requires 1 -> adding 1->2 cycles.
    vi.mocked(prisma.course.findMany).mockResolvedValue([{ id: 2 }] as any);
    vi.mocked(prisma.coursePrerequisite.findMany).mockResolvedValue([
      { prerequisiteCourseId: 1 },
    ] as any);

    const result = await prerequisiteService.setPrerequisites(1, [2]);

    expect(result).toEqual([]);
    // No edge is written because the only candidate was cyclic.
    expect(prisma.coursePrerequisite.createMany).not.toHaveBeenCalled();
  });

  it('keeps a prerequisite that does not create a cycle', async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([{ id: 2 }] as any);
    // Course 2 has no prerequisites of its own -> no cycle.
    vi.mocked(prisma.coursePrerequisite.findMany).mockResolvedValue([] as any);

    const result = await prerequisiteService.setPrerequisites(1, [2]);

    expect(result).toEqual([2]);
    expect(prisma.coursePrerequisite.createMany).toHaveBeenCalled();
  });

  it('terminates on pre-existing cyclic data instead of overflowing the stack', async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([{ id: 2 }] as any);
    // Simulate a cycle that does NOT pass through course 1: 2 -> 3 -> 2 -> ...
    // Without the visited-set guard this recurses forever.
    vi.mocked(prisma.coursePrerequisite.findMany).mockImplementation(((args: any) => {
      const courseId = args?.where?.courseId;
      if (courseId === 2) return Promise.resolve([{ prerequisiteCourseId: 3 }]);
      if (courseId === 3) return Promise.resolve([{ prerequisiteCourseId: 2 }]);
      return Promise.resolve([]);
    }) as any);

    // Just needs to resolve (no stack overflow); 2 is not cyclic w.r.t. 1.
    const result = await prerequisiteService.setPrerequisites(1, [2]);

    expect(result).toEqual([2]);
  });
});
