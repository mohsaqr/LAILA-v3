import prisma from '../utils/prisma.js';
import {
  computeMonthlyEngagement,
  computeCourseCompletion,
  emptyEngagement,
} from '../utils/dashboardAggregations.js';

/**
 * Per-user dashboard aggregations. Each method takes the user id from
 * the JWT (the route layer reads `req.user.id`) and never accepts a
 * userId param — these endpoints are intentionally "me only".
 */
export class MeService {
  /**
   * Surfaces the courses a student should resume. Returns every
   * active enrollment (so newly-enrolled courses appear immediately,
   * even before the student opens a lecture). When the student has
   * opened a lecture in the course we layer the view info on top of
   * the enrollment row so the rail can deep-link them straight back
   * to where they were. Sort order:
   *   1. Most recent lecture view (if any)
   *   2. Most recent enrollment timestamp (fallback)
   * — newest first, capped at `limit`.
   */
  async getContinueLearning(userId: number, limit = 50) {
    // Every active enrollment for the user, with course shell.
    const enrollments = await prisma.enrollment.findMany({
      where: { userId, status: 'active' },
      orderBy: { enrolledAt: 'desc' },
      select: {
        courseId: true,
        progress: true,
        enrolledAt: true,
        course: {
          select: { id: true, title: true, slug: true, thumbnail: true },
        },
      },
    });
    if (enrollments.length === 0) return [];

    const enrolledIds = enrollments.map(e => e.courseId);

    // Most recent lecture view per enrolled course, if any. Over-fetch
    // and dedupe in memory to stay portable across SQLite / Postgres.
    const recentViews = await prisma.learningActivityLog.findMany({
      where: {
        userId,
        objectType: 'lecture',
        verb: 'viewed',
        courseId: { in: enrolledIds },
        lectureId: { not: null },
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
      select: {
        timestamp: true,
        courseId: true,
        moduleId: true,
        moduleTitle: true,
        lectureId: true,
        lectureTitle: true,
      },
    });
    const viewByCourse = new Map<number, typeof recentViews[number]>();
    for (const v of recentViews) {
      if (v.courseId != null && !viewByCourse.has(v.courseId)) {
        viewByCourse.set(v.courseId, v);
      }
    }

    const rows = enrollments.map(e => {
      const view = viewByCourse.get(e.courseId);
      return {
        courseId: e.courseId,
        courseTitle: e.course.title,
        courseSlug: e.course.slug,
        courseThumbnail: e.course.thumbnail,
        moduleId: view?.moduleId ?? null,
        moduleTitle: view?.moduleTitle ?? null,
        lectureId: view?.lectureId ?? null,
        lectureTitle: view?.lectureTitle ?? null,
        progress: e.progress,
        // Use the view timestamp if we have one, otherwise the
        // enrollment timestamp so freshly-enrolled courses still
        // sort to the top.
        lastViewedAt: (view?.timestamp ?? e.enrolledAt).toISOString(),
      };
    });

    // Newest first, then cap.
    rows.sort((a, b) => b.lastViewedAt.localeCompare(a.lastViewedAt));
    return rows.slice(0, limit);
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
      select: { id: true },
    });
    const courseIds = ownedCourses.map(c => c.id);

    if (courseIds.length === 0) {
      return {
        kpis: { totalCourses: 0, totalStudents: 0, totalAssignments: 0, pendingGrading: 0 },
        engagement: emptyEngagement(),
        courseCompletion: [] as Awaited<ReturnType<typeof computeCourseCompletion>>,
        activityByVerb: {} as Record<string, number>,
      };
    }

    const [{ engagement, activityByVerb }, courseCompletion, assignmentTotals, pendingByCourse] =
      await Promise.all([
        computeMonthlyEngagement(courseIds),
        computeCourseCompletion({ instructorId: userId }),
        prisma.assignment.count({ where: { courseId: { in: courseIds } } }),
        prisma.assignmentSubmission.count({
          where: {
            status: 'submitted',
            gradedAt: null,
            assignment: { courseId: { in: courseIds } },
          },
        }),
      ]);

    const totalStudents = courseCompletion.reduce((s, c) => s + c.studentCount, 0);

    return {
      kpis: {
        totalCourses: ownedCourses.length,
        totalStudents,
        totalAssignments: assignmentTotals,
        pendingGrading: pendingByCourse,
      },
      engagement,
      courseCompletion,
      activityByVerb,
    };
  }
}

export const meService = new MeService();
