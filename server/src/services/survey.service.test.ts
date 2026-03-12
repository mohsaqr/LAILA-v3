import { describe, it, expect, vi, beforeEach } from 'vitest';
import { surveyService } from './survey.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    moduleSurvey: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
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
