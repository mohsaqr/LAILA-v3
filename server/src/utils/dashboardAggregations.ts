import prisma from './prisma.js';

/**
 * Shared dashboard aggregation helpers used by both the instructor
 * dashboard (scoped to one user's owned courses) and the admin
 * dashboard (scoped platform-wide). The two callers differ only in
 * whether a `courseIds` filter is applied; the bucketing math, sort
 * rules, and label formatting are identical.
 */

export interface MonthlySeries {
  counts: number[];
  label: string;
  year: number;
  month: number;
  daysShown: number;
}

export interface MonthlyEngagement {
  thisMonth: MonthlySeries;
  lastMonth: MonthlySeries;
}

const monthLabel = (d: Date) =>
  d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Build day-of-month aligned event counts for the current month and
 * the previous month, plus a verb breakdown across both months.
 *
 * Pass `null` for `courseIds` to aggregate platform-wide (admin),
 * or an array of course IDs to scope to those courses (instructor).
 */
export async function computeMonthlyEngagement(courseIds: number[] | null): Promise<{
  engagement: MonthlyEngagement;
  activityByVerb: Record<string, number>;
}> {
  const now = new Date();
  const thisMonth = now.getUTCMonth();
  const thisYear = now.getUTCFullYear();
  const today = now.getUTCDate();
  const startOfThisMonth = new Date(Date.UTC(thisYear, thisMonth, 1));
  const startOfNextMonth = new Date(Date.UTC(thisYear, thisMonth + 1, 1));
  const startOfLastMonth = new Date(Date.UTC(thisYear, thisMonth - 1, 1));
  const daysInLastMonth = new Date(Date.UTC(thisYear, thisMonth, 0)).getUTCDate();

  // `courseIds = null` means "no scope filter" (admin / platform-wide).
  // `courseIds = []` from instructor flow shouldn't reach here — we
  // short-circuit upstream — but if it does we still want zero rows.
  const courseFilter =
    courseIds == null ? {} : { courseId: { in: courseIds } };

  const [thisMonthRows, lastMonthRows] = await Promise.all([
    prisma.learningActivityLog.findMany({
      where: { ...courseFilter, timestamp: { gte: startOfThisMonth, lt: startOfNextMonth } },
      select: { timestamp: true, verb: true },
    }),
    prisma.learningActivityLog.findMany({
      where: { ...courseFilter, timestamp: { gte: startOfLastMonth, lt: startOfThisMonth } },
      select: { timestamp: true, verb: true },
    }),
  ]);

  const thisMonthCounts: number[] = new Array(today).fill(0);
  const lastMonthCounts: number[] = new Array(daysInLastMonth).fill(0);
  const activityByVerb: Record<string, number> = {};

  for (const r of thisMonthRows) {
    const d = new Date(r.timestamp).getUTCDate();
    if (d >= 1 && d <= today) thisMonthCounts[d - 1] += 1;
    if (r.verb) activityByVerb[r.verb] = (activityByVerb[r.verb] ?? 0) + 1;
  }
  for (const r of lastMonthRows) {
    const d = new Date(r.timestamp).getUTCDate();
    if (d >= 1 && d <= daysInLastMonth) lastMonthCounts[d - 1] += 1;
    if (r.verb) activityByVerb[r.verb] = (activityByVerb[r.verb] ?? 0) + 1;
  }

  return {
    engagement: {
      thisMonth: {
        counts: thisMonthCounts,
        label: monthLabel(startOfThisMonth),
        year: thisYear,
        month: thisMonth + 1,
        daysShown: today,
      },
      lastMonth: {
        counts: lastMonthCounts,
        label: monthLabel(startOfLastMonth),
        year: startOfLastMonth.getUTCFullYear(),
        month: startOfLastMonth.getUTCMonth() + 1,
        daysShown: daysInLastMonth,
      },
    },
    activityByVerb,
  };
}

export const emptyEngagement = (): MonthlyEngagement => ({
  thisMonth: { counts: [], label: '', year: 0, month: 0, daysShown: 0 },
  lastMonth: { counts: [], label: '', year: 0, month: 0, daysShown: 0 },
});

export interface CourseCompletionRow {
  courseId: number;
  courseTitle: string;
  completionPct: number;
  studentCount: number;
  participants: { id: number; fullname: string | null; avatarUrl: string | null }[];
}

/**
 * Build the per-course completion list with sample participants.
 * Pass `instructorId` to scope to one user's owned courses, or
 * `null` for platform-wide (admin). `limit` caps the returned list
 * after sorting (top N by student count, then completion %).
 */
export async function computeCourseCompletion(filter: {
  instructorId?: number | null;
  limit?: number;
}): Promise<CourseCompletionRow[]> {
  const courses = await prisma.course.findMany({
    where: filter.instructorId != null ? { instructorId: filter.instructorId } : undefined,
    select: { id: true, title: true, status: true, thumbnail: true },
  });
  const courseIds = courses.map(c => c.id);
  if (courseIds.length === 0) return [];

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: { in: courseIds } },
    select: {
      courseId: true,
      progress: true,
      status: true,
      enrolledAt: true,
      user: { select: { id: true, fullname: true, avatarUrl: true } },
    },
  });

  type Sample = {
    enrolledAt: Date;
    user: { id: number; fullname: string | null; avatarUrl: string | null };
  };
  const byCourse = new Map<
    number,
    { sum: number; count: number; students: number; sample: Sample[] }
  >();
  for (const e of enrollments) {
    const cur = byCourse.get(e.courseId) ?? { sum: 0, count: 0, students: 0, sample: [] };
    cur.students += 1;
    if (e.status !== 'dropped') {
      cur.sum += e.progress ?? 0;
      cur.count += 1;
    }
    cur.sample.push({ enrolledAt: e.enrolledAt, user: e.user });
    byCourse.set(e.courseId, cur);
  }

  const rows = courses.map(c => {
    const agg = byCourse.get(c.id);
    const pct = agg && agg.count > 0 ? agg.sum / agg.count : 0;
    // Avatar-bearing students first; then fall back to most-recent enrollment.
    const participants = (agg?.sample ?? [])
      .sort((a, b) => {
        const aHas = a.user.avatarUrl ? 1 : 0;
        const bHas = b.user.avatarUrl ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas;
        return b.enrolledAt.getTime() - a.enrolledAt.getTime();
      })
      .slice(0, 5)
      .map(s => s.user);
    return {
      courseId: c.id,
      courseTitle: c.title,
      completionPct: Math.round(pct),
      studentCount: agg?.students ?? 0,
      participants,
    };
  });
  rows.sort((a, b) => b.studentCount - a.studentCount || b.completionPct - a.completionPct);

  return filter.limit != null ? rows.slice(0, filter.limit) : rows;
}
