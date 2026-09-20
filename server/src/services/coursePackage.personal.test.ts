import { describe, it, expect, beforeEach, vi } from 'vitest';
import prisma from '../utils/prisma.js';
import {
  collectPersonalData,
  PersonRoster,
  MAX_ACTIVITY_ROWS,
  type CourseScope,
} from './coursePackage.personal.js';
import { DESIGN_SECTIONS, parseSelection } from './coursePackage.selection.js';

vi.mock('../utils/prisma.js', () => ({
  default: {
    enrollment: { findMany: vi.fn() },
    lectureProgress: { findMany: vi.fn() },
    assignmentSubmission: { findMany: vi.fn() },
    quizAttempt: { findMany: vi.fn() },
    quizQuestion: { findMany: vi.fn() },
    surveyResponse: { findMany: vi.fn() },
    surveyQuestion: { findMany: vi.fn() },
    forumThread: { findMany: vi.fn() },
    forumPost: { findMany: vi.fn() },
    chatbotConversation: { findMany: vi.fn() },
    courseTutorConversation: { findMany: vi.fn() },
    learningActivityLog: { findMany: vi.fn(), count: vi.fn() },
    user: { findMany: vi.fn() },
    courseRole: { findMany: vi.fn() },
    course: { findUnique: vi.fn() },
  },
}));

const scope: CourseScope = {
  courseId: 7,
  lectureIds: new Set([11, 12]),
  assignmentIds: new Set([21]),
  quizIds: new Set([31]),
  surveyIds: new Set([41]),
  moduleIds: new Set([51]),
  sectionIds: new Set([61]),
  tutorIds: new Set([71]),
  staffThreadIds: new Set([81]),
  staffIds: new Set([1]), // user 1 is the instructor
};

const D = new Date('2026-09-01T10:00:00.000Z');

/** Everything returns empty unless a test says otherwise. */
const resetMocks = () => {
  vi.mocked(prisma.enrollment.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.lectureProgress.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.quizAttempt.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.quizQuestion.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.surveyResponse.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.surveyQuestion.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.forumThread.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.forumPost.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.chatbotConversation.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.courseTutorConversation.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.learningActivityLog.count).mockResolvedValue(0 as never);
  // Honours the `where.id.in` filter, as the real query does — a mock that
  // returned everyone would make the roster look broader than the code builds
  // it, and hide the very scoping these tests are checking.
  const allUsers = [
    { id: 1, email: 'teacher@x.edu', fullname: 'Teacher' },
    { id: 2, email: 'ada@x.edu', fullname: 'Ada' },
    { id: 3, email: 'bob@x.edu', fullname: 'Bob' },
  ];
  vi.mocked(prisma.user.findMany).mockImplementation((async (args: {
    where?: { id?: { in?: number[] } };
  }) => {
    const wanted = args?.where?.id?.in;
    return wanted ? allUsers.filter((u) => wanted.includes(u.id)) : allUsers;
  }) as never);
  vi.mocked(prisma.courseRole.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.course.findUnique).mockResolvedValue({ instructorId: 1 } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  resetMocks();
});

