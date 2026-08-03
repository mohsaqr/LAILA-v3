import { describe, it, expect, vi, beforeEach } from 'vitest';
import { surveyService } from './survey.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    moduleSurvey: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
    },
    courseModule: {
      findUnique: vi.fn(),
    },
    survey: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    surveyQuestion: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    surveyResponse: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    surveyAnswer: {
      createMany: vi.fn(),
    },
  },
}));

import prisma from '../utils/prisma.js';
const prismaMock = vi.mocked(prisma, true);

describe('SurveyService - Module Surveys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getModuleSurveys', () => {
    it('should return surveys linked to a module', async () => {
      const mockData = [
        { id: 1, moduleId: 10, surveyId: 20, survey: { id: 20, title: 'Survey A', _count: { questions: 5, responses: 3 } } },
        { id: 2, moduleId: 10, surveyId: 21, survey: { id: 21, title: 'Survey B', _count: { questions: 2, responses: 0 } } },
      ];
      prismaMock.moduleSurvey.findMany.mockResolvedValue(mockData as any);

      const result = await surveyService.getModuleSurveys(10);
      expect(result).toEqual(mockData);
      expect(prismaMock.moduleSurvey.findMany).toHaveBeenCalledWith({
        where: { moduleId: 10 },
        include: {
          survey: {
            select: { id: true, title: true, description: true, isPublished: true, _count: { select: { questions: true, responses: true } } },
          },
        },
        orderBy: { addedAt: 'asc' },
      });
    });
  });

  describe('addSurveyToModule', () => {
    it('should link a survey to a module', async () => {
      prismaMock.course.findUnique.mockResolvedValue({ id: 1, instructorId: 100 } as any);
      prismaMock.courseModule.findUnique.mockResolvedValue({ id: 10, courseId: 1 } as any);
      prismaMock.survey.findUnique.mockResolvedValue({ id: 20, title: 'Test Survey' } as any);
      const created = { id: 1, courseId: 1, moduleId: 10, surveyId: 20, survey: { id: 20, title: 'Test Survey' } };
      prismaMock.moduleSurvey.create.mockResolvedValue(created as any);

      const result = await surveyService.addSurveyToModule(1, 10, 20, 100);
      expect(result).toEqual(created);
      expect(prismaMock.moduleSurvey.create).toHaveBeenCalledWith({
        data: { courseId: 1, moduleId: 10, surveyId: 20 },
        include: {
          survey: {
            select: { id: true, title: true, description: true, isPublished: true, _count: { select: { questions: true, responses: true } } },
          },
        },
      });
    });

    it('should throw 404 if course not found', async () => {
      prismaMock.course.findUnique.mockResolvedValue(null);
      await expect(surveyService.addSurveyToModule(999, 10, 20, 100)).rejects.toThrow(AppError);
      await expect(surveyService.addSurveyToModule(999, 10, 20, 100)).rejects.toThrow('Course not found');
    });

    it('should throw 403 if not authorized', async () => {
      prismaMock.course.findUnique.mockResolvedValue({ id: 1, instructorId: 200 } as any);
      await expect(surveyService.addSurveyToModule(1, 10, 20, 100)).rejects.toThrow('Not authorized');
    });

    it('should allow admin to add survey to any course', async () => {
      prismaMock.course.findUnique.mockResolvedValue({ id: 1, instructorId: 200 } as any);
      prismaMock.courseModule.findUnique.mockResolvedValue({ id: 10, courseId: 1 } as any);
      prismaMock.survey.findUnique.mockResolvedValue({ id: 20 } as any);
      prismaMock.moduleSurvey.create.mockResolvedValue({ id: 1 } as any);

      await surveyService.addSurveyToModule(1, 10, 20, 100, true);
      expect(prismaMock.moduleSurvey.create).toHaveBeenCalled();
    });

    it('should throw 404 if module not found or wrong course', async () => {
      prismaMock.course.findUnique.mockResolvedValue({ id: 1, instructorId: 100 } as any);
      prismaMock.courseModule.findUnique.mockResolvedValue({ id: 10, courseId: 999 } as any);
      await expect(surveyService.addSurveyToModule(1, 10, 20, 100)).rejects.toThrow('Module not found');
    });

    it('should throw 404 if survey not found', async () => {
      prismaMock.course.findUnique.mockResolvedValue({ id: 1, instructorId: 100 } as any);
      prismaMock.courseModule.findUnique.mockResolvedValue({ id: 10, courseId: 1 } as any);
      prismaMock.survey.findUnique.mockResolvedValue(null);
      await expect(surveyService.addSurveyToModule(1, 10, 999, 100)).rejects.toThrow('Survey not found');
    });
  });

  describe('removeSurveyFromModule', () => {
    it('should remove a survey from a module', async () => {
      prismaMock.moduleSurvey.findUnique.mockResolvedValue({
        id: 1, moduleId: 10, surveyId: 20, course: { instructorId: 100 },
      } as any);
      prismaMock.moduleSurvey.delete.mockResolvedValue({} as any);

      const result = await surveyService.removeSurveyFromModule(10, 20, 100);
      expect(result).toEqual({ message: 'Survey removed from module' });
      expect(prismaMock.moduleSurvey.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw 404 if module survey not found', async () => {
      prismaMock.moduleSurvey.findUnique.mockResolvedValue(null);
      await expect(surveyService.removeSurveyFromModule(10, 999, 100)).rejects.toThrow('Module survey not found');
    });

    it('should throw 403 if not authorized to remove', async () => {
      prismaMock.moduleSurvey.findUnique.mockResolvedValue({
        id: 1, moduleId: 10, surveyId: 20, course: { instructorId: 200 },
      } as any);
      await expect(surveyService.removeSurveyFromModule(10, 20, 100)).rejects.toThrow('Not authorized');
    });

    it('should allow admin to remove from any course', async () => {
      prismaMock.moduleSurvey.findUnique.mockResolvedValue({
        id: 1, moduleId: 10, surveyId: 20, course: { instructorId: 200 },
      } as any);
      prismaMock.moduleSurvey.delete.mockResolvedValue({} as any);

      const result = await surveyService.removeSurveyFromModule(10, 20, 100, true);
      expect(result).toEqual({ message: 'Survey removed from module' });
    });
  });
});

