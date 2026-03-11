import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import {
  CreateSurveyInput,
  UpdateSurveyInput,
  CreateSurveyQuestionInput,
  UpdateSurveyQuestionInput,
  SubmitSurveyResponseInput,
} from '../utils/validation.js';

export class SurveyService {
  // =============================================================================
  // SURVEY CRUD
  // =============================================================================

  async getSurveys(userId?: number, isInstructor = false, isAdmin = false, courseId?: number) {
    const where: any = {};

    // Non-instructors only see published surveys
    if (!isInstructor && !isAdmin) {
      where.isPublished = true;
    } else if (!isAdmin && userId) {
      // Instructors only see their own surveys (admins see all)
      where.createdById = userId;
    }

    // Filter by course via ModuleSurvey relation
    if (courseId) {
      where.moduleSurveys = { some: { courseId } };
    }

    const surveys = await prisma.survey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { questions: true, responses: true },
        },
        ...(courseId && {
          moduleSurveys: {
            where: { courseId },
            include: {
              module: { select: { id: true, title: true } },
            },
          },
        }),
      },
    });

    return surveys;
  }

  async getSurveyById(surveyId: number, userId?: number, isInstructor = false) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
        createdBy: {
          select: { id: true, fullname: true },
        },
        _count: {
          select: { responses: true },
        },
      },
    });

    if (!survey) {
      throw new AppError('Survey not found', 404);
    }

    // Check visibility
    if (!isInstructor && !survey.isPublished) {
      throw new AppError('Survey not available', 403);
    }

    // Parse options from JSON for each question
    const questionsWithParsedOptions = survey.questions.map(q => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null,
    }));

    return { ...survey, questions: questionsWithParsedOptions };
  }

  async createSurvey(userId: number, data: CreateSurveyInput, isAdmin = false) {
    const survey = await prisma.survey.create({
      data: {
        title: data.title,
        description: data.description,
        createdById: userId,
        isPublished: data.isPublished ?? false,
        isAnonymous: data.isAnonymous ?? false,
      },
      include: {
        _count: {
          select: { questions: true, responses: true },
        },
      },
    });

    return survey;
  }

  async updateSurvey(surveyId: number, userId: number, data: UpdateSurveyInput, isAdmin = false) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
    });

    if (!survey) {
      throw new AppError('Survey not found', 404);
    }

    // Check authorization
    if (survey.createdById !== userId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const updated = await prisma.survey.update({
      where: { id: surveyId },
      data,
      include: {
        _count: {
          select: { questions: true, responses: true },
        },
      },
    });

    return updated;
  }

  async deleteSurvey(surveyId: number, userId: number, isAdmin = false) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
    });

    if (!survey) {
      throw new AppError('Survey not found', 404);
    }

    if (survey.createdById !== userId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    await prisma.survey.delete({
      where: { id: surveyId },
    });

    return { message: 'Survey deleted successfully' };
  }

  async publishSurvey(surveyId: number, userId: number, isAdmin = false) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: { _count: { select: { questions: true } } },
    });

    if (!survey) {
      throw new AppError('Survey not found', 404);
    }

    if (survey.createdById !== userId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    if (survey._count.questions === 0) {
      throw new AppError('Cannot publish survey with no questions', 400);
    }

    const updated = await prisma.survey.update({
      where: { id: surveyId },
      data: { isPublished: true },
    });

    return updated;
  }

  // =============================================================================
  // QUESTION CRUD
  // =============================================================================

  async addQuestion(surveyId: number, userId: number, data: CreateSurveyQuestionInput, isAdmin = false) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
    });

    if (!survey) {
      throw new AppError('Survey not found', 404);
    }

    if (survey.createdById !== userId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    // Get max order index
    const maxOrder = await prisma.surveyQuestion.aggregate({
      where: { surveyId },
      _max: { orderIndex: true },
    });

    const question = await prisma.surveyQuestion.create({
      data: {
        surveyId,
        questionText: data.questionText,
        questionType: data.questionType,
        options: data.options ? JSON.stringify(data.options) : null,
        isRequired: data.isRequired ?? true,
        orderIndex: data.orderIndex ?? (maxOrder._max.orderIndex ?? -1) + 1,
      },
    });

    return {
      ...question,
      options: question.options ? JSON.parse(question.options) : null,
    };
  }

  async updateQuestion(
    surveyId: number,
    questionId: number,
    userId: number,
    data: UpdateSurveyQuestionInput,
    isAdmin = false
  ) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
    });

    if (!survey) {
      throw new AppError('Survey not found', 404);
    }

    if (survey.createdById !== userId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const question = await prisma.surveyQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question || question.surveyId !== surveyId) {
      throw new AppError('Question not found', 404);
    }

    const updated = await prisma.surveyQuestion.update({
      where: { id: questionId },
      data: {
        ...data,
        options: data.options ? JSON.stringify(data.options) : undefined,
      },
    });

    return {
      ...updated,
      options: updated.options ? JSON.parse(updated.options) : null,
    };
  }

  async deleteQuestion(surveyId: number, questionId: number, userId: number, isAdmin = false) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
    });

    if (!survey) {
      throw new AppError('Survey not found', 404);
    }

    if (survey.createdById !== userId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const question = await prisma.surveyQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question || question.surveyId !== surveyId) {
      throw new AppError('Question not found', 404);
    }

    await prisma.surveyQuestion.delete({
      where: { id: questionId },
    });

    return { message: 'Question deleted successfully' };
  }

  async reorderQuestions(surveyId: number, userId: number, questionIds: number[], isAdmin = false) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
    });

    if (!survey) {
      throw new AppError('Survey not found', 404);
    }

    if (survey.createdById !== userId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    // Update order for each question
    await Promise.all(
      questionIds.map((id, index) =>
        prisma.surveyQuestion.update({
          where: { id },
          data: { orderIndex: index },
        })
      )
    );

    return { message: 'Questions reordered successfully' };
  }

  // =============================================================================
  // RESPONSES
  // =============================================================================

  async submitResponse(surveyId: number, userId: number | null, data: SubmitSurveyResponseInput) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: true,
      },
    });

    if (!survey) {
      throw new AppError('Survey not found', 404);
    }

    if (!survey.isPublished) {
      throw new AppError('Survey is not available', 400);
    }

    // Check if user already submitted (if not anonymous and user is logged in)
    if (!survey.isAnonymous && userId) {
      const existingResponse = await prisma.surveyResponse.findFirst({
        where: {
          surveyId,
          userId,
          ...(data.moduleId ? { moduleId: data.moduleId } : {}),
        },
      });

      if (existingResponse) {
        throw new AppError('You have already completed this survey', 400);
      }
    }

    // Validate required questions
    const requiredQuestionIds = survey.questions
      .filter(q => q.isRequired)
      .map(q => q.id);

    const answeredQuestionIds = data.answers.map(a => a.questionId);

    const missingRequired = requiredQuestionIds.filter(
      id => !answeredQuestionIds.includes(id)
    );

    if (missingRequired.length > 0) {
      throw new AppError('Please answer all required questions', 400);
    }

    // Create response with answers
    const response = await prisma.surveyResponse.create({
      data: {
        surveyId,
        userId: survey.isAnonymous ? null : userId,
        moduleId: data.moduleId ?? null,
        context: data.context ?? 'standalone',
        contextId: data.contextId,
        answers: {
          create: data.answers.map(answer => ({
            questionId: answer.questionId,
            answerValue: Array.isArray(answer.answerValue)
              ? JSON.stringify(answer.answerValue)
              : answer.answerValue,
          })),
        },
      },
      include: {
        answers: true,
      },
    });

    return response;
  }

  async getMyResponse(surveyId: number, userId: number) {
    const response = await prisma.surveyResponse.findFirst({
      where: {
        surveyId,
        userId,
      },
      include: {
        answers: true,
      },
    });

    return response;
  }

  async checkIfCompleted(surveyId: number, userId: number, moduleId?: number) {
    const response = await prisma.surveyResponse.findFirst({
      where: {
        surveyId,
        userId,
        ...(moduleId ? { moduleId } : {}),
      },
    });

    return { completed: !!response };
  }

  // =============================================================================
  // ANALYTICS (Instructor)
  // =============================================================================

  async getResponses(surveyId: number, userId: number, isAdmin = false) {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!survey) {
      throw new AppError('Survey not found', 404);
    }

    if (survey.createdById !== userId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const responses = await prisma.surveyResponse.findMany({
      where: { surveyId },
      orderBy: { completedAt: 'desc' },
      include: {
        user: survey.isAnonymous
          ? false
          : {
              select: { id: true, fullname: true, email: true },
            },
        answers: {
          include: {
            question: {
              select: { id: true, questionText: true, questionType: true },
            },
          },
        },
      },
    });

    // Parse answer values
    const parsedResponses = responses.map(r => ({
      ...r,
      answers: r.answers.map(a => ({
        ...a,
        answerValue: a.question.questionType === 'multiple_choice'
          ? JSON.parse(a.answerValue)
          : a.answerValue,
      })),
    }));

    // Calculate aggregated stats per question
    const questionStats = survey.questions.map(q => {
      const questionAnswers = responses.flatMap(r =>
        r.answers.filter(a => a.questionId === q.id)
      );

      if (q.questionType === 'free_text') {
        return {
          questionId: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          totalResponses: questionAnswers.length,
          responses: questionAnswers.map(a => a.answerValue),
        };
      }

      // For choice questions, count responses per option
      const options = q.options ? JSON.parse(q.options) : [];
      const optionCounts: Record<string, number> = {};
      options.forEach((opt: string) => (optionCounts[opt] = 0));

      questionAnswers.forEach(a => {
        if (q.questionType === 'multiple_choice') {
          const selected = JSON.parse(a.answerValue) as string[];
          selected.forEach(s => {
            if (optionCounts[s] !== undefined) optionCounts[s]++;
          });
        } else {
          if (optionCounts[a.answerValue] !== undefined) {
            optionCounts[a.answerValue]++;
          }
        }
      });

      return {
        questionId: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        totalResponses: questionAnswers.length,
        options,
        optionCounts,
      };
    });

    return {
      survey: {
        id: survey.id,
        title: survey.title,
        isAnonymous: survey.isAnonymous,
      },
      totalResponses: responses.length,
      questionStats,
      responses: parsedResponses,
    };
  }

  async exportResponses(surveyId: number, userId: number, isAdmin = false) {
    const data = await this.getResponses(surveyId, userId, isAdmin);

    // Build CSV
    const headers = ['Response ID', 'Completed At'];
    if (!data.survey.isAnonymous) {
      headers.push('User ID', 'Name', 'Email');
    }

    // Add question headers
    const questions = data.questionStats.map(q => q.questionText);
    headers.push(...questions);

    const rows = data.responses.map((r: any) => {
      const row: string[] = [
        r.id.toString(),
        new Date(r.completedAt).toISOString(),
      ];

      if (!data.survey.isAnonymous && r.user) {
        row.push(r.user.id.toString(), r.user.fullname, r.user.email);
      } else if (!data.survey.isAnonymous) {
        row.push('', '', '');
      }

      // Add answers
      data.questionStats.forEach((q: any) => {
        const answer = r.answers.find((a: any) => a.questionId === q.questionId);
        if (answer) {
          const value = Array.isArray(answer.answerValue)
            ? answer.answerValue.join('; ')
            : answer.answerValue;
          row.push(value);
        } else {
          row.push('');
        }
      });

      return row;
    });

    // Convert to CSV string
    const csvContent = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(row =>
        row.map((cell: string) => `"${cell.replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    return {
      filename: `survey-${surveyId}-responses-${new Date().toISOString().split('T')[0]}.csv`,
      content: csvContent,
    };
  }
  // =========================================================================
  // MODULE SURVEYS
  // =========================================================================

  async getModuleSurveys(moduleId: number) {
    return prisma.moduleSurvey.findMany({
      where: { moduleId },
      include: {
        survey: {
          select: { id: true, title: true, description: true, isPublished: true, _count: { select: { questions: true, responses: true } } },
        },
      },
      orderBy: { addedAt: 'asc' },
    });
  }

  async addSurveyToModule(courseId: number, moduleId: number, surveyId: number, userId: number, isAdmin = false) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new AppError('Course not found', 404);
    if (course.instructorId !== userId && !isAdmin) throw new AppError('Not authorized', 403);

    const module = await prisma.courseModule.findUnique({ where: { id: moduleId } });
    if (!module || module.courseId !== courseId) throw new AppError('Module not found', 404);

    const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw new AppError('Survey not found', 404);

    return prisma.moduleSurvey.create({
      data: { courseId, moduleId, surveyId },
      include: {
        survey: {
          select: { id: true, title: true, description: true, isPublished: true, _count: { select: { questions: true, responses: true } } },
        },
      },
    });
  }

  async removeSurveyFromModule(moduleId: number, surveyId: number, userId: number, isAdmin = false) {
    const ms = await prisma.moduleSurvey.findUnique({
      where: { moduleId_surveyId: { moduleId, surveyId } },
      include: { course: true },
    });
    if (!ms) throw new AppError('Module survey not found', 404);
    if (ms.course.instructorId !== userId && !isAdmin) throw new AppError('Not authorized', 403);

    await prisma.moduleSurvey.delete({ where: { id: ms.id } });
    return { message: 'Survey removed from module' };
  }
}

export const surveyService = new SurveyService();
