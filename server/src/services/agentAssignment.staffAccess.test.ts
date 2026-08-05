import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Course staff access to AI-agent assignments.
 *
 * A course can have team members beyond its owner — `courseRole` defines `ta`,
 * `co_instructor` and `course_admin`, and `courseRole.service.ts` states the
 * convention outright: isCourseStaff is "the canonical ... check for READ
 * endpoints ... For write guards prefer the permission-aware canEditContent/
 * canGrade."
 *
 * assignment.service.ts follows it — `getSubmissions` and `getSubmissionById`
 * fall back to isTeamMember, and `gradeSubmission` uses canGrade. So a TA can
 * open and grade an ordinary submission.
 *
 * These tests assert the same is true of AI-agent assignments, which are just
 * another submissionType on the same course.
 */

vi.mock('../utils/prisma.js', () => ({
  default: {
    assignment: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    studentAgentConfig: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    assignmentSubmission: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    user: { findMany: vi.fn() },
    userDataset: { findMany: vi.fn() },
  },
}));

vi.mock('./courseRole.service.js', () => ({
  courseRoleService: {
    isCourseStaff: vi.fn(),
    isTeamMember: vi.fn(),
    canGrade: vi.fn(),
  },
}));

vi.mock('./agentAnalytics.service.js', () => ({
  agentAnalyticsService: {
    createConfigSnapshot: vi.fn().mockReturnValue({}),
    logConfigurationChange: vi.fn().mockResolvedValue(undefined),
    getTestConversations: vi.fn().mockResolvedValue([]),
    logGradeEvent: vi.fn().mockResolvedValue(undefined),
    getConfigurationHistory: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('./activityLog.service.js', () => ({ activityLogService: { log: vi.fn() } }));
vi.mock('./llm.service.js', () => ({ llmService: {} }));

import { agentAssignmentService } from './agentAssignment.service.js';
import prismaClient from '../utils/prisma.js';
import { courseRoleService } from './courseRole.service.js';

const prisma = prismaClient as any;

const OWNER = 6;
const TA = 99;
const ADMIN = 7;
const STRANGER = 4242;
const COURSE_ID = 3;

const ASSIGNMENT = {
  id: 23,
  title: 'AI assignment',
  courseId: COURSE_ID,
  submissionType: 'ai_agent',
  course: { id: COURSE_ID, title: 'Summer Course', instructorId: OWNER },
};

const CONFIG = {
  id: 55,
  userId: 1234,
  assignmentId: 23,
  agentName: 'Bio Buddy',
  assignment: { id: 23, courseId: COURSE_ID, course: { id: COURSE_ID, instructorId: OWNER } },
};

const SUBMISSION = {
  id: 77,
  grade: null,
  feedback: null,
  assignment: { id: 23, course: { id: COURSE_ID, title: 'Summer Course', instructorId: OWNER } },
  user: { id: 1234, fullname: 'A Student', email: 's@example.com' },
  agentConfig: CONFIG,
};

/**
 * Faithful stand-in for the real helper, whose contract is:
 * admin OR the course owner OR any team member. Mocking it to a flat
 * true/false would let a guard pass for the wrong reason — e.g. an owner
 * "working" only because the mock said yes.
 */
const staff = new Set<number>([TA]); // course roles, owner/admin handled by rule

const wireCourseRoles = () => {
  vi.mocked(courseRoleService.isCourseStaff).mockImplementation(
    async (userId, courseId, isAdmin = false) =>
      Boolean(isAdmin) || userId === OWNER || (courseId === COURSE_ID && staff.has(userId!))
  );
  vi.mocked(courseRoleService.isTeamMember).mockImplementation(
    async (userId, courseId) => courseId === COURSE_ID && staff.has(userId)
  );
  vi.mocked(courseRoleService.canGrade).mockImplementation(
    async (userId, courseId, isAdmin = false) =>
      Boolean(isAdmin) || userId === OWNER || (courseId === COURSE_ID && staff.has(userId))
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  wireCourseRoles();
  prisma.assignment.findUnique.mockResolvedValue(ASSIGNMENT);
  prisma.studentAgentConfig.findUnique.mockResolvedValue(CONFIG);
  prisma.studentAgentConfig.findMany.mockResolvedValue([]);
  prisma.assignmentSubmission.findUnique.mockResolvedValue(SUBMISSION);
  prisma.assignmentSubmission.findFirst.mockResolvedValue(SUBMISSION);
  prisma.assignmentSubmission.update.mockResolvedValue({ ...SUBMISSION, grade: 90, status: 'graded' });
  prisma.studentAgentConfig.update.mockResolvedValue(CONFIG);
  prisma.user.findMany.mockResolvedValue([]);
  prisma.userDataset.findMany.mockResolvedValue([]);
});

const ctx = (userId: number) => ({ userId }) as any;

describe('course owner and admin keep full access', () => {
  it('the owner can list agent submissions', async () => {
    await expect(agentAssignmentService.getAgentSubmissions(23, OWNER, false)).resolves.toBeDefined();
  });

  it('an admin can list agent submissions', async () => {
    await expect(agentAssignmentService.getAgentSubmissions(23, ADMIN, true)).resolves.toBeDefined();
  });

  it('the owner can grade', async () => {
    await expect(
      agentAssignmentService.gradeAgentSubmission(77, OWNER, { grade: 90 } as any, false, ctx(OWNER))
    ).resolves.toBeDefined();
  });
});

describe('a course TA has the same access to agent assignments as to ordinary ones', () => {

  it('can list agent submissions', async () => {
    await expect(agentAssignmentService.getAgentSubmissions(23, TA, false)).resolves.toBeDefined();
  });

  it('can open one submission in detail', async () => {
    await expect(
      agentAssignmentService.getAgentSubmissionDetail(23, 77, TA, false)
    ).resolves.toBeDefined();
  });

  it('can read a config history', async () => {
    await expect(agentAssignmentService.getConfigHistory(55, TA, false)).resolves.toBeDefined();
  });

  it('can read the test conversations behind a submission', async () => {
    await expect(
      agentAssignmentService.getSubmissionTestConversations(55, TA, false)
    ).resolves.toBeDefined();
  });

  it('can see the datasets a student generated', async () => {
    await expect(
      agentAssignmentService.getDatasetsByAgentConfigId(55, TA, false)
    ).resolves.toBeDefined();
  });

  it('can grade an agent submission', async () => {
    await expect(
      agentAssignmentService.gradeAgentSubmission(77, TA, { grade: 90 } as any, false, ctx(TA))
    ).resolves.toBeDefined();
  });
});

describe('someone with no role on the course is still refused', () => {

  it.each([
    ['list submissions', () => agentAssignmentService.getAgentSubmissions(23, STRANGER, false)],
    ['submission detail', () => agentAssignmentService.getAgentSubmissionDetail(23, 77, STRANGER, false)],
    ['config history', () => agentAssignmentService.getConfigHistory(55, STRANGER, false)],
    ['test conversations', () => agentAssignmentService.getSubmissionTestConversations(55, STRANGER, false)],
    ['datasets', () => agentAssignmentService.getDatasetsByAgentConfigId(55, STRANGER, false)],
    ['grade', () => agentAssignmentService.gradeAgentSubmission(77, STRANGER, { grade: 90 } as any, false, ctx(STRANGER))],
  ])('%s is refused', async (_label, call) => {
    await expect(call()).rejects.toThrow(/not authorized/i);
  });

  it('does not write a grade when refused', async () => {
    await expect(
      agentAssignmentService.gradeAgentSubmission(77, STRANGER, { grade: 90 } as any, false, ctx(STRANGER))
    ).rejects.toThrow();
    expect(prisma.assignmentSubmission.update).not.toHaveBeenCalled();
  });
});
