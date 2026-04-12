import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentAssignmentService } from './agentAssignment.service.js';
import prisma from '../utils/prisma.js';

vi.mock('../utils/prisma.js', () => ({
  default: {
    assignment: { findUnique: vi.fn() },
    studentAgentConfig: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    assignmentSubmission: { findUnique: vi.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  assignment: { findUnique: ReturnType<typeof vi.fn> };
  studentAgentConfig: { findMany: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
  assignmentSubmission: { findUnique: ReturnType<typeof vi.fn> };
};

describe('agentAssignmentService.getAgentSubmissions — conversation count filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPrisma.assignment.findUnique.mockResolvedValue({
      id: 1,
      submissionType: 'ai_agent',
      course: { id: 10, title: 'Course', instructorId: 42 },
    });
    mockedPrisma.studentAgentConfig.findMany.mockResolvedValue([]);
    mockedPrisma.user.findMany.mockResolvedValue([]);
  });

  it('counts only test conversations with at least one message in submissions list', async () => {
    await agentAssignmentService.getAgentSubmissions(1, 42);

    expect(mockedPrisma.studentAgentConfig.findMany).toHaveBeenCalledTimes(1);
    const call = mockedPrisma.studentAgentConfig.findMany.mock.calls[0][0];
    expect(call.include._count.select.testConversations).toEqual({
      where: { messages: { some: {} } },
    });
  });

  it('applies the same filter to the submission-detail endpoint', async () => {
    mockedPrisma.assignmentSubmission.findUnique.mockResolvedValue({
      id: 5,
      agentConfig: { id: 7, dosRules: null, dontsRules: null, _count: { testConversations: 0 } },
      user: { id: 1, fullname: 'Test', email: 'test@example.com' },
    });

    await agentAssignmentService.getAgentSubmissionDetail(1, 5, 42);

    const call = mockedPrisma.assignmentSubmission.findUnique.mock.calls[0][0];
    expect(
      call.include.agentConfig.include._count.select.testConversations
    ).toEqual({ where: { messages: { some: {} } } });
  });
});
