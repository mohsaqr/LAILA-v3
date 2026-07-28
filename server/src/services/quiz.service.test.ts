import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma — the tables getAttemptResults / getQuizById touch.
vi.mock('../utils/prisma.js', () => ({
  default: {
    quizAttempt: { findUnique: vi.fn() },
    quiz: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
  },
}));

// isTeamMember decides course-staff status for non-owners.
vi.mock('./courseRole.service.js', () => ({
  courseRoleService: { isTeamMember: vi.fn().mockResolvedValue(false) },
}));

vi.mock('./email.service.js', () => ({ emailService: { sendEmail: vi.fn() } }));
vi.mock('../utils/logger.js', () => ({
  createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import prisma from '../utils/prisma.js';
import { courseRoleService } from './courseRole.service.js';
import { quizService } from './quiz.service.js';

// One question carrying an answer key — the payload that must not leak early.
const questions = [
  { id: 1, orderIndex: 0, questionType: 'multiple_choice', questionText: 'Q1',
    options: JSON.stringify(['a', 'b']), points: 1, correctAnswer: 'a', explanation: 'because' },
];

const attempt = (over: Record<string, unknown> = {}) => ({
  id: 100,
  userId: 1,
  status: 'in_progress',
  quiz: {
    courseId: 5,
    showResults: 'after_submit',
    dueDate: null,
    course: { instructorId: 999 },
    questions,
  },
  answers: [],
  ...over,
});

describe('quizService.getAttemptResults reveal gate', () => {
  const STUDENT = 1; // the attempt owner, not staff of course 5

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(courseRoleService.isTeamMember).mockResolvedValue(false);
  });

  it('refuses to return the answer key while the attempt is still in progress', async () => {
    vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(attempt() as any);

    await expect(quizService.getAttemptResults(100, STUDENT)).rejects.toThrow(
      /not available until you submit/i
    );
  });

  it('returns results (with correctAnswer) once the attempt is submitted under after_submit', async () => {
    vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(
      attempt({ status: 'graded' }) as any
    );

    const res = await quizService.getAttemptResults(100, STUDENT);
    expect(res.results[0].question.correctAnswer).toBe('a');
  });

  it('stays closed for after_due_date when no due date is set (fails closed, not open)', async () => {
    vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(
      attempt({
        status: 'graded',
        quiz: { ...attempt().quiz, showResults: 'after_due_date', dueDate: null },
      }) as any
    );

    await expect(quizService.getAttemptResults(100, STUDENT)).rejects.toThrow(
      /after the due date/i
    );
  });

  it('honors showResults=never even after submission', async () => {
    vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(
      attempt({
        status: 'graded',
        quiz: { ...attempt().quiz, showResults: 'never' },
      }) as any
    );

    await expect(quizService.getAttemptResults(100, STUDENT)).rejects.toThrow(
      /not available for this quiz/i
    );
  });

  it('does not let an owner who holds the global instructor flag skip the gate', async () => {
    vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(attempt() as any);

    // isInstructor=true, but they are not staff of THIS course → still gated.
    await expect(quizService.getAttemptResults(100, STUDENT, true, false)).rejects.toThrow(
      /not available until you submit/i
    );
  });

  it('lets the course instructor read an in-progress attempt (staff view)', async () => {
    vi.mocked(prisma.quizAttempt.findUnique).mockResolvedValue(
      attempt({ quiz: { ...attempt().quiz, course: { instructorId: 7 } } }) as any
    );

    // userId 7 owns the course → staff, no reveal gate.
    const res = await quizService.getAttemptResults(100, 7);
    expect(res.results[0].question.correctAnswer).toBe('a');
  });
});

describe('quizService.getQuizById access gate', () => {
  const quizRow = (over: Record<string, unknown> = {}) => ({
    id: 50,
    isPublished: true,
    availableFrom: null,
    availableUntil: null,
    course: { id: 5, title: 'C', instructorId: 999 },
    module: null,
    questions: [
      { id: 1, questionType: 'multiple_choice', questionText: 'Q', options: JSON.stringify(['a']),
        points: 1, shuffleOptions: false, orderIndex: 0 },
    ],
    _count: { attempts: 0 },
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(courseRoleService.isTeamMember).mockResolvedValue(false);
  });

  it('rejects a non-enrolled user reading a quiz by id', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue(quizRow() as any);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

    await expect(quizService.getQuizById(50, 123)).rejects.toThrow(/must be enrolled/i);
  });

  it('rejects an enrolled student when the quiz is unpublished', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue(quizRow({ isPublished: false }) as any);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);

    await expect(quizService.getQuizById(50, 123)).rejects.toThrow(/not available/i);
  });

  it('allows an enrolled student to read a published, in-window quiz', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue(quizRow() as any);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);

    const quiz = await quizService.getQuizById(50, 123);
    expect(quiz.id).toBe(50);
  });

  it('allows the course owner without an enrollment', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue(
      quizRow({ isPublished: false, course: { id: 5, title: 'C', instructorId: 7 } }) as any
    );
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

    const quiz = await quizService.getQuizById(50, 7);
    expect(quiz.id).toBe(50);
    expect(prisma.enrollment.findUnique).not.toHaveBeenCalled();
  });

  it('does not treat a global instructor of another course as staff', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue(quizRow({ isPublished: false }) as any);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

    // isAdmin=false; they hold isInstructor globally but the service ignores it.
    await expect(quizService.getQuizById(50, 123, false, false)).rejects.toThrow(/must be enrolled/i);
  });
});
