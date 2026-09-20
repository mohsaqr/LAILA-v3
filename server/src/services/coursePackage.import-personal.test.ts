/**
 * Importing the personal-data sections.
 *
 * The rule under test everywhere here: **an import never creates a user.** A
 * package is an uploaded file, and the roster carries emails — the identity the
 * whole platform keys on. If importing could mint accounts, a crafted roster
 * would be an account-creation primitive for anyone allowed to import.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { minimalPackage } from './coursePackage.fixtures.js';
import type { CoursePackage } from './coursePackage.schema.js';

// ---- fs: nothing touches the real uploads directory -------------------------
vi.mock('node:fs', () => ({
  default: {
    promises: {
      mkdir: vi.fn(async () => undefined),
      writeFile: vi.fn(async () => undefined),
      unlink: vi.fn(async () => undefined),
      readFile: vi.fn(async () => {
        throw new Error('not used');
      }),
    },
  },
}));

type Call = { model: string; op: string; args: any; id: number };
const calls: Call[] = [];
let nextId = 100;

const record = (model: string, op: string) =>
  vi.fn(async (args: any) => {
    const id = nextId++;
    calls.push({ model, op, args, id });
    if (op === 'createMany') return { count: args.data.length };
    return { id, ...(args?.data ?? args?.create ?? {}) };
  });

/** Users that exist on the importing instance. */
let knownUsers: { id: number; email: string }[] = [];

const tx: any = {
  course: {
    create: record('course', 'create'),
    update: record('course', 'update'),
    findUnique: vi.fn(async () => ({ instructorId: COURSE_OWNER_ID })),
  },
  category: { upsert: record('category', 'upsert') },
  courseCategory: { create: record('courseCategory', 'create') },
  chatbot: { findUnique: vi.fn(async () => ({ id: 7 })), create: record('chatbot', 'create') },
  survey: { create: record('survey', 'create') },
  customLab: { create: record('customLab', 'create') },
  courseModule: { create: record('courseModule', 'create') },
  lecture: { create: record('lecture', 'create') },
  lectureSection: {
    createMany: record('lectureSection', 'createMany'),
    findMany: vi.fn(async () => [{ id: 611 }]),
  },
  lectureAttachment: { createMany: record('lectureAttachment', 'createMany') },
  moduleSurvey: { create: record('moduleSurvey', 'create') },
  assignment: { create: record('assignment', 'create') },
  quiz: { create: record('quiz', 'create') },
  quizQuestion: { findMany: vi.fn(async () => [{ id: 901 }, { id: 902 }]) },
  surveyQuestion: { findMany: vi.fn(async () => [{ id: 801 }]) },
  codeLab: { create: record('codeLab', 'create') },
  labAssignment: { create: record('labAssignment', 'create') },
  forumThread: { create: record('forumThread', 'create') },
  forumPost: { create: record('forumPost', 'create') },
  courseTutor: { create: record('courseTutor', 'create') },
  rubric: { create: record('rubric', 'create') },
  // The personal-data tables
  user: {
    findMany: vi.fn(async (args: any) => {
      const wanted: string[] = args?.where?.email?.in ?? [];
      return knownUsers.filter((u) => wanted.includes(u.email));
    }),
    create: record('user', 'create'),
  },
  enrollment: { create: record('enrollment', 'create') },
  lectureProgress: { create: record('lectureProgress', 'create') },
  assignmentSubmission: { create: record('assignmentSubmission', 'create') },
  quizAttempt: { create: record('quizAttempt', 'create') },
  surveyResponse: { create: record('surveyResponse', 'create') },
  chatbotConversation: { create: record('chatbotConversation', 'create') },
  courseTutorConversation: { create: record('courseTutorConversation', 'create') },
  learningActivityLog: { createMany: record('learningActivityLog', 'createMany') },
};

vi.mock('../utils/prisma.js', () => ({
  default: {
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  },
}));

vi.mock('../utils/uploadFiles.js', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual };
});

