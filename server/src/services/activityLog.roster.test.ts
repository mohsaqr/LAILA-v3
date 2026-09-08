import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `getUserRoster` answers "when was each person last seen, and doing what".
 *
 * The behaviour worth pinning is that "last seen" is a MAX across four
 * independent signals that routinely disagree — a student can be absent from
 * the learning log for a fortnight while still clicking around — and that the
 * roster is driven by people rather than by logs, so an account with no events
 * at all still appears instead of silently vanishing.
 */

vi.mock('../utils/prisma.js', () => ({
  default: {
    user: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn(), groupBy: vi.fn() },
    learningActivityLog: { groupBy: vi.fn(), findMany: vi.fn() },
    userInteractionLog: { groupBy: vi.fn() },
    authEventLog: { groupBy: vi.fn() },
  },
}));

import prisma from '../utils/prisma.js';
import { activityLogService } from './activityLog.service.js';

const d = (iso: string) => new Date(iso);

/** Everything empty by default; each test fills in only what it exercises. */
const setup = (over: {
  users?: any[]; enrolments?: any[]; enrolGroups?: any[];
  activity?: any[]; lastRows?: any[]; interaction?: any[]; auth?: any[];
} = {}) => {
  vi.mocked(prisma.user.findMany).mockResolvedValue((over.users ?? []) as any);
  vi.mocked(prisma.enrollment.findMany).mockResolvedValue((over.enrolments ?? []) as any);
  vi.mocked(prisma.enrollment.groupBy).mockResolvedValue((over.enrolGroups ?? []) as any);
  vi.mocked(prisma.learningActivityLog.groupBy).mockResolvedValue((over.activity ?? []) as any);
  vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue((over.lastRows ?? []) as any);
  vi.mocked(prisma.userInteractionLog.groupBy).mockResolvedValue((over.interaction ?? []) as any);
  vi.mocked(prisma.authEventLog.groupBy).mockResolvedValue((over.auth ?? []) as any);
};

const ada = {
  id: 1, fullname: 'Ada L', email: 'ada@x.edu',
  isAdmin: false, isInstructor: false, isActive: true,
  status: 'active', createdAt: d('2026-01-01'), lastLogin: d('2026-08-11'),
};

beforeEach(() => vi.clearAllMocks());

describe('last seen spans every signal, not just the learning log', () => {
  it('picks the newest across activity, interaction, auth and enrolment', async () => {
    setup({
      users: [ada],
      activity: [{ userId: 1, _max: { timestamp: d('2026-09-01') }, _count: { _all: 5 } }],
      lastRows: [{ userId: 1, timestamp: d('2026-09-01'), verb: 'viewed', objectType: 'lecture', objectTitle: 'Intro', courseTitle: 'C' }],
      interaction: [{ userId: 1, _max: { timestamp: d('2026-09-08') }, _count: { _all: 9 } }],
      auth: [{ userId: 1, _max: { timestamp: d('2026-09-03') } }],
      enrolGroups: [{ userId: 1, _max: { lastAccessAt: d('2026-08-20') } }],
    });

    const { data } = await activityLogService.getUserRoster();

    expect(data[0].lastSeen).toBe(d('2026-09-08').getTime());
    // The winning table is reported so a surprising date is traceable.
    expect(data[0].lastSeenSource).toBe('interaction');
  });

  it('keeps lastLogin separate rather than folding it into lastSeen', async () => {
    setup({
      users: [ada],
      interaction: [{ userId: 1, _max: { timestamp: d('2026-09-08') }, _count: { _all: 9 } }],
    });

    const { data } = await activityLogService.getUserRoster();

    // lastLogin only moves on the password path, so it must never be allowed
    // to stand in for presence — that is the whole reason both are shown.
    expect(data[0].lastLogin).toBe(d('2026-08-11').getTime());
    expect(data[0].lastSeen).toBe(d('2026-09-08').getTime());
  });

  it('reports never-seen accounts instead of dropping them', async () => {
    setup({ users: [{ ...ada, lastLogin: null }] });

    const { data } = await activityLogService.getUserRoster();

    expect(data).toHaveLength(1);
    expect(data[0].lastSeen).toBeNull();
    expect(data[0].lastSeenSource).toBeNull();
    expect(data[0].lastAction).toBeNull();
    expect(data[0].events).toBe(0);
  });
});