describe('section gating', () => {
  // The performance promise: an activity log can run to hundreds of thousands
  // of rows, so a design-only export must not touch any of these tables.
  it('issues NO personal queries for a design-only selection', async () => {
    const result = await collectPersonalData(scope, DESIGN_SECTIONS);
    expect(result.data).toEqual({});
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
    expect(prisma.assignmentSubmission.findMany).not.toHaveBeenCalled();
    expect(prisma.learningActivityLog.findMany).not.toHaveBeenCalled();
    expect(prisma.forumThread.findMany).not.toHaveBeenCalled();
    expect(prisma.chatbotConversation.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('queries only the tables a selection needs', async () => {
    await collectPersonalData(scope, parseSelection('enrollments'));
    expect(prisma.enrollment.findMany).toHaveBeenCalled();
    expect(prisma.learningActivityLog.findMany).not.toHaveBeenCalled();
    expect(prisma.forumThread.findMany).not.toHaveBeenCalled();
  });

  it('shares one submission query between submissions and grades', async () => {
    await collectPersonalData(scope, parseSelection('submissions,grades'));
    expect(prisma.assignmentSubmission.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('enrollments', () => {
  it('serialises rows and builds the roster from them', async () => {
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { userId: 2, status: 'active', progress: 0.5, enrolledAt: D, completedAt: null, lastAccessAt: D },
    ] as never);

    const { data } = await collectPersonalData(scope, parseSelection('enrollments'));

    expect(data.enrollments).toEqual([
      {
        userKey: 'u2',
        status: 'active',
        progress: 0.5,
        enrolledAt: D.toISOString(),
        completedAt: null,
        lastAccessAt: D.toISOString(),
      },
    ]);
    expect(data.people).toEqual([
      { key: 'u2', email: 'ada@x.edu', fullname: 'Ada', role: 'student' },
    ]);
  });
});

describe('the roster', () => {
  // Exporting only grades should not disclose the full class list.
  it('contains only the people the selected sections actually mention', async () => {
    vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue([
      { id: 1, userId: 2, assignmentId: 21, content: 'x', fileUrls: null, status: 'submitted', submittedAt: D, grade: null, feedback: null, aiFeedback: null, gradedAt: null, gradedById: null },
    ] as never);

    const { data } = await collectPersonalData(scope, parseSelection('submissions'));

    // Only user 2 is referenced, though the mock could return 1 and 3 too.
    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0]).toMatchObject({
      where: { id: { in: [2] } },
    });
    expect(data.people?.map((p) => p.key)).toEqual(['u2']);
  });

  it('labels the course instructor', async () => {
    const roster = new PersonRoster();
    roster.note(1);
    roster.note(2);
    const people = await roster.build(7);
    expect(people.find((p) => p.key === 'u1')?.role).toBe('instructor');
    expect(people.find((p) => p.key === 'u2')?.role).toBe('student');
  });

  it('is empty, and does not query, when nothing referenced anyone', async () => {
    const roster = new PersonRoster();
    expect(await roster.build(7)).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('submissions', () => {
  it('reports attachment URLs so the blobs travel', async () => {
    vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue([
      {
        id: 1, userId: 2, assignmentId: 21, content: null,
        fileUrls: JSON.stringify(['/uploads/a-essay.pdf', '/uploads/b-data.csv']),
        status: 'submitted', submittedAt: D, grade: null, feedback: null, aiFeedback: null,
        gradedAt: null, gradedById: null,
      },
    ] as never);

    const { referencedUploads } = await collectPersonalData(scope, parseSelection('submissions'));
    expect(referencedUploads).toEqual(['/uploads/a-essay.pdf', '/uploads/b-data.csv']);
  });

  it('warns rather than throwing on unreadable fileUrls', async () => {
    vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue([
      { id: 9, userId: 2, assignmentId: 21, content: null, fileUrls: '{not json', status: 'submitted', submittedAt: D, grade: null, feedback: null, aiFeedback: null, gradedAt: null, gradedById: null },
    ] as never);

    const { data, warnings } = await collectPersonalData(scope, parseSelection('submissions'));
    expect(data.submissions).toHaveLength(1);
    expect(warnings.join(' ')).toMatch(/unreadable fileUrls/);
  });

  it('ignores anything in fileUrls that is not an upload path', async () => {
    vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue([
      { id: 1, userId: 2, assignmentId: 21, content: null, fileUrls: JSON.stringify(['https://evil.example/x', '/uploads/ok.pdf', 42]), status: 'submitted', submittedAt: D, grade: null, feedback: null, aiFeedback: null, gradedAt: null, gradedById: null },
    ] as never);
    const { referencedUploads } = await collectPersonalData(scope, parseSelection('submissions'));
    expect(referencedUploads).toEqual(['/uploads/ok.pdf']);
  });
});

describe('grades', () => {
  const graded = [
    { id: 1, userId: 2, assignmentId: 21, content: 'essay', fileUrls: null, status: 'graded', submittedAt: D, grade: 88, feedback: 'good', aiFeedback: null, gradedAt: D, gradedById: 1 },
    { id: 2, userId: 3, assignmentId: 21, content: 'essay', fileUrls: null, status: 'submitted', submittedAt: D, grade: null, feedback: null, aiFeedback: null, gradedAt: null, gradedById: null },
  ];

  // The reason grades is a section of its own: a gradebook export should work
  // without dragging every essay body along.
  it('carries assignment grades even when submissions was not selected', async () => {
    vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue(graded as never);
    const { data } = await collectPersonalData(scope, parseSelection('grades'));
    expect(data.submissions).toBeUndefined();
    expect(data.grades?.assignments).toEqual([
      {
        userKey: 'u2',
        assignmentKey: 'a21',
        grade: 88,
        feedback: 'good',
        aiFeedback: null,
        gradedAt: D.toISOString(),
        gradedByKey: 'u1',
      },
    ]);
  });

  it('omits ungraded submissions from the grade list', async () => {
    vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue(graded as never);
    const { data } = await collectPersonalData(scope, parseSelection('grades'));
    expect(data.grades?.assignments.map((g) => (g as { userKey: string }).userKey)).toEqual(['u2']);
  });

  it('does not add a non-staff grader to the roster', async () => {
    vi.mocked(prisma.assignmentSubmission.findMany).mockResolvedValue([
      { ...graded[0], gradedById: 99 },
    ] as never);
    const { data } = await collectPersonalData(scope, parseSelection('grades'));
    expect((data.grades?.assignments[0] as { gradedByKey: string | null }).gradedByKey).toBeNull();
    expect(data.people?.map((p) => p.key)).toEqual(['u2']);
  });

  it('maps quiz answers to question position, not question id', async () => {
    vi.mocked(prisma.quizAttempt.findMany).mockResolvedValue([
      {
        id: 1, quizId: 31, userId: 2, attemptNumber: 1, startedAt: D, submittedAt: D,
        score: 0.5, pointsEarned: 1, pointsTotal: 2, timeTaken: 60, status: 'submitted',
        answers: [
          { questionId: 502, answer: 'b', isCorrect: true, pointsAwarded: 1 },
          { questionId: 501, answer: 'a', isCorrect: false, pointsAwarded: 0 },
        ],
      },
    ] as never);
    // Exported order is orderIndex: 501 first, 502 second.
    vi.mocked(prisma.quizQuestion.findMany).mockResolvedValue([
      { id: 501, quizId: 31 },
      { id: 502, quizId: 31 },
    ] as never);

    const { data } = await collectPersonalData(scope, parseSelection('grades'));
    const answers = (data.grades?.quizAttempts[0] as { answers: { questionIndex: number }[] }).answers;
    expect(answers.map((a) => a.questionIndex)).toEqual([1, 0]);
  });

  it('drops an answer whose question is not in the exported quiz', async () => {
    vi.mocked(prisma.quizAttempt.findMany).mockResolvedValue([
      { id: 1, quizId: 31, userId: 2, attemptNumber: 1, startedAt: D, submittedAt: D, score: 1, pointsEarned: 1, pointsTotal: 1, timeTaken: 1, status: 'submitted',
        answers: [{ questionId: 999, answer: 'x', isCorrect: null, pointsAwarded: null }] },
    ] as never);
    vi.mocked(prisma.quizQuestion.findMany).mockResolvedValue([{ id: 501, quizId: 31 }] as never);
    const { data } = await collectPersonalData(scope, parseSelection('grades'));
    expect((data.grades?.quizAttempts[0] as { answers: unknown[] }).answers).toEqual([]);
  });

  // Naming an anonymous respondent would de-anonymise them on import.
  it('keeps an anonymous survey response anonymous', async () => {
    vi.mocked(prisma.surveyResponse.findMany).mockResolvedValue([
      { id: 1, surveyId: 41, userId: null, moduleId: null, context: 'standalone', completedAt: D, answers: [] },
    ] as never);
    const { data } = await collectPersonalData(scope, parseSelection('grades'));
    expect((data.grades?.surveyResponses[0] as { userKey: string | null }).userKey).toBeNull();
    expect(data.people ?? []).toEqual([]);
  });
});

describe('discussions', () => {
  const threads = [
    { id: 81, courseId: 7, authorId: 1, moduleId: 51, title: 'Staff thread', content: 'c', isPinned: false, isLocked: false, isAnonymous: false, viewCount: 3, createdAt: D },
    { id: 82, courseId: 7, authorId: 2, moduleId: null, title: 'Student thread', content: 'c', isPinned: false, isLocked: false, isAnonymous: false, viewCount: 1, createdAt: D },
    { id: 83, courseId: 7, authorId: 3, moduleId: null, title: 'Anon thread', content: 'c', isPinned: false, isLocked: false, isAnonymous: true, viewCount: 0, createdAt: D },
  ];

  // Staff threads are course design and already travel in `forums`; only their
  // replies belong here.
  it('exports student threads only, but every thread\'s posts', async () => {
    vi.mocked(prisma.forumThread.findMany).mockResolvedValue(threads as never);
    vi.mocked(prisma.forumPost.findMany).mockResolvedValue([
      { id: 1, threadId: 81, authorId: 2, parentId: null, content: 'reply to staff', isAnonymous: false, isEdited: false, isAiGenerated: false, aiAgentName: null, createdAt: D },
      { id: 2, threadId: 82, authorId: 3, parentId: 1, content: 'nested', isAnonymous: false, isEdited: false, isAiGenerated: false, aiAgentName: null, createdAt: D },
    ] as never);

    const { data } = await collectPersonalData(scope, parseSelection('discussions'));
    expect(data.discussions?.threads.map((t) => (t as { key: string }).key)).toEqual(['th82', 'th83']);
    expect(data.discussions?.posts).toHaveLength(2);
    expect((data.discussions?.posts[1] as { parentKey: string | null }).parentKey).toBe('p1');
    expect((data.discussions?.posts[0] as { threadKey: string }).threadKey).toBe('th81');
  });

  it('keeps an anonymous thread\'s author out of the package entirely', async () => {
    vi.mocked(prisma.forumThread.findMany).mockResolvedValue(threads as never);
    const { data } = await collectPersonalData(scope, parseSelection('discussions'));
    const anon = data.discussions?.threads.find((t) => (t as { key: string }).key === 'th83');
    expect((anon as { authorKey: string | null }).authorKey).toBeNull();
    // user 3 authored only the anonymous thread, so must not appear.
    expect(data.people?.map((p) => p.key) ?? []).not.toContain('u3');
  });
});

describe('conversations', () => {
  it('serialises both kinds with their messages', async () => {
    vi.mocked(prisma.chatbotConversation.findMany).mockResolvedValue([
      { id: 1, sectionId: 61, userId: 2, createdAt: D, messages: [{ role: 'user', content: 'hi', createdAt: D }] },
    ] as never);
    vi.mocked(prisma.courseTutorConversation.findMany).mockResolvedValue([
      { id: 2, courseTutorId: 71, userId: 3, title: 'Help', createdAt: D, messages: [] },
    ] as never);

    const { data } = await collectPersonalData(scope, parseSelection('conversations'));
    expect(data.conversations).toHaveLength(2);
    expect(data.conversations?.[0]).toMatchObject({
      kind: 'chatbot-section',
      userKey: 'u2',
      sectionKey: 'sec61',
      tutorKey: null,
    });
    expect(data.conversations?.[1]).toMatchObject({
      kind: 'course-tutor',
      userKey: 'u3',
      sectionKey: null,
      tutorKey: 't71',
    });
  });
});

describe('activity', () => {
  const row = (i: number) => ({
    userId: 2, sessionId: null, verb: 'viewed', objectType: 'lecture', objectTitle: `L${i}`,
    objectSubtype: null, courseTitle: 'C', moduleTitle: null, lectureTitle: null, sectionTitle: null,
    success: true, score: null, maxScore: null, progress: null, duration: null, extensions: null,
    timestamp: D, deviceType: null, browserName: null, actionSubtype: null, eventUuid: `e${i}`, route: null,
  });

  it('serialises rows oldest-first', async () => {
    // The query is newest-first; the serialiser reverses it.
    vi.mocked(prisma.learningActivityLog.count).mockResolvedValue(2 as never);
    vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([row(2), row(1)] as never);
    const { data } = await collectPersonalData(scope, parseSelection('activity'));
    expect(data.activity?.map((a) => (a as { objectTitle: string }).objectTitle)).toEqual(['L1', 'L2']);
  });

  // An unbounded log is an out-of-memory crash, not a big download.
  it('caps the log and says so rather than failing or truncating silently', async () => {
    vi.mocked(prisma.learningActivityLog.count).mockResolvedValue((MAX_ACTIVITY_ROWS + 500) as never);
    vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([row(1)] as never);

    const { warnings } = await collectPersonalData(scope, parseSelection('activity'));
    expect(vi.mocked(prisma.learningActivityLog.findMany).mock.calls[0][0]).toMatchObject({
      take: MAX_ACTIVITY_ROWS,
      orderBy: { timestamp: 'desc' },
    });
    expect(warnings.join(' ')).toMatch(new RegExp(`only the most recent ${MAX_ACTIVITY_ROWS}`));
  });

  it('does not warn when the log fits', async () => {
    vi.mocked(prisma.learningActivityLog.count).mockResolvedValue(5 as never);
    vi.mocked(prisma.learningActivityLog.findMany).mockResolvedValue([row(1)] as never);
    const { warnings } = await collectPersonalData(scope, parseSelection('activity'));
    expect(warnings).toEqual([]);
  });
});