import { courseImportService } from './courseImport.service.js';

/** The importing user; becomes the new course's owner. */
const OWNER_ID = 42;
/**
 * What the transaction reports as the new course's instructor.
 *
 * Deliberately NOT equal to OWNER_ID: an anonymous thread falls back to the
 * course owner for its author column, and if both numbers were 42 the
 * assertion could not tell that path from simply reusing the importer's id.
 */
const COURSE_OWNER_ID = 777;
/** No package here carries blobs, so nothing is ever read. */
const readBlob = async () => null;

const find = (model: string, op?: string) =>
  calls.filter((c) => c.model === model && (!op || c.op === op));

/** A package carrying personal data for Ada (known) and Zoe (unknown here). */
const packageWithPeople = (): CoursePackage => {
  const pkg = minimalPackage() as CoursePackage;
  pkg.files = [];
  pkg.people = [
    { key: 'u2', email: 'ada@x.edu', fullname: 'Ada', role: 'student' },
    { key: 'u9', email: 'zoe@elsewhere.edu', fullname: 'Zoe', role: 'student' },
  ];
  pkg.enrollments = [
    { userKey: 'u2', status: 'active', progress: 0.5, enrolledAt: '2026-09-01T10:00:00.000Z', completedAt: null, lastAccessAt: null },
    { userKey: 'u9', status: 'active', progress: 0.1, enrolledAt: '2026-09-01T10:00:00.000Z', completedAt: null, lastAccessAt: null },
  ];
  return pkg;
};

beforeEach(() => {
  calls.length = 0;
  nextId = 100;
  knownUsers = [{ id: 502, email: 'ada@x.edu' }];
  vi.clearAllMocks();
  tx.course.findUnique.mockResolvedValue({ instructorId: COURSE_OWNER_ID });
  tx.lectureSection.findMany.mockResolvedValue([{ id: 611 }]);
  tx.quizQuestion.findMany.mockResolvedValue([{ id: 901 }, { id: 902 }]);
  tx.surveyQuestion.findMany.mockResolvedValue([{ id: 801 }]);
  tx.user.findMany.mockImplementation(async (args: any) => {
    const wanted: string[] = args?.where?.email?.in ?? [];
    return knownUsers.filter((u) => wanted.includes(u.email));
  });
  tx.chatbot.findUnique.mockResolvedValue({ id: 7 });
});

describe('people matching', () => {
  it('matches by email and reports who could not be matched', async () => {
    const report = await courseImportService.importPackage(packageWithPeople(), null, readBlob, OWNER_ID);

    expect(report.people).toEqual({ matched: 1, unmatched: ['zoe@elsewhere.edu'] });
    expect(report.warnings.join(' ')).toMatch(/1 of 2 people/);
    expect(report.warnings.join(' ')).toMatch(/Invite them and re-import/);
  });

  // The load-bearing rule.
  it('NEVER creates a user for an unmatched person', async () => {
    await courseImportService.importPackage(packageWithPeople(), null, readBlob, OWNER_ID);
    expect(find('user', 'create')).toHaveLength(0);
  });

  it('skips every row belonging to an unmatched person', async () => {
    const report = await courseImportService.importPackage(packageWithPeople(), null, readBlob, OWNER_ID);
    const enrollments = find('enrollment', 'create');
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0].args.data.userId).toBe(502);
    expect(report.personalCounts?.enrollments).toBe(1);
  });

  it('matches emails case-insensitively', async () => {
    const pkg = packageWithPeople();
    pkg.people = [{ key: 'u2', email: 'ADA@X.EDU', fullname: 'Ada', role: null }];
    pkg.enrollments = [pkg.enrollments![0]];
    const report = await courseImportService.importPackage(pkg, null, readBlob, OWNER_ID);
    expect(report.people?.matched).toBe(1);
  });

  it('reports nothing personal for a design-only package', async () => {
    const pkg = minimalPackage() as CoursePackage;
    pkg.files = [];
    const report = await courseImportService.importPackage(pkg, null, readBlob, OWNER_ID);
    expect(report.people).toBeUndefined();
    expect(report.personalCounts).toBeUndefined();
    expect(find('enrollment', 'create')).toHaveLength(0);
  });
});

