/**
 * Serialising what students did.
 *
 * Kept out of `courseExport.service.ts` because it is a different job with
 * different rules. The design exporter walks one big `include` tree that is
 * already in memory; this one issues **separate, conditional queries** — an
 * activity log can run to hundreds of thousands of rows, and loading it into
 * every design-only export to then throw it away would be indefensible.
 *
 * So: nothing here runs unless its section was selected.
 *
 * ## The roster
 *
 * Personal rows reference people through a `people` roster keyed by email,
 * because a database id means nothing on another instance. The roster is built
 * from whatever the selected sections actually mention, not from every
 * enrollment — exporting only `grades` should not disclose the full class list.
 */

import prisma from '../utils/prisma.js';
import type { ExportSection } from './coursePackage.selection.js';

/** ISO or null, matching the design exporter's convention. */
const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export const personKey = (userId: number): string => `u${userId}`;
export const lectureKeyOf = (lectureId: number): string => `le${lectureId}`;
export const assignmentKeyOf = (id: number): string => `a${id}`;
export const quizKeyOf = (id: number): string => `q${id}`;
export const surveyKeyOf = (id: number): string => `s${id}`;
export const moduleKeyOf = (id: number): string => `m${id}`;
export const threadKeyOf = (id: number): string => `th${id}`;
export const postKeyOf = (id: number): string => `p${id}`;
export const sectionKeyOf = (id: number): string => `sec${id}`;
export const tutorKeyOf = (id: number): string => `t${id}`;

/**
 * Collects the people a package mentions, so the roster carries exactly them.
 *
 * Every serialiser calls `note(userId)` as it goes; the roster is built at the
 * end from what was actually referenced.
 */
export class PersonRoster {
  private ids = new Set<number>();

  note(userId: number | null | undefined): string | null {
    if (userId == null) return null;
    this.ids.add(userId);
    return personKey(userId);
  }

  get size(): number {
    return this.ids.size;
  }

  /**
   * Resolve every noted id to a roster entry.
   *
   * @param courseId used to label each person with their course role, which is
   *   informational only — the importer never grants anything from it.
   */
  async build(courseId: number): Promise<
    { key: string; email: string; fullname: string; role: string | null }[]
  > {
    if (!this.ids.size) return [];
    const ids = [...this.ids];
    const [users, roles, course] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, email: true, fullname: true },
      }),
      prisma.courseRole.findMany({
        where: { courseId, userId: { in: ids } },
        select: { userId: true, role: true },
      }),
      prisma.course.findUnique({ where: { id: courseId }, select: { instructorId: true } }),
    ]);
    const roleByUser = new Map(roles.map((r) => [r.userId, r.role]));
    return users.map((u) => ({
      key: personKey(u.id),
      email: u.email,
      fullname: u.fullname,
      role:
        u.id === course?.instructorId ? 'instructor' : (roleByUser.get(u.id) ?? 'student'),
    }));
  }
}

/** The ids the design half exported, so personal rows never dangle. */
export interface CourseScope {
  courseId: number;
  lectureIds: ReadonlySet<number>;
  assignmentIds: ReadonlySet<number>;
  quizIds: ReadonlySet<number>;
  surveyIds: ReadonlySet<number>;
  moduleIds: ReadonlySet<number>;
  sectionIds: ReadonlySet<number>;
  tutorIds: ReadonlySet<number>;
  /** Threads the `forums` section exported (staff-opened). */
  staffThreadIds: ReadonlySet<number>;
  /** Everyone who is course staff, used to split staff threads from student ones. */
  staffIds: ReadonlySet<number>;
}

export interface PersonalData {
  people?: Awaited<ReturnType<PersonRoster['build']>>;
  enrollments?: unknown[];
  lectureProgress?: unknown[];
  submissions?: unknown[];
  grades?: { assignments: unknown[]; quizAttempts: unknown[]; surveyResponses: unknown[] };
  discussions?: { threads: unknown[]; posts: unknown[] };
  conversations?: unknown[];
  activity?: unknown[];
}

/**
 * Hard cap on activity rows in one package.
 *
 * A busy course produces millions; the exporter builds the package in memory
 * and `JSON.stringify`s it, so an unbounded log is an out-of-memory crash
 * rather than a big download. The newest rows are kept and the shortfall is
 * reported as a warning, which is a far better outcome than a failed export or
 * a silently truncated one.
 */
