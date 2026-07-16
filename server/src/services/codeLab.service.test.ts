import { describe, it, expect, vi, beforeEach } from 'vitest';
import { codeLabService } from './codeLab.service.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    courseModule: {
      findUnique: vi.fn(),
    },
    codeLab: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    codeBlock: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock the team-membership lookup (avoids a real courseRole query).
vi.mock('./courseRole.service.js', () => ({
  courseRoleService: {
    isTeamMember: vi.fn(),
  },
}));

import prisma from '../utils/prisma.js';
import { courseRoleService } from './courseRole.service.js';

describe('CodeLabService - getCodeLabsForModule publish/availability gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.courseModule.findUnique).mockResolvedValue({
      id: 5,
      course: { id: 10, instructorId: 1 },
    } as any);
    vi.mocked(prisma.codeLab.findMany).mockResolvedValue([] as any);
  });

  it('restricts an enrolled student to published, in-window labs', async () => {
    vi.mocked(courseRoleService.isTeamMember).mockResolvedValue(false);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);

    // userId set, not admin, not instructor -> student path.
    await codeLabService.getCodeLabsForModule(5, 99, false, false);

    expect(prisma.codeLab.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ moduleId: 5, isPublished: true }),
      }),
    );
  });

  it('lets an instructor see drafts (no isPublished filter)', async () => {
    await codeLabService.getCodeLabsForModule(5, 1, true, false);

    const call = vi.mocked(prisma.codeLab.findMany).mock.calls[0][0] as any;
    expect(call.where.moduleId).toBe(5);
    expect(call.where.isPublished).toBeUndefined();
  });

  it('lets a team member see drafts (no isPublished filter)', async () => {
    vi.mocked(courseRoleService.isTeamMember).mockResolvedValue(true);

    await codeLabService.getCodeLabsForModule(5, 50, false, false);

    const call = vi.mocked(prisma.codeLab.findMany).mock.calls[0][0] as any;
    expect(call.where.isPublished).toBeUndefined();
  });
});

describe('CodeLabService - reorderCodeBlocks id validation', () => {
  const asAdmin = true; // skips the ownership walk so the test isolates validation

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.codeLab.findUnique).mockResolvedValue({
      id: 7,
      module: { course: { id: 1, instructorId: 1 } },
    } as any);
    vi.mocked(prisma.codeBlock.findMany).mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ] as any);
  });

  it('rejects ids belonging to another lab', async () => {
    await expect(
      codeLabService.reorderCodeBlocks(7, 1, [1, 2, 999], asAdmin)
    ).rejects.toThrow(/must match/);
  });

  it('rejects duplicate ids', async () => {
    await expect(
      codeLabService.reorderCodeBlocks(7, 1, [1, 2, 2], asAdmin)
    ).rejects.toThrow(/must match/);
  });

  it('rejects omissions (partial lists)', async () => {
    await expect(
      codeLabService.reorderCodeBlocks(7, 1, [1, 2], asAdmin)
    ).rejects.toThrow(/must match/);
  });

  it('accepts an exact permutation', async () => {
    const tx = vi.fn().mockResolvedValue([]);
    (prisma as any).$transaction = tx;
    await expect(
      codeLabService.reorderCodeBlocks(7, 1, [3, 1, 2], asAdmin)
    ).resolves.toMatchObject({ message: expect.stringContaining('reordered') });
    expect(tx).toHaveBeenCalledTimes(1);
  });
});
