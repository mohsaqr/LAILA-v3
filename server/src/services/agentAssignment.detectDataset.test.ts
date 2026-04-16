import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentAssignmentService } from './agentAssignment.service.js';
import prisma from '../utils/prisma.js';

vi.mock('../utils/prisma.js', () => ({
  default: {
    userDataset: { create: vi.fn() },
  },
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

const mockedPrisma = prisma as unknown as {
  userDataset: { create: ReturnType<typeof vi.fn> };
};

describe('agentAssignmentService.detectAndSaveDataset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPrisma.userDataset.create.mockResolvedValue({ id: 1 });
  });

  const config = { id: 42, assignmentId: 7, agentName: 'Ada' };
  const validCsvResponse =
    'Here is your data:\n\n```csv\nname,age\nAlice,30\nBob,25\n```\nEnjoy.';

  it('persists the user prompt that triggered the CSV generation', async () => {
    const userPrompt = 'Generate a 2-row dataset of names and ages';

    // detectAndSaveDataset is private — cast to any to invoke it directly so
    // the test does not depend on the full sendTestMessage mock surface.
    await (agentAssignmentService as any).detectAndSaveDataset(
      validCsvResponse,
      config,
      11,
      'gpt-4o',
      'openai',
      userPrompt
    );

    expect(mockedPrisma.userDataset.create).toHaveBeenCalledTimes(1);
    const callArg = mockedPrisma.userDataset.create.mock.calls[0][0];
    expect(callArg.data.userPrompt).toBe(userPrompt);
    expect(callArg.data.userId).toBe(11);
    expect(callArg.data.agentConfigId).toBe(42);
    expect(callArg.data.fileType).toBe('text/csv');
  });

  it('falls back to null when no user prompt is provided', async () => {
    await (agentAssignmentService as any).detectAndSaveDataset(
      validCsvResponse,
      config,
      11,
      'gpt-4o',
      'openai'
    );

    expect(mockedPrisma.userDataset.create).toHaveBeenCalledTimes(1);
    expect(
      mockedPrisma.userDataset.create.mock.calls[0][0].data.userPrompt
    ).toBeNull();
  });

  it('does not persist anything when the response has no CSV block', async () => {
    await (agentAssignmentService as any).detectAndSaveDataset(
      'Just a plain response with no code block.',
      config,
      11,
      'gpt-4o',
      'openai',
      'irrelevant prompt'
    );

    expect(mockedPrisma.userDataset.create).not.toHaveBeenCalled();
  });
});
