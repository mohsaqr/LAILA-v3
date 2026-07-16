import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    customLab: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    labTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    labAssignment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
    },
    assignment: {
      create: vi.fn(),
    },
    chatbot: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from '../utils/prisma.js';
import { customLabService } from './customLab.service.js';

const OWNER = 7;

const mockOwnedLab = (extra: Record<string, unknown> = {}) => {
  vi.mocked(prisma.customLab.findUnique).mockResolvedValue({
    id: 20,
    createdBy: OWNER,
    isPublic: false,
    name: 'R lab',
    description: null,
    labType: 'tna',
    config: null,
    aiChatbotId: null,
    ...extra,
  } as any);
};

describe('CustomLabService - reorderTemplates id validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOwnedLab();
    vi.mocked(prisma.labTemplate.findMany).mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ] as any);
  });

  it('rejects ids from another lab', async () => {
    await expect(
      customLabService.reorderTemplates(20, OWNER, [1, 2, 999])
    ).rejects.toThrow(/must match/);
  });

  it('rejects duplicate ids', async () => {
    await expect(
      customLabService.reorderTemplates(20, OWNER, [1, 2, 2])
    ).rejects.toThrow(/must match/);
  });

  it('rejects partial lists', async () => {
    await expect(customLabService.reorderTemplates(20, OWNER, [1, 2])).rejects.toThrow(
      /must match/
    );
  });

  it('applies an exact permutation transactionally', async () => {
    vi.mocked(prisma.$transaction).mockResolvedValue([] as any);
    await expect(
      customLabService.reorderTemplates(20, OWNER, [3, 1, 2])
    ).resolves.toMatchObject({ message: expect.stringContaining('reordered') });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('CustomLabService - addTemplate position insert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOwnedLab();
    vi.mocked(prisma.labTemplate.findFirst).mockResolvedValue({ orderIndex: 4 } as any);
  });

  it('shifts later cells and lands the new cell at the requested position', async () => {
    const tx = {
      labTemplate: {
        updateMany: vi.fn().mockResolvedValue({ count: 3 }),
        create: vi.fn().mockResolvedValue({ id: 99, orderIndex: 2 }),
      },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(tx));

    const created = await customLabService.addTemplate(20, OWNER, {
      title: 'New cell',
      code: 'x <- 1',
      position: 2,
    });

    expect(tx.labTemplate.updateMany).toHaveBeenCalledWith({
      where: { labId: 20, orderIndex: { gte: 2 } },
      data: { orderIndex: { increment: 1 } },
    });
    expect(tx.labTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderIndex: 2 }) })
    );
    expect(created).toMatchObject({ id: 99 });
  });

  it('appends without shifting when no position is given', async () => {
    const tx = {
      labTemplate: {
        updateMany: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 100, orderIndex: 5 }),
      },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(tx));

    await customLabService.addTemplate(20, OWNER, { title: 'Tail', code: 'y <- 2' });

    expect(tx.labTemplate.updateMany).not.toHaveBeenCalled();
    expect(tx.labTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderIndex: 5 }) })
    );
  });
});

describe('CustomLabService - duplicateLab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.customLab.findUnique).mockResolvedValue({
      id: 20,
      createdBy: OWNER,
      isPublic: true,
      name: 'R lab',
      description: 'desc',
      labType: 'tna',
      config: '{"a":1}',
      aiChatbotId: 3,
      templates: [
        { id: 1, title: 'A', description: 'd', code: 'x', orderIndex: 0, locked: true, cellType: 'code' },
        { id: 2, title: 'B', description: null, code: '', orderIndex: 1, locked: false, cellType: 'markdown' },
      ],
    } as any);
  });

  it('copies every cell preserving locked/cellType/order, forces private, reassigns owner', async () => {
    const tx = {
      customLab: { create: vi.fn().mockResolvedValue({ id: 21 }) },
      labTemplate: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(tx));

    const CALLER = 42; // an admin duplicating someone else's lab
    await customLabService.duplicateLab(20, CALLER, true);

    expect(tx.customLab.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'R lab (copy)',
          isPublic: false,
          createdBy: CALLER,
          aiChatbotId: 3,
        }),
      })
    );
    expect(tx.labTemplate.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ labId: 21, locked: true, cellType: 'code', orderIndex: 0 }),
        expect.objectContaining({ labId: 21, locked: false, cellType: 'markdown', orderIndex: 1 }),
      ],
    });
  });
});

describe('CustomLabService - assignToCourse duplicate guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOwnedLab();
    vi.mocked(prisma.course.findUnique).mockResolvedValue({
      id: 5,
      instructorId: OWNER,
    } as any);
  });

  it('rejects assigning the same lab to the same course twice', async () => {
    vi.mocked(prisma.labAssignment.findFirst).mockResolvedValue({ id: 11 } as any);

    await expect(customLabService.assignToCourse(20, 5, null, OWNER)).rejects.toThrow(
      /already assigned/
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates a linked Assignment when config is provided', async () => {
    vi.mocked(prisma.labAssignment.findFirst).mockResolvedValue(null);
    const tx = {
      assignment: { create: vi.fn().mockResolvedValue({ id: 77 }) },
      labAssignment: { create: vi.fn().mockResolvedValue({ id: 12, assignmentId: 77 }) },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(tx));

    await customLabService.assignToCourse(20, 5, null, OWNER, false, {
      prompt: 'Do the lab',
      points: 50,
    });

    expect(tx.assignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ courseId: 5, points: 50, isPublished: true }),
      })
    );
    expect(tx.labAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignmentId: 77 }) })
    );
  });

  it('creates a bare attachment (no Assignment) without config', async () => {
    vi.mocked(prisma.labAssignment.findFirst).mockResolvedValue(null);
    const tx = {
      assignment: { create: vi.fn() },
      labAssignment: { create: vi.fn().mockResolvedValue({ id: 13, assignmentId: null }) },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(tx));

    await customLabService.assignToCourse(20, 5, null, OWNER);

    expect(tx.assignment.create).not.toHaveBeenCalled();
    expect(tx.labAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignmentId: null }) })
    );
  });
});
