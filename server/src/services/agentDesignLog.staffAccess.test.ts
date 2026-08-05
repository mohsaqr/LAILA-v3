import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Who may read a student's agent *design* record.
 *
 * These are the instructor-facing views behind the design timeline: the raw
 * event log, the timeline, a config reconstructed at a point in time, and the
 * per-assignment analytics. They were owner-or-admin only, so a TA who can
 * grade the agent could not see how the student arrived at it — the evidence
 * the grade is supposed to rest on.
 */

vi.mock('../utils/prisma.js', () => ({
  default: {
    assignment: { findUnique: vi.fn() },
    studentAgentConfig: { findUnique: vi.fn(), findMany: vi.fn() },
    agentDesignEventLog: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  },
}));

vi.mock('./courseRole.service.js', () => ({
  courseRoleService: { isCourseStaff: vi.fn() },
}));

import { agentDesignLogService } from './agentDesignLog.service.js';
import prismaClient from '../utils/prisma.js';
import { courseRoleService } from './courseRole.service.js';

const prisma = prismaClient as any;

const OWNER = 6;
const TA = 99;
const ADMIN = 7;
const STRANGER = 4242;
const COURSE_ID = 3;

const CONFIG = {
  id: 55,
  userId: 1234,
  assignmentId: 23,
  agentName: 'Bio Buddy',
  createdAt: new Date('2026-01-01'),
  assignment: { id: 23, courseId: COURSE_ID, course: { instructorId: OWNER } },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Faithful to the real helper: admin OR course owner OR team member.
  vi.mocked(courseRoleService.isCourseStaff).mockImplementation(
    async (userId, courseId, isAdmin = false) =>
      Boolean(isAdmin) || userId === OWNER || (courseId === COURSE_ID && userId === TA)
  );
  prisma.studentAgentConfig.findUnique.mockResolvedValue(CONFIG);
  prisma.studentAgentConfig.findMany.mockResolvedValue([]);
  prisma.agentDesignEventLog.findMany.mockResolvedValue([]);
  prisma.agentDesignEventLog.findFirst.mockResolvedValue(null);
  prisma.agentDesignEventLog.count.mockResolvedValue(0);
  prisma.assignment.findUnique.mockResolvedValue({
    id: 23,
    courseId: COURSE_ID,
    course: { instructorId: OWNER },
  });
});

const views: [string, (userId: number, isAdmin?: boolean) => Promise<unknown>][] = [
  ['design events for a config', (u, a = false) => agentDesignLogService.getDesignEventsForConfig(55, u, a)],
  ['design timeline', (u, a = false) => agentDesignLogService.getDesignTimeline(55, u, a)],
  ['config at a point in time', (u, a = false) => agentDesignLogService.getConfigAtTime(55, new Date(), u, a)],
  ['assignment design analytics', (u, a = false) => agentDesignLogService.getAssignmentDesignAnalytics(23, u, a)],
];

describe.each(views)('%s', (_label, call) => {
  it('is open to the course owner', async () => {
    await expect(call(OWNER)).resolves.toBeDefined();
  });

  it('is open to an admin', async () => {
    await expect(call(ADMIN, true)).resolves.toBeDefined();
  });

  it('is open to a course TA', async () => {
    await expect(call(TA)).resolves.toBeDefined();
  });

  it('is refused to someone with no role on the course', async () => {
    await expect(call(STRANGER)).rejects.toThrow(/not authorized/i);
  });
});

describe('the gate is asked about the right course', () => {
  it('uses the config\'s own course, not the caller\'s', async () => {
    await agentDesignLogService.getDesignTimeline(55, TA, false);
    expect(courseRoleService.isCourseStaff).toHaveBeenCalledWith(TA, COURSE_ID, false);
  });
});
