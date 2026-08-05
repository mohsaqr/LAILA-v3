import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The student's path through an AI-agent assignment:
 *
 *   create config -> edit -> submit -> (unsubmit -> edit -> submit) -> graded
 *
 * Every guard here has to hold on the SERVER. The builder hides the buttons
 * that would break these rules, but a hidden button is not a rule — the client
 * is where the student is, not where the record lives.
 */

vi.mock('../utils/prisma.js', () => ({
  default: {
    assignment: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    studentAgentConfig: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    assignmentSubmission: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock('./courseRole.service.js', () => ({
  courseRoleService: { isCourseStaff: vi.fn().mockResolvedValue(false) },
}));

vi.mock('./agentAnalytics.service.js', () => ({
  agentAnalyticsService: {
    createConfigSnapshot: vi.fn().mockReturnValue({}),
    logConfigurationChange: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./activityLog.service.js', () => ({ activityLogService: { log: vi.fn() } }));
vi.mock('./llm.service.js', () => ({ llmService: {} }));

import { agentAssignmentService } from './agentAssignment.service.js';
import prismaClient from '../utils/prisma.js';

const prisma = prismaClient as any;

const STUDENT = 1234;
const COURSE_ID = 3;
const ASSIGNMENT_ID = 23;

const HOUR = 60 * 60 * 1000;
const past = (ms: number) => new Date(Date.now() - ms);
const future = (ms: number) => new Date(Date.now() + ms);

const assignment = (over: Record<string, unknown> = {}) => ({
  id: ASSIGNMENT_ID,
  title: 'AI assignment',
  courseId: COURSE_ID,
  submissionType: 'ai_agent',
  points: 100,
  dueDate: null,
  gracePeriodDeadline: null,
  course: { id: COURSE_ID, title: 'Summer Course', instructorId: 6 },
  ...over,
});

const config = (over: Record<string, unknown> = {}) => ({
  id: 55,
  assignmentId: ASSIGNMENT_ID,
  userId: STUDENT,
  agentName: 'Bio Buddy',
  systemPrompt: 'a valid system prompt',
  version: 1,
  isDraft: true,
  submission: null,
  ...over,
});

const ctx = { userId: STUDENT } as any;
const INPUT = { agentName: 'Bio Buddy', systemPrompt: 'a valid system prompt' } as any;

beforeEach(() => {
  vi.clearAllMocks();
  prisma.assignment.findUnique.mockResolvedValue(assignment());
  prisma.enrollment.findUnique.mockResolvedValue({ id: 1, userId: STUDENT, courseId: COURSE_ID });
  prisma.studentAgentConfig.findUnique.mockResolvedValue(null);
  prisma.studentAgentConfig.create.mockResolvedValue(config());
  prisma.studentAgentConfig.update.mockImplementation(async ({ data }: any) => config(data));
  prisma.assignmentSubmission.findUnique.mockResolvedValue(null);
  prisma.assignmentSubmission.upsert.mockResolvedValue({ id: 77, status: 'submitted' });
  prisma.assignmentSubmission.create.mockResolvedValue({ id: 77, status: 'submitted' });
  prisma.assignmentSubmission.update.mockResolvedValue({ id: 77, status: 'draft' });
});

describe('creating the config', () => {
  it('an enrolled student can create one', async () => {
    await expect(
      agentAssignmentService.createAgentConfig(ASSIGNMENT_ID, STUDENT, INPUT, ctx)
    ).resolves.toBeTruthy();
  });

  it('refuses a second config for the same student', async () => {
    prisma.studentAgentConfig.findUnique.mockResolvedValue(config());
    await expect(
      agentAssignmentService.createAgentConfig(ASSIGNMENT_ID, STUDENT, INPUT, ctx)
    ).rejects.toThrow(/already exists/i);
  });

  it('refuses on an assignment that is not an agent assignment', async () => {
    prisma.assignment.findUnique.mockResolvedValue(assignment({ submissionType: 'file' }));
    await expect(
      agentAssignmentService.createAgentConfig(ASSIGNMENT_ID, STUDENT, INPUT, ctx)
    ).rejects.toThrow(/not an AI agent assignment/i);
  });

  it('404s on an assignment that does not exist', async () => {
    prisma.assignment.findUnique.mockResolvedValue(null);
    await expect(
      agentAssignmentService.createAgentConfig(ASSIGNMENT_ID, STUDENT, INPUT, ctx)
    ).rejects.toThrow(/not found/i);
  });
});

describe('editing the config', () => {
  it('can be edited while it is a draft', async () => {
    prisma.studentAgentConfig.findUnique.mockResolvedValue(config({ isDraft: true }));
    await expect(
      agentAssignmentService.updateAgentConfig(ASSIGNMENT_ID, STUDENT, INPUT, ctx)
    ).resolves.toBeTruthy();
  });

  it('CANNOT be edited once submitted — the record is what was graded', async () => {
    prisma.studentAgentConfig.findUnique.mockResolvedValue(config({ isDraft: false }));
    await expect(
      agentAssignmentService.updateAgentConfig(ASSIGNMENT_ID, STUDENT, INPUT, ctx)
    ).rejects.toThrow(/Cannot update a submitted agent/i);
    expect(prisma.studentAgentConfig.update).not.toHaveBeenCalled();
  });

  it('404s when there is nothing to update', async () => {
    prisma.studentAgentConfig.findUnique.mockResolvedValue(null);
    await expect(
      agentAssignmentService.updateAgentConfig(ASSIGNMENT_ID, STUDENT, INPUT, ctx)
    ).rejects.toThrow(/not found/i);
  });

  it('bumps the version on every save, so the design history stays ordered', async () => {
    prisma.studentAgentConfig.findUnique.mockResolvedValue(config({ version: 4 }));
    await agentAssignmentService.updateAgentConfig(ASSIGNMENT_ID, STUDENT, INPUT, ctx);
    expect(prisma.studentAgentConfig.update.mock.calls[0][0].data.version).toBe(5);
  });
});

describe('submitting', () => {
  beforeEach(() => {
    prisma.studentAgentConfig.findUnique.mockResolvedValue(config({ isDraft: true }));
  });

  it('a draft can be submitted', async () => {
    await expect(
      agentAssignmentService.submitAgentConfig(ASSIGNMENT_ID, STUDENT, ctx)
    ).resolves.toBeTruthy();
  });

  it('refuses to submit twice', async () => {
    prisma.studentAgentConfig.findUnique.mockResolvedValue(config({ isDraft: false }));
    await expect(
      agentAssignmentService.submitAgentConfig(ASSIGNMENT_ID, STUDENT, ctx)
    ).rejects.toThrow(/already submitted/i);
  });

  it('404s when there is no config to submit', async () => {
    prisma.studentAgentConfig.findUnique.mockResolvedValue(null);
    await expect(
      agentAssignmentService.submitAgentConfig(ASSIGNMENT_ID, STUDENT, ctx)
    ).rejects.toThrow(/not found/i);
  });

  describe('due dates', () => {
    it('accepts a submission before the due date', async () => {
      prisma.assignment.findUnique.mockResolvedValue(assignment({ dueDate: future(HOUR) }));
      await expect(
        agentAssignmentService.submitAgentConfig(ASSIGNMENT_ID, STUDENT, ctx)
      ).resolves.toBeTruthy();
    });

    it('refuses after the due date when there is no grace period', async () => {
      prisma.assignment.findUnique.mockResolvedValue(assignment({ dueDate: past(HOUR) }));
      await expect(
        agentAssignmentService.submitAgentConfig(ASSIGNMENT_ID, STUDENT, ctx)
      ).rejects.toThrow(/due date has passed/i);
    });

    it('accepts inside the grace period', async () => {
      prisma.assignment.findUnique.mockResolvedValue(
        assignment({ dueDate: past(HOUR), gracePeriodDeadline: future(HOUR) })
      );
      await expect(
        agentAssignmentService.submitAgentConfig(ASSIGNMENT_ID, STUDENT, ctx)
      ).resolves.toBeTruthy();
    });

    it('refuses once the grace period is also gone', async () => {
      prisma.assignment.findUnique.mockResolvedValue(
        assignment({ dueDate: past(2 * HOUR), gracePeriodDeadline: past(HOUR) })
      );
      await expect(
        agentAssignmentService.submitAgentConfig(ASSIGNMENT_ID, STUDENT, ctx)
      ).rejects.toThrow(/grace period deadline has passed/i);
    });
  });
});

describe('unsubmitting', () => {
  it('a submitted, ungraded agent can be pulled back', async () => {
    prisma.studentAgentConfig.findUnique.mockResolvedValue(
      config({ isDraft: false, submission: { id: 77, status: 'submitted' } })
    );
    await expect(
      agentAssignmentService.unsubmitAgentConfig(ASSIGNMENT_ID, STUDENT, ctx)
    ).resolves.toBeTruthy();
  });

  it('refuses when it was never submitted', async () => {
    prisma.studentAgentConfig.findUnique.mockResolvedValue(config({ isDraft: true }));
    await expect(
      agentAssignmentService.unsubmitAgentConfig(ASSIGNMENT_ID, STUDENT, ctx)
    ).rejects.toThrow(/not submitted/i);
  });

  it('CANNOT unsubmit once graded — otherwise a student could edit a graded agent', async () => {
    prisma.studentAgentConfig.findUnique.mockResolvedValue(
      config({ isDraft: false, submission: { id: 77, status: 'graded' } })
    );
    await expect(
      agentAssignmentService.unsubmitAgentConfig(ASSIGNMENT_ID, STUDENT, ctx)
    ).rejects.toThrow(/Cannot unsubmit a graded assignment/i);
    expect(prisma.studentAgentConfig.update).not.toHaveBeenCalled();
  });
});

describe('one student cannot reach another student\'s config', () => {
  it('every student-facing lookup is keyed by (assignment, caller)', async () => {
    prisma.studentAgentConfig.findUnique.mockResolvedValue(config({ isDraft: true }));
    await agentAssignmentService.updateAgentConfig(ASSIGNMENT_ID, STUDENT, INPUT, ctx);

    // The compound unique key is what makes impersonation impossible here:
    // there is no id parameter a caller could substitute.
    expect(prisma.studentAgentConfig.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assignmentId_userId: { assignmentId: ASSIGNMENT_ID, userId: STUDENT } },
      })
    );
  });
});