describe('what they last did', () => {
  it('carries the most recent activity row through', async () => {
    setup({
      users: [ada],
      activity: [{ userId: 1, _max: { timestamp: d('2026-09-06') }, _count: { _all: 42 } }],
      lastRows: [{ userId: 1, timestamp: d('2026-09-06'), verb: 'submitted', objectType: 'assignment', objectTitle: 'Essay 2', courseTitle: 'SNA' }],
    });

    const { data } = await activityLogService.getUserRoster();

    expect(data[0].lastAction).toEqual({
      verb: 'submitted', objectType: 'assignment', objectTitle: 'Essay 2',
      courseTitle: 'SNA', at: d('2026-09-06').getTime(),
    });
    expect(data[0].events).toBe(42);
  });

  it('breaks a timestamp tie deterministically on the newest row', async () => {
    setup({
      users: [ada],
      activity: [{ userId: 1, _max: { timestamp: d('2026-09-06T10:00:00Z') }, _count: { _all: 2 } }],
      lastRows: [
        { userId: 1, timestamp: d('2026-09-06T09:00:00Z'), verb: 'viewed', objectType: 'lecture', objectTitle: 'Older', courseTitle: null },
        { userId: 1, timestamp: d('2026-09-06T10:00:00Z'), verb: 'submitted', objectType: 'assignment', objectTitle: 'Newer', courseTitle: null },
      ],
    });

    const { data } = await activityLogService.getUserRoster();

    expect(data[0].lastAction?.objectTitle).toBe('Newer');
  });
});

describe('course scope', () => {
  it('draws the population from enrolments and ignores auth events', async () => {
    setup({
      enrolments: [{ userId: 1 }],
      users: [ada],
      activity: [{ userId: 1, _max: { timestamp: d('2026-09-01') }, _count: { _all: 3 } }],
      lastRows: [{ userId: 1, timestamp: d('2026-09-01'), verb: 'viewed', objectType: 'lecture', objectTitle: 'L', courseTitle: 'C' }],
    });

    const { data } = await activityLogService.getUserRoster({ courseId: 3 });

    expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ courseId: 3 }) }),
    );
    // Auth is not course-scoped: counting it would mark every student "seen"
    // on a login that never touched this course.
    expect(prisma.authEventLog.groupBy).not.toHaveBeenCalled();
    expect(data[0].lastSeenSource).toBe('activity');
  });

  it('returns nothing for a course with no enrolments, without querying logs', async () => {
    setup({ enrolments: [] });

    const { data, total } = await activityLogService.getUserRoster({ courseId: 99 });

    expect(data).toEqual([]);
    expect(total).toBe(0);
    expect(prisma.learningActivityLog.groupBy).not.toHaveBeenCalled();
  });
});

describe('ordering and paging', () => {
  it('sorts quietest first, with never-seen at the very top', async () => {
    const users = [
      { ...ada, id: 1, fullname: 'Recent' },
      { ...ada, id: 2, fullname: 'Never' },
      { ...ada, id: 3, fullname: 'Stale' },
    ];
    setup({
      users,
      activity: [
        { userId: 1, _max: { timestamp: d('2026-09-08') }, _count: { _all: 1 } },
        { userId: 3, _max: { timestamp: d('2026-07-01') }, _count: { _all: 1 } },
      ],
    });

    const { data } = await activityLogService.getUserRoster();

    expect(data.map(r => r.name)).toEqual(['Never', 'Stale', 'Recent']);
  });

  it('breaks an identical lastSeen tie on userId, not on arrival order', async () => {
    const same = d('2026-09-08');
    setup({
      users: [
        { ...ada, id: 9, fullname: 'Nine' },
        { ...ada, id: 2, fullname: 'Two' },
        { ...ada, id: 5, fullname: 'Five' },
      ],
      activity: [
        { userId: 9, _max: { timestamp: same }, _count: { _all: 1 } },
        { userId: 2, _max: { timestamp: same }, _count: { _all: 1 } },
        { userId: 5, _max: { timestamp: same }, _count: { _all: 1 } },
      ],
    });

    const { data } = await activityLogService.getUserRoster();

    // Without the secondary key these could come back in any order and the
    // page would reshuffle between refreshes.
    expect(data.map(r => r.userId)).toEqual([2, 5, 9]);
  });

  it('reports truncation instead of silently dropping people', async () => {
    setup({ users: [ada] });
    const { truncated } = await activityLogService.getUserRoster();
    expect(truncated).toBe(false);
  });

  it('filters by search and reports the pre-slice total', async () => {
    setup({
      users: [
        { ...ada, id: 1, fullname: 'Ada Lovelace', email: 'ada@x.edu' },
        { ...ada, id: 2, fullname: 'Rob King', email: 'rob@x.edu' },
      ],
    });

    const { data, total } = await activityLogService.getUserRoster({ search: 'LOVE' });

    expect(total).toBe(1);
    expect(data[0].name).toBe('Ada Lovelace');
  });
});