describe('SurveyService - Responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitResponse', () => {
    const publishedSurvey = {
      id: 1,
      isPublished: true,
      isAnonymous: false,
      questions: [{ id: 10, isRequired: false }],
    };

    it('rejects an answer for a question that is not part of the survey', async () => {
      prismaMock.survey.findUnique.mockResolvedValue(publishedSurvey as any);
      prismaMock.surveyResponse.findFirst.mockResolvedValue(null);

      await expect(
        surveyService.submitResponse(1, 5, { answers: [{ questionId: 999, answerValue: 'x' }] } as any),
      ).rejects.toThrow(AppError);
      expect(prismaMock.surveyResponse.create).not.toHaveBeenCalled();
    });

    it('creates a response when every answered question belongs to the survey', async () => {
      prismaMock.survey.findUnique.mockResolvedValue(publishedSurvey as any);
      prismaMock.surveyResponse.findFirst.mockResolvedValue(null);
      prismaMock.surveyResponse.create.mockResolvedValue({ id: 1, answers: [] } as any);

      const res = await surveyService.submitResponse(1, 5, { answers: [{ questionId: 10, answerValue: 'A' }] } as any);

      expect(res).toBeDefined();
      expect(prismaMock.surveyResponse.create).toHaveBeenCalled();
    });

    it('rejects a moduleId the survey is not attached to', async () => {
      prismaMock.survey.findUnique.mockResolvedValue(publishedSurvey as any);
      prismaMock.moduleSurvey.findFirst.mockResolvedValue(null); // no link

      await expect(
        surveyService.submitResponse(1, 5, { moduleId: 777, answers: [{ questionId: 10, answerValue: 'A' }] } as any),
      ).rejects.toThrow(/not attached to that module/i);
      expect(prismaMock.surveyResponse.create).not.toHaveBeenCalled();
    });
  });

  describe('getSurveyById visibility', () => {
    it('hides an unpublished survey from a non-owner instructor', async () => {
      prismaMock.survey.findUnique.mockResolvedValue({
        id: 1, isPublished: false, createdById: 100, questions: [], createdBy: { id: 100, fullname: 'Owner' },
        _count: { responses: 0 },
      } as any);

      // userId 200, isInstructor true, isAdmin false → not owner, not admin.
      await expect(surveyService.getSurveyById(1, 200, true, false)).rejects.toThrow(/not available/i);
    });

    it('lets the owner view their own unpublished survey', async () => {
      prismaMock.survey.findUnique.mockResolvedValue({
        id: 1, isPublished: false, createdById: 100, questions: [], createdBy: { id: 100, fullname: 'Owner' },
        _count: { responses: 0 },
      } as any);

      const survey = await surveyService.getSurveyById(1, 100, true, false);
      expect(survey.id).toBe(1);
    });
  });

  describe('getResponses', () => {
    it('does not throw when a multiple_choice answer is a non-JSON legacy string', async () => {
      prismaMock.survey.findUnique.mockResolvedValue({
        id: 1,
        createdById: 5,
        isAnonymous: false,
        questions: [{ id: 10, questionText: 'Q', questionType: 'multiple_choice', options: '["A","B"]' }],
      } as any);
      prismaMock.surveyResponse.findMany.mockResolvedValue([
        {
          id: 1,
          answers: [
            { questionId: 10, answerValue: 'A', question: { id: 10, questionText: 'Q', questionType: 'multiple_choice' } },
          ],
        },
      ] as any);

      // 'A' is a bare legacy string, not a JSON array — must degrade instead of
      // 500-ing the whole analytics endpoint.
      await expect(surveyService.getResponses(1, 5)).resolves.toBeDefined();
    });
  });
});