describe('progress', () => {
  it('skips progress for someone with no enrollment row to hang it on', async () => {
    const pkg = packageWithPeople();
    pkg.enrollments = []; // nobody enrolled
    pkg.lectureProgress = [
      { userKey: 'u2', lectureKey: 'le1', isCompleted: true, completedAt: null, timeSpent: 60 },
    ];
    const report = await courseImportService.importPackage(pkg, null, readBlob, OWNER_ID);
    expect(find('lectureProgress', 'create')).toHaveLength(0);
    expect(report.personalCounts?.lectureProgress).toBe(0);
  });
});

describe('submissions and grades', () => {
  const withAssignmentData = (opts: { submission?: boolean; grade?: boolean }) => {
    const pkg = packageWithPeople();
    pkg.enrollments = [];
    const assignmentKey = pkg.assignments[0]?.key;
    if (opts.submission) {
      pkg.submissions = [
        { userKey: 'u2', assignmentKey, content: 'my essay', fileUrls: null, status: 'submitted', submittedAt: '2026-09-01T10:00:00.000Z' },
      ];
    }
    if (opts.grade) {
      pkg.grades = {
        assignments: [
          { userKey: 'u2', assignmentKey, grade: 88, feedback: 'good', aiFeedback: null, gradedAt: '2026-09-02T10:00:00.000Z', gradedByKey: null },
        ],
        quizAttempts: [],
        surveyResponses: [],
      };
    }
    return pkg;
  };

  it('merges a submission and its grade into one row', async () => {
    await courseImportService.importPackage(
      withAssignmentData({ submission: true, grade: true }),
      null,
      readBlob,
      OWNER_ID,
    );
    const rows = find('assignmentSubmission', 'create');
    expect(rows).toHaveLength(1);
    expect(rows[0].args.data).toMatchObject({ content: 'my essay', grade: 88, feedback: 'good' });
  });

  // The reason `grades` is its own section: a gradebook-only package must still
  // land the marks.
  it('creates a row for a grade with no submission body', async () => {
    await courseImportService.importPackage(withAssignmentData({ grade: true }), null, readBlob, OWNER_ID);
    const rows = find('assignmentSubmission', 'create');
    expect(rows).toHaveLength(1);
    expect(rows[0].args.data).toMatchObject({ grade: 88, content: null, status: 'graded' });
  });

  it('creates an ungraded row for a submission with no grade', async () => {
    await courseImportService.importPackage(withAssignmentData({ submission: true }), null, readBlob, OWNER_ID);
    const rows = find('assignmentSubmission', 'create');
    expect(rows).toHaveLength(1);
    expect(rows[0].args.data).toMatchObject({ content: 'my essay', grade: null });
  });
});

