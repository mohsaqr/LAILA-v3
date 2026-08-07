import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/prisma.js', () => ({
  default: {
    lecture: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
  },
}));

vi.mock('./lectureAIHelper.service.js', () => ({
  lectureAIHelperService: { buildLectureContext: vi.fn() },
}));

vi.mock('./lectureAiPolicy.service.js', () => ({
  lectureAiPolicyService: { assertAvailable: vi.fn() },
}));

vi.mock('./llm.service.js', () => ({ llmService: { chat: vi.fn() } }));

import prisma from '../utils/prisma.js';
import { lectureAIHelperService } from './lectureAIHelper.service.js';
import { lectureAiPolicyService } from './lectureAiPolicy.service.js';
import { mcqGenerationService } from './mcqGeneration.service.js';

/**
 * Practice question generation.
 *
 * The behaviour under test is that Practice reads the lecture through
 * `buildLectureContext`, the same reader Explain and Discuss use. It used to
 * assemble its own string from `lecture.content` plus the text sections, so a
 * lecture that was a PDF upload and a title threw "no content" here while the
 * other two modes answered from that PDF perfectly well.
 */

const LECTURE = {
  id: 1,
  title: 'Regression basics',
  content: null,
  module: {
    courseId: 5,
    course: { id: 5, title: 'Statistics', instructorId: 99 },
  },
};

describe('generatePracticeQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.lecture.findUnique).mockResolvedValue(LECTURE as any);
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isAdmin: false } as any);
    vi.mocked(lectureAiPolicyService.assertAvailable).mockResolvedValue(undefined);
    vi.mocked(lectureAIHelperService.buildLectureContext).mockResolvedValue({
      title: 'Regression basics',
      content: 'A residual is the gap between an observed value and its prediction.',
      sections: [],
      courseName: 'Statistics',
      moduleName: 'Week 3',
    } as any);

    vi.spyOn(mcqGenerationService, 'generateQuestions').mockResolvedValue({
      questions: [
        {
          questionText: 'What is a residual?',
          options: ['A gap', 'A slope', 'A mean', 'A count'],
          correctAnswer: 'A gap',
          difficulty: 'medium',
        },
      ],
    } as any);
  });

  it('generates from a PDF-only lecture, which used to throw "no content"', async () => {
    // The lecture body is null and there are no text sections; everything the
    // model sees comes from the extracted PDF.
    const questions = await mcqGenerationService.generatePracticeQuestions(1, 42, {
      questionCount: 3,
    });

    expect(questions).toHaveLength(1);
    expect(lectureAIHelperService.buildLectureContext).toHaveBeenCalledWith(1, undefined);
    expect(mcqGenerationService.generateQuestions).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'A residual is the gap between an observed value and its prediction.',
      }),
      undefined,
    );
  });

  it('passes the student\'s page selection through to the extractor', async () => {
    await mcqGenerationService.generatePracticeQuestions(1, 42, {
      questionCount: 3,
      pdfPageRanges: { 'week3.pdf': '4-9' },
    });

    expect(lectureAIHelperService.buildLectureContext).toHaveBeenCalledWith(1, {
      'week3.pdf': '4-9',
    });
  });

  it('refuses an ineligible lecture before spending anything', async () => {
    vi.mocked(lectureAiPolicyService.assertAvailable).mockRejectedValue(
      Object.assign(new Error('not available'), { statusCode: 403 }),
    );

    await expect(
      mcqGenerationService.generatePracticeQuestions(1, 42, { questionCount: 3 }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(lectureAIHelperService.buildLectureContext).not.toHaveBeenCalled();
    expect(mcqGenerationService.generateQuestions).not.toHaveBeenCalled();
  });

  it('still reports 400 when the lecture genuinely has nothing in it', async () => {
    // The error survives the rewrite, but now it means what it says.
    vi.mocked(lectureAIHelperService.buildLectureContext).mockResolvedValue({
      title: 'Empty',
      content: '   ',
      sections: [],
      courseName: 'Statistics',
      moduleName: 'Week 3',
    } as any);

    await expect(
      mcqGenerationService.generatePracticeQuestions(1, 42, { questionCount: 3 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns 404 for a lecture that does not exist', async () => {
    vi.mocked(prisma.lecture.findUnique).mockResolvedValue(null);

    await expect(
      mcqGenerationService.generatePracticeQuestions(1, 42, { questionCount: 3 }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses a student who is not enrolled', async () => {
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

    await expect(
      mcqGenerationService.generatePracticeQuestions(1, 42, { questionCount: 3 }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('lets the course instructor through without an enrolment', async () => {
    vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

    await expect(
      mcqGenerationService.generatePracticeQuestions(1, 99, { questionCount: 3 }),
    ).resolves.toHaveLength(1);
  });

  it('caps the request at ten questions however many are asked for', async () => {
    await mcqGenerationService.generatePracticeQuestions(1, 42, { questionCount: 50 });

    expect(mcqGenerationService.generateQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ questionCount: 10 }),
      undefined,
    );
  });
});
