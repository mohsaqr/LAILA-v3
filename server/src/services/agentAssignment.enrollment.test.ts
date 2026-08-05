import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Who may create a student agent config.
 *
 * `createAgentConfig` holds the ONLY enrollment gate on the agent lifecycle —
 * update and submit have none, because both need a config that only this method
 * can create. So this boundary has to do two jobs at once: let course staff
 * build an agent on their own assignment (they are never enrolled, and the
 * builder is the only way to see what students see), and keep denying everyone
 * with no relationship to the course.
 */

vi.mock('../utils/prisma.js', () => ({
  default: {
    assignment: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    studentAgentConfig: { findUnique: vi.fn(), create: vi.fn() },
    course: { findFirst: vi.fn() },
  },
}));

vi.mock('./courseRole.service.js', () => ({
  courseRoleService: { isCourseStaff: vi.fn() },
}));

vi.mock('./agentAnalytics.service.js', () => ({
  agentAnalyticsService: {
    createConfigSnapshot: vi.fn().mockReturnValue({}),
    logConfigurationChange: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./activityLog.service.js', () => ({ activityLogService: { log: vi.fn() } }));
vi.mock('./llm.service.js', () => ({ llmService: {} }));

// Static imports, not `await import(...)`: vi.mock is hoisted above them so the
// mocks still win, and tsc rejects top-level await under this CommonJS target.
import { agentAssignmentService } from './agentAssignment.service.js';
import prismaClient from '../utils/prisma.js';
import { courseRoleService } from './courseRole.service.js';

const prisma = prismaClient as any;

const ASSIGNMENT = {
  id: 23,
  title: 'AI assignment',
  courseId: 3,
  submissionType: 'ai_agent',
  course: { id: 3, title: 'Summer Course', instructorId: 6 },
};

const INPUT = { agentName: 'Bio Buddy', systemPrompt: 'a valid system prompt' } as any;

const ctx = (userId: number, isAdmin = false) => ({ userId, isAdmin }) as any;

const create = (userId: number, isAdmin = false) =>
  agentAssignmentService.createAgentConfig(23, userId, INPUT, ctx(userId, isAdmin));

beforeEach(() => {
  vi.clearAllMocks();
  prisma.assignment.findUnique.mockResolvedValue(ASSIGNMENT);
  prisma.studentAgentConfig.findUnique.mockResolvedValue(null);
  prisma.studentAgentConfig.create.mockResolvedValue({ id: 1, version: 1, agentName: 'Bio Buddy' });
});

describe('createAgentConfig enrollment gate', () => {
  it('lets course staff through without an enrollment row', async () => {
    vi.mocked(courseRoleService.isCourseStaff).mockResolvedValue(true);
    prisma.enrollment.findUnique.mockResolvedValue(null);

    await expect(create(7, true)).resolves.toBeTruthy();

    // The enrollment table must not even be consulted for staff.
    expect(prisma.enrollment.findUnique).not.toHaveBeenCalled();
    expect(prisma.studentAgentConfig.create).toHaveBeenCalled();
  });

  it('passes the admin flag through, so an admin is staff anywhere', async () => {
    vi.mocked(courseRoleService.isCourseStaff).mockResolvedValue(true);
    await create(7, true);
    expect(courseRoleService.isCourseStaff).toHaveBeenCalledWith(7, 3, true);
  });

  it('does not invent staff rights for a plain student', async () => {
    vi.mocked(courseRoleService.isCourseStaff).mockResolvedValue(false);
    prisma.enrollment.findUnique.mockResolvedValue({ id: 99 });

    await create(42, false);
    expect(courseRoleService.isCourseStaff).toHaveBeenCalledWith(42, 3, false);
  });

  it('still admits an enrolled student', async () => {
    vi.mocked(courseRoleService.isCourseStaff).mockResolvedValue(false);
    prisma.enrollment.findUnique.mockResolvedValue({ id: 99, userId: 42, courseId: 3 });

    await expect(create(42)).resolves.toBeTruthy();
    expect(prisma.enrollment.findUnique).toHaveBeenCalled();
  });

  it('STILL REJECTS a stranger — neither staff nor enrolled', async () => {
    vi.mocked(courseRoleService.isCourseStaff).mockResolvedValue(false);
    prisma.enrollment.findUnique.mockResolvedValue(null);

    await expect(create(999)).rejects.toThrow('You must be enrolled to submit');
    expect(prisma.studentAgentConfig.create).not.toHaveBeenCalled();
  });

  it('rejects a stranger who merely claims not to be an admin-free path', async () => {
    // isAdmin defaults to false when the context omits it, so an omitted flag
    // can never silently grant staff rights.
    vi.mocked(courseRoleService.isCourseStaff).mockResolvedValue(false);
    prisma.enrollment.findUnique.mockResolvedValue(null);

    await expect(
      agentAssignmentService.createAgentConfig(23, 999, INPUT, { userId: 999 } as any)
    ).rejects.toThrow('You must be enrolled to submit');
    expect(courseRoleService.isCourseStaff).toHaveBeenCalledWith(999, 3, false);
  });
});