describe('discussions', () => {
  const withPosts = () => {
    const pkg = packageWithPeople();
    pkg.enrollments = [];
    pkg.discussions = {
      threads: [
        { key: 'th82', moduleKey: null, authorKey: 'u2', title: 'Student thread', content: 'c', isPinned: false, isLocked: false, isAnonymous: false, viewCount: 1, createdAt: '2026-09-01T10:00:00.000Z' },
      ],
      posts: [
        // Deliberately child-before-parent, to prove ordering is resolved.
        { key: 'p2', threadKey: 'th82', parentKey: 'p1', authorKey: 'u2', content: 'reply', isAnonymous: false, isEdited: false, isAiGenerated: false, aiAgentName: null, createdAt: '2026-09-01T11:00:00.000Z' },
        { key: 'p1', threadKey: 'th82', parentKey: null, authorKey: 'u2', content: 'root', isAnonymous: false, isEdited: false, isAiGenerated: false, aiAgentName: null, createdAt: '2026-09-01T10:30:00.000Z' },
      ],
    };
    return pkg;
  };

  it('writes parents before children and rewires parentId to the new id', async () => {
    const report = await courseImportService.importPackage(withPosts(), null, readBlob, OWNER_ID);
    const posts = find('forumPost', 'create');
    expect(posts).toHaveLength(2);
    // Root first, despite appearing second in the package.
    expect(posts[0].args.data.content).toBe('root');
    expect(posts[0].args.data.parentId).toBeNull();
    expect(posts[1].args.data.content).toBe('reply');
    expect(posts[1].args.data.parentId).toBe(posts[0].id);
    expect(report.personalCounts?.discussionPosts).toBe(2);
  });

  it('attributes an anonymous thread to the course owner while keeping the flag', async () => {
    const pkg = withPosts();
    pkg.discussions!.threads[0].authorKey = null;
    pkg.discussions!.threads[0].isAnonymous = true;
    pkg.discussions!.posts = [];
    await courseImportService.importPackage(pkg, null, readBlob, OWNER_ID);
    // The staff thread from `forums` is created first; ours is the last one.
    const threads = find('forumThread', 'create');
    const anon = threads[threads.length - 1];
    expect(anon.args.data.isAnonymous).toBe(true);
    expect(anon.args.data.authorId).toBe(COURSE_OWNER_ID);
  });

  it('warns rather than hanging when parentKeys form a cycle', async () => {
    const pkg = withPosts();
    pkg.discussions!.posts = [
      { key: 'pa', threadKey: 'th82', parentKey: 'pb', authorKey: 'u2', content: 'a', isAnonymous: false, isEdited: false, isAiGenerated: false, aiAgentName: null, createdAt: '2026-09-01T10:00:00.000Z' },
      { key: 'pb', threadKey: 'th82', parentKey: 'pa', authorKey: 'u2', content: 'b', isAnonymous: false, isEdited: false, isAiGenerated: false, aiAgentName: null, createdAt: '2026-09-01T10:00:00.000Z' },
    ];
    const report = await courseImportService.importPackage(pkg, null, readBlob, OWNER_ID);
    expect(find('forumPost', 'create')).toHaveLength(0);
    expect(report.warnings.join(' ')).toMatch(/unresolvable parents/);
  });
});

describe('activity', () => {
  it('bulk-inserts and drops eventUuid so a re-import cannot collide', async () => {
    const pkg = packageWithPeople();
    pkg.enrollments = [];
    pkg.activity = [
      { userKey: 'u2', sessionId: null, verb: 'viewed', objectType: 'lecture', objectTitle: 'L1', objectSubtype: null, courseTitle: 'C', moduleTitle: null, lectureTitle: null, sectionTitle: null, success: true, score: null, maxScore: null, progress: null, duration: null, extensions: null, timestamp: '2026-09-01T10:00:00.000Z', deviceType: null, browserName: null, actionSubtype: null, eventUuid: 'e1', route: null },
      { userKey: 'u9', sessionId: null, verb: 'viewed', objectType: 'lecture', objectTitle: 'L2', objectSubtype: null, courseTitle: 'C', moduleTitle: null, lectureTitle: null, sectionTitle: null, success: true, score: null, maxScore: null, progress: null, duration: null, extensions: null, timestamp: '2026-09-01T10:00:00.000Z', deviceType: null, browserName: null, actionSubtype: null, eventUuid: 'e2', route: null },
    ];

    const report = await courseImportService.importPackage(pkg, null, readBlob, OWNER_ID);

    const bulk = find('learningActivityLog', 'createMany');
    expect(bulk).toHaveLength(1);
    // Only Ada's row: Zoe has no account here.
    expect(bulk[0].args.data).toHaveLength(1);
    expect(bulk[0].args.data[0]).not.toHaveProperty('eventUuid');
    expect(report.personalCounts?.activity).toBe(1);
  });
});