export const MAX_ACTIVITY_ROWS = 200_000;

export interface PersonalExportResult {
  data: PersonalData;
  /** Upload URLs referenced by submissions, for the file collector. */
  referencedUploads: string[];
  warnings: string[];
}

/**
 * Serialise every selected personal-data section.
 *
 * @param scope which content ids the design half exported
 * @param selection the sections the caller asked for
 */
export async function collectPersonalData(
  scope: CourseScope,
  selection: readonly ExportSection[],
): Promise<PersonalExportResult> {
  const want = (s: ExportSection) => selection.includes(s);
  const roster = new PersonRoster();
  const data: PersonalData = {};
  const referencedUploads: string[] = [];
  const warnings: string[] = [];
  const { courseId } = scope;

  // --- enrollments ---------------------------------------------------------
  if (want('enrollments')) {
    const rows = await prisma.enrollment.findMany({
      where: { courseId },
      orderBy: { id: 'asc' },
    });
    data.enrollments = rows.map((e) => ({
      userKey: roster.note(e.userId)!,
      status: e.status,
      progress: e.progress,
      enrolledAt: iso(e.enrolledAt),
      completedAt: iso(e.completedAt),
      lastAccessAt: iso(e.lastAccessAt),
    }));
  }

  // --- progress ------------------------------------------------------------
  if (want('progress')) {
    const rows = await prisma.lectureProgress.findMany({
      where: { enrollment: { courseId }, lectureId: { in: [...scope.lectureIds] } },
      select: {
        lectureId: true,
        isCompleted: true,
        completedAt: true,
        timeSpent: true,
        enrollment: { select: { userId: true } },
      },
      orderBy: { id: 'asc' },
    });
    data.lectureProgress = rows.map((p) => ({
      userKey: roster.note(p.enrollment.userId)!,
      lectureKey: lectureKeyOf(p.lectureId),
      isCompleted: p.isCompleted,
      completedAt: iso(p.completedAt),
      timeSpent: p.timeSpent,
    }));
  }

  // --- submissions ---------------------------------------------------------
  // Fetched when EITHER section is on: `submissions` needs the body, `grades`
  // needs the marks off the same rows. One query serves both.
  const needSubmissions = want('submissions') || want('grades');
  const submissionRows = needSubmissions
    ? await prisma.assignmentSubmission.findMany({
        where: { assignmentId: { in: [...scope.assignmentIds] } },
        orderBy: { id: 'asc' },
      })
    : [];

  if (want('submissions')) {
    data.submissions = submissionRows.map((sub) => {
      // fileUrls is a JSON array of upload URLs; the collector needs them so
      // the blobs travel, or every attachment imports as a broken link.
      if (sub.fileUrls) {
        try {
          const parsed = JSON.parse(sub.fileUrls) as unknown;
          if (Array.isArray(parsed)) {
            parsed.forEach((u) => {
              if (typeof u === 'string' && u.startsWith('/uploads/')) referencedUploads.push(u);
            });
          }
        } catch {
          warnings.push(
            `Submission ${sub.id} has unreadable fileUrls; its attachments were not included.`,
          );
        }
      }
      return {
        userKey: roster.note(sub.userId)!,
        assignmentKey: assignmentKeyOf(sub.assignmentId),
        content: sub.content,
        fileUrls: sub.fileUrls,
        status: sub.status,
        submittedAt: iso(sub.submittedAt),
      };
    });
  }

  // --- grades --------------------------------------------------------------
  if (want('grades')) {
    const graded = submissionRows.filter((sub) => sub.grade != null || sub.feedback || sub.gradedAt);

    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId: { in: [...scope.quizIds] } },
      include: { answers: { orderBy: { questionId: 'asc' } } },
      orderBy: { id: 'asc' },
    });

    // Answers reference a question by position in the exported quiz, so the
    // question order the design half used has to be reproduced here exactly.
    const quizQuestions = await prisma.quizQuestion.findMany({
      where: { quizId: { in: [...scope.quizIds] } },
      select: { id: true, quizId: true },
      orderBy: [{ quizId: 'asc' }, { orderIndex: 'asc' }, { id: 'asc' }],
    });
    const questionIndex = new Map<number, number>();
    const perQuiz = new Map<number, number>();
    quizQuestions.forEach((q) => {
      const next = perQuiz.get(q.quizId) ?? 0;
      questionIndex.set(q.id, next);
      perQuiz.set(q.quizId, next + 1);
    });

    // A Survey row is GLOBAL — it has no courseId, and `ModuleSurvey` is unique
    // per (module, survey), so one institutional survey is routinely attached in
    // several courses at once. Filtering on surveyId alone therefore pulled in
    // every other course's responses, and `roster.note(r.userId)` below then
    // copied those foreign students' names and email addresses into `people`.
    //
    // A response is only exportable if it can be positively attributed to THIS
    // course: through one of its modules, or — for a post-survey — through one
    // of its assignments. A response that cannot be attributed (a standalone
    // run, or a module belonging to someone else's course) is left out rather
    // than guessed at, because the failure mode of guessing is disclosing a
    // third party's survey answers.
    const responses = await prisma.surveyResponse.findMany({
      where: {
        surveyId: { in: [...scope.surveyIds] },
        OR: [
          { moduleId: { in: [...scope.moduleIds] } },
          { context: 'assignment', contextId: { in: [...scope.assignmentIds] } },
        ],
      },
      include: { answers: true },
      orderBy: { id: 'asc' },
    });
    const surveyQuestions = await prisma.surveyQuestion.findMany({
      where: { surveyId: { in: [...scope.surveyIds] } },
      select: { id: true, surveyId: true },
      orderBy: [{ surveyId: 'asc' }, { orderIndex: 'asc' }, { id: 'asc' }],
    });
    const surveyQuestionIndex = new Map<number, number>();
    const perSurvey = new Map<number, number>();
    surveyQuestions.forEach((q) => {
      const next = perSurvey.get(q.surveyId) ?? 0;
      surveyQuestionIndex.set(q.id, next);
      perSurvey.set(q.surveyId, next + 1);
    });

    data.grades = {
      assignments: graded.map((sub) => ({
        userKey: roster.note(sub.userId)!,
        assignmentKey: assignmentKeyOf(sub.assignmentId),
        grade: sub.grade,
        feedback: sub.feedback,
        aiFeedback: sub.aiFeedback,
        gradedAt: iso(sub.gradedAt),
        // A grader who is not course staff (a departed instructor, an admin)
        // is not put in the roster just to name them.
        gradedByKey:
          sub.gradedById != null && scope.staffIds.has(sub.gradedById)
            ? roster.note(sub.gradedById)
            : null,
      })),
      quizAttempts: attempts.map((a) => ({
        userKey: roster.note(a.userId)!,
        quizKey: quizKeyOf(a.quizId),
        attemptNumber: a.attemptNumber,
        startedAt: iso(a.startedAt),
        submittedAt: iso(a.submittedAt),
        score: a.score,
        pointsEarned: a.pointsEarned,
        pointsTotal: a.pointsTotal,
        timeTaken: a.timeTaken,
        status: a.status,
        answers: a.answers
          .filter((ans) => questionIndex.has(ans.questionId))
          .map((ans) => ({
            questionIndex: questionIndex.get(ans.questionId)!,
            answer: ans.answer,
            isCorrect: ans.isCorrect,
            pointsAwarded: ans.pointsAwarded,
          })),
      })),
      surveyResponses: responses.map((r) => ({
        // An anonymous survey has no one to name, and inventing a key would
        // de-anonymise it on import.
        userKey: r.userId != null ? roster.note(r.userId) : null,
        surveyKey: surveyKeyOf(r.surveyId),
        moduleKey:
          r.moduleId != null && scope.moduleIds.has(r.moduleId) ? moduleKeyOf(r.moduleId) : null,
        context: r.context,
        completedAt: iso(r.completedAt),
        answers: r.answers
          .filter((ans) => surveyQuestionIndex.has(ans.questionId))
          .map((ans) => ({
            questionIndex: surveyQuestionIndex.get(ans.questionId)!,
            answerValue: ans.answerValue,
          })),
      })),
    };
  }

  // --- discussions ---------------------------------------------------------
  if (want('discussions')) {
    const threads = await prisma.forumThread.findMany({
      where: { courseId },
      orderBy: { id: 'asc' },
    });
    // Staff threads already travel in `forums` as course design; only their
    // replies belong here. Student-opened threads travel whole.
    const studentThreads = threads.filter((t) => !scope.staffIds.has(t.authorId));

    const posts = await prisma.forumPost.findMany({
      where: { threadId: { in: threads.map((t) => t.id) } },
      orderBy: { id: 'asc' },
    });

    data.discussions = {
      threads: studentThreads.map((t) => ({
        key: threadKeyOf(t.id),
        moduleKey:
          t.moduleId != null && scope.moduleIds.has(t.moduleId) ? moduleKeyOf(t.moduleId) : null,
        // An anonymous thread keeps its author out of the package entirely.
        authorKey: t.isAnonymous ? null : roster.note(t.authorId),
        title: t.title,
        content: t.content,
        isPinned: t.isPinned,
        isLocked: t.isLocked,
        isAnonymous: t.isAnonymous,
        viewCount: t.viewCount,
        createdAt: iso(t.createdAt),
      })),
      posts: posts.map((post) => ({
        key: postKeyOf(post.id),
        threadKey: threadKeyOf(post.threadId),
        parentKey: post.parentId != null ? postKeyOf(post.parentId) : null,
        authorKey: post.isAnonymous ? null : roster.note(post.authorId),
        content: post.content,
        isAnonymous: post.isAnonymous,
        isEdited: post.isEdited,
        isAiGenerated: post.isAiGenerated,
        aiAgentName: post.aiAgentName,
        createdAt: iso(post.createdAt),
      })),
    };
  }

  // --- conversations -------------------------------------------------------
  if (want('conversations')) {
    const [chatbotConvs, tutorConvs] = await Promise.all([
      prisma.chatbotConversation.findMany({
        where: { sectionId: { in: [...scope.sectionIds] } },
        include: { messages: { orderBy: { id: 'asc' } } },
        orderBy: { id: 'asc' },
      }),
      prisma.courseTutorConversation.findMany({
        where: { courseTutorId: { in: [...scope.tutorIds] } },
        include: { messages: { orderBy: { id: 'asc' } } },
        orderBy: { id: 'asc' },
      }),
    ]);

    const message = (m: { role: string; content: string; createdAt: Date }) => ({
      role: m.role,
      content: m.content,
      createdAt: iso(m.createdAt),
    });

    data.conversations = [
      ...chatbotConvs.map((c) => ({
        kind: 'chatbot-section' as const,
        userKey: roster.note(c.userId)!,
        sectionKey: sectionKeyOf(c.sectionId),
        tutorKey: null,
        title: null,
        createdAt: iso(c.createdAt),
        messages: c.messages.map(message),
      })),
      ...tutorConvs.map((c) => ({
        kind: 'course-tutor' as const,
        userKey: roster.note(c.userId)!,
        sectionKey: null,
        tutorKey: tutorKeyOf(c.courseTutorId),
        title: c.title,
        createdAt: iso(c.createdAt),
        messages: c.messages.map(message),
      })),
    ];
  }

  // --- activity ------------------------------------------------------------
  if (want('activity')) {
    const total = await prisma.learningActivityLog.count({ where: { courseId } });
    const rows = await prisma.learningActivityLog.findMany({
      where: { courseId },
      // Newest first, then reversed: when the cap bites, the recent history is
      // the part anyone actually wants.
      orderBy: { timestamp: 'desc' },
      take: MAX_ACTIVITY_ROWS,
    });
    if (total > MAX_ACTIVITY_ROWS) {
      warnings.push(
        `The activity log has ${total} rows; only the most recent ${MAX_ACTIVITY_ROWS} were exported.`,
      );
    }
    data.activity = rows.reverse().map((r) => ({
      userKey: roster.note(r.userId)!,
      sessionId: r.sessionId,
      verb: r.verb,
      objectType: r.objectType,
      objectTitle: r.objectTitle,
      objectSubtype: r.objectSubtype,
      courseTitle: r.courseTitle,
      moduleTitle: r.moduleTitle,
      lectureTitle: r.lectureTitle,
      sectionTitle: r.sectionTitle,
      success: r.success,
      score: r.score,
      maxScore: r.maxScore,
      progress: r.progress,
      duration: r.duration,
      extensions: r.extensions,
      timestamp: iso(r.timestamp),
      deviceType: r.deviceType,
      browserName: r.browserName,
      actionSubtype: r.actionSubtype,
      eventUuid: r.eventUuid,
      route: r.route,
    }));
  }

  // The roster is built last, from exactly who the selected sections named.
  if (roster.size) {
    data.people = await roster.build(courseId);
  }

  return { data, referencedUploads, warnings };
}
