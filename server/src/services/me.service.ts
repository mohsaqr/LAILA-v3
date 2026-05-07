import prisma from '../utils/prisma.js';

/**
 * Per-user dashboard aggregations. Each method takes the user id from
 * the JWT (the route layer reads `req.user.id`) and never accepts a
 * userId param — these endpoints are intentionally "me only".
 */
export class MeService {
  /**
   * Surfaces the lecture the student should resume in each of their
   * active courses. We read the most recent `viewed:lecture` events
   * from `LearningActivityLog` (which already carries denormalised
   * lecture/module/course titles), dedupe by course, and join
   * progress from the active enrollment row.
   */
  async getContinueLearning(userId: number, limit = 6) {
    // Pull the most recent lecture-view events for this user. We over-
    // fetch and dedupe in memory because Prisma doesn't expose a
    // groupBy-with-first across SQLite + PostgreSQL portably.
    const recentViews = await prisma.learningActivityLog.findMany({
      where: {
        userId,
        objectType: 'lecture',
        verb: 'viewed',
        courseId: { not: null },
        lectureId: { not: null },
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
      select: {
        timestamp: true,
        courseId: true,
        courseTitle: true,
        moduleId: true,
        moduleTitle: true,
        lectureId: true,
        lectureTitle: true,
      },
    });

    // Dedup by courseId, keeping the most recent view per course.
    const byCourse = new Map<number, typeof recentViews[number]>();
    for (const v of recentViews) {
      if (v.courseId != null && !byCourse.has(v.courseId)) byCourse.set(v.courseId, v);
      if (byCourse.size >= limit) break;
    }

    const courseIds = Array.from(byCourse.keys());
    if (courseIds.length === 0) return [];

    // Pair with active enrollment so we can show progress + thumbnail
    // and skip rows where the user has since unenrolled.
    const enrollments = await prisma.enrollment.findMany({
      where: { userId, courseId: { in: courseIds }, status: 'active' },
      select: {
        courseId: true,
        progress: true,
        course: {
          select: { id: true, title: true, slug: true, thumbnail: true },
        },
      },
    });
    const enrolledById = new Map(enrollments.map(e => [e.courseId, e]));

    return courseIds
      .map(cid => {
        const view = byCourse.get(cid)!;
        const enrollment = enrolledById.get(cid);
        if (!enrollment) return null;
        return {
          courseId: cid,
          courseTitle: enrollment.course.title,
          courseSlug: enrollment.course.slug,
          courseThumbnail: enrollment.course.thumbnail,
          moduleId: view.moduleId,
          moduleTitle: view.moduleTitle,
          lectureId: view.lectureId,
          lectureTitle: view.lectureTitle,
          progress: enrollment.progress,
          lastViewedAt: view.timestamp,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  /**
   * Aggregate ungraded submissions across every course the instructor
   * owns or co-teaches. Returns at most `limit` rows, oldest pending
   * first so the dashboard surfaces the most overdue grading.
   */
  async getGradingQueue(userId: number, limit = 5) {
    // Courses the user owns directly.
    const ownedCourses = await prisma.course.findMany({
      where: { instructorId: userId },
      select: { id: true, title: true },
    });
    // Courses where they hold a team role with grade permission. We're
    // permissive here — `manage_students` or `grade` are both gates we
    // honour elsewhere; either grants visibility.
    const teamRoles = await prisma.courseRole.findMany({
      where: { userId },
      select: { courseId: true, permissions: true, course: { select: { id: true, title: true } } },
    });
    const teamCourses = teamRoles
      .filter(r => {
        try {
          const perms = r.permissions ? JSON.parse(r.permissions) : [];
          return Array.isArray(perms) && (perms.includes('grade') || perms.includes('manage_students'));
        } catch {
          return false;
        }
      })
      .map(r => r.course);

    const courseMap = new Map<number, { id: number; title: string }>();
    for (const c of [...ownedCourses, ...teamCourses]) courseMap.set(c.id, c);
    const courseIds = Array.from(courseMap.keys());
    if (courseIds.length === 0) return [];

    // Group ungraded submissions by assignment so we can show "5
    // students waiting" instead of a row per submission.
    const grouped = await prisma.assignmentSubmission.groupBy({
      by: ['assignmentId'],
      where: {
        status: 'submitted',
        gradedAt: null,
        assignment: { courseId: { in: courseIds } },
      },
      _count: { _all: true },
      _min: { submittedAt: true },
      orderBy: { _min: { submittedAt: 'asc' } },
      take: limit,
    });
    if (grouped.length === 0) return [];

    const assignments = await prisma.assignment.findMany({
      where: { id: { in: grouped.map(g => g.assignmentId) } },
      select: { id: true, title: true, courseId: true, submissionType: true },
    });
    const assignmentById = new Map(assignments.map(a => [a.id, a]));

    return grouped
      .map(g => {
        const a = assignmentById.get(g.assignmentId);
        if (!a) return null;
        const course = courseMap.get(a.courseId);
        return {
          assignmentId: a.id,
          assignmentTitle: a.title,
          submissionType: a.submissionType,
          courseId: a.courseId,
          courseTitle: course?.title ?? '',
          pendingCount: g._count._all,
          oldestSubmittedAt: g._min.submittedAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  /**
   * Per-instructor teaching dashboard data: month-aligned engagement
   * (this month + last month, day-of-month aligned for chart overlay)
   * + per-course completion % + KPI totals + activity verb breakdown
   * across both months. Single round trip so the instructor dashboard
   * renders without fan-out from the client.
   */
  async getTeachingOverview(userId: number) {
    const ownedCourses = await prisma.course.findMany({
      where: { instructorId: userId },
      select: { id: true, title: true, status: true, thumbnail: true },
    });
    const courseIds = ownedCourses.map(c => c.id);

    if (courseIds.length === 0) {
      return {
        kpis: { totalCourses: 0, totalStudents: 0, totalAssignments: 0, pendingGrading: 0 },
        engagement: emptyEngagement(),
        courseCompletion: [] as { courseId: number; courseTitle: string; completionPct: number; studentCount: number }[],
        activityByVerb: {} as Record<string, number>,
      };
    }

    const now = new Date();
    const thisMonth = now.getUTCMonth();
    const thisYear = now.getUTCFullYear();
    const today = now.getUTCDate();
    // Use UTC to stay portable; consistent with how everything else is bucketed.
    const startOfThisMonth = new Date(Date.UTC(thisYear, thisMonth, 1));
    const startOfNextMonth = new Date(Date.UTC(thisYear, thisMonth + 1, 1));
    const startOfLastMonth = new Date(Date.UTC(thisYear, thisMonth - 1, 1));

    const daysInLastMonth = new Date(Date.UTC(thisYear, thisMonth, 0)).getUTCDate();

    const [enrollments, assignmentTotals, pendingByCourse, thisMonthRows, lastMonthRows] = await Promise.all([
      prisma.enrollment.findMany({
        where: { courseId: { in: courseIds } },
        select: {
          courseId: true,
          progress: true,
          status: true,
          enrolledAt: true,
          user: { select: { id: true, fullname: true, avatarUrl: true } },
        },
      }),
      prisma.assignment.count({ where: { courseId: { in: courseIds } } }),
      prisma.assignmentSubmission.count({
        where: {
          status: 'submitted',
          gradedAt: null,
          assignment: { courseId: { in: courseIds } },
        },
      }),
      prisma.learningActivityLog.findMany({
        where: {
          courseId: { in: courseIds },
          timestamp: { gte: startOfThisMonth, lt: startOfNextMonth },
        },
        select: { timestamp: true, verb: true },
      }),
      prisma.learningActivityLog.findMany({
        where: {
          courseId: { in: courseIds },
          timestamp: { gte: startOfLastMonth, lt: startOfThisMonth },
        },
        select: { timestamp: true, verb: true },
      }),
    ]);

    // Bucket each month by day-of-month (1..N). `null` for days outside
    // the recorded range so the client can decide whether to draw a point.
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

    const monthLabel = (d: Date) =>
      d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    // Per-course completion + student counts + a small sample of
    // participants (most-recently-enrolled, capped at 5) so the
    // dashboard can render an avatar stack without N extra queries.
    type Participant = { id: number; fullname: string | null; avatarUrl: string | null };
    const byCourse = new Map<number, { sum: number; count: number; students: number; sample: Array<{ enrolledAt: Date; user: Participant }> }>();
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
    const courseCompletion = ownedCourses.map(c => {
      const agg = byCourse.get(c.id);
      const pct = agg && agg.count > 0 ? agg.sum / agg.count : 0;
      // Prioritise students who have an uploaded profile picture so the
      // dashboard avatar stack reads as faces first; fall back to the
      // most-recently-enrolled for the remainder.
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
    courseCompletion.sort((a, b) => b.studentCount - a.studentCount || b.completionPct - a.completionPct);

    const totalStudents = courseCompletion.reduce((s, c) => s + c.studentCount, 0);

    return {
      kpis: {
        totalCourses: ownedCourses.length,
        totalStudents,
        totalAssignments: assignmentTotals,
        pendingGrading: pendingByCourse,
      },
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
      courseCompletion,
      activityByVerb,
    };
  }
}

const emptyEngagement = () => ({
  thisMonth: { counts: [] as number[], label: '', year: 0, month: 0, daysShown: 0 },
  lastMonth: { counts: [] as number[], label: '', year: 0, month: 0, daysShown: 0 },
});

export const meService = new MeService();
