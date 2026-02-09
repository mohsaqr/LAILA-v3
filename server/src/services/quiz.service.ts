import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { createLogger } from '../utils/logger.js';
import { emailService } from './email.service.js';

const logger = createLogger('quiz');

// Types
export interface CreateQuizInput {
  title: string;
  description?: string;
  instructions?: string;
  timeLimit?: number;
  maxAttempts?: number;
  passingScore?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showResults?: string;
  dueDate?: string;
  availableFrom?: string;
  moduleId?: number;
}

export interface UpdateQuizInput extends Partial<CreateQuizInput> {
  isPublished?: boolean;
}

export interface CreateQuestionInput {
  questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_in_blank';
  questionText: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  points?: number;
  orderIndex?: number;
}

export interface SubmitAnswerInput {
  questionId: number;
  answer: string;
}

export class QuizService {
  // =========================================================================
  // QUIZ CRUD
  // =========================================================================

  async getQuizzes(courseId: number, userId?: number, isInstructor = false, isAdmin = false) {
    // Verify authorization for students
    if (userId && !isInstructor && !isAdmin) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });
      if (!enrollment) {
        throw new AppError('You must be enrolled in this course to view quizzes', 403);
      }
    }

    const where: any = { courseId };
    if (!isInstructor && !isAdmin) {
      where.isPublished = true;
      // Only show available quizzes
      where.OR = [
        { availableFrom: null },
        { availableFrom: { lte: new Date() } },
      ];
    }

    const quizzes = await prisma.quiz.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        module: { select: { id: true, title: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    });

    // For students, include their attempt status
    if (userId && !isInstructor && !isAdmin) {
      const attempts = await prisma.quizAttempt.findMany({
        where: {
          userId,
          quizId: { in: quizzes.map(q => q.id) },
        },
        select: {
          quizId: true,
          attemptNumber: true,
          score: true,
          status: true,
          submittedAt: true,
        },
        orderBy: { attemptNumber: 'desc' },
      });

      const attemptMap = new Map<number, typeof attempts>();
      attempts.forEach(a => {
        if (!attemptMap.has(a.quizId)) {
          attemptMap.set(a.quizId, []);
        }
        attemptMap.get(a.quizId)!.push(a);
      });

      return quizzes.map(q => ({
        ...q,
        myAttempts: attemptMap.get(q.id) || [],
      }));
    }

    return quizzes;
  }

  async getQuizById(quizId: number, userId?: number, includeAnswers = false) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        course: { select: { id: true, title: true, instructorId: true } },
        module: { select: { id: true, title: true } },
        questions: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            questionType: true,
            questionText: true,
            options: true,
            points: true,
            orderIndex: true,
            // Only include correct answer for instructors
            ...(includeAnswers ? { correctAnswer: true, explanation: true } : {}),
          },
        },
        _count: { select: { attempts: true } },
      },
    });

    if (!quiz) {
      throw new AppError('Quiz not found', 404);
    }

    // Parse options JSON for each question
    return {
      ...quiz,
      questions: quiz.questions.map(q => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
      })),
    };
  }

  /**
   * Get all quizzes for a student across all their enrolled courses
   */
  async getStudentQuizzes(userId: number) {
    // Get all enrolled courses for the user
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      select: { courseId: true, course: { select: { title: true } } },
    });

    if (enrollments.length === 0) {
      return [];
    }

    const courseIds = enrollments.map(e => e.courseId);
    const courseMap = new Map(enrollments.map(e => [e.courseId, e.course.title]));

    // Get all published quizzes for enrolled courses
    const quizzes = await prisma.quiz.findMany({
      where: {
        courseId: { in: courseIds },
        isPublished: true,
        OR: [
          { availableFrom: null },
          { availableFrom: { lte: new Date() } },
        ],
      },
      orderBy: [{ courseId: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { questions: true } },
      },
    });

    // Get user's attempts for these quizzes
    const attempts = await prisma.quizAttempt.findMany({
      where: {
        userId,
        quizId: { in: quizzes.map(q => q.id) },
      },
      select: {
        quizId: true,
        attemptNumber: true,
        score: true,
        status: true,
      },
      orderBy: { attemptNumber: 'desc' },
    });

    const attemptMap = new Map<number, typeof attempts>();
    attempts.forEach(a => {
      if (!attemptMap.has(a.quizId)) {
        attemptMap.set(a.quizId, []);
      }
      attemptMap.get(a.quizId)!.push(a);
    });

    return quizzes.map(quiz => ({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      courseId: quiz.courseId,
      courseName: courseMap.get(quiz.courseId) || 'Unknown Course',
      timeLimit: quiz.timeLimit,
      maxAttempts: quiz.maxAttempts,
      passingScore: quiz.passingScore,
      dueDate: quiz.dueDate,
      questionCount: quiz._count.questions,
      myAttempts: attemptMap.get(quiz.id) || [],
    }));
  }

  /**
   * Get all quizzes for an instructor across all their courses
   */
  async getInstructorQuizzes(instructorId: number, isAdmin = false) {
    const where: any = {};

    if (!isAdmin) {
      where.course = { instructorId };
    }

    const quizzes = await prisma.quiz.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { id: true, title: true } },
        module: { select: { id: true, title: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    });

    return quizzes.map(quiz => ({
      id: quiz.id,
      title: quiz.title,
      courseId: quiz.courseId,
      courseName: quiz.course.title,
      moduleId: quiz.moduleId,
      timeLimit: quiz.timeLimit,
      isPublished: quiz.isPublished,
      questionCount: quiz._count.questions,
      attemptCount: quiz._count.attempts,
    }));
  }

  async createQuiz(courseId: number, instructorId: number, data: CreateQuizInput, isAdmin = false) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new AppError('Course not found', 404);
    if (course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const quiz = await prisma.quiz.create({
      data: {
        courseId,
        moduleId: data.moduleId,
        title: data.title,
        description: data.description,
        instructions: data.instructions,
        timeLimit: data.timeLimit,
        maxAttempts: data.maxAttempts ?? 1,
        passingScore: data.passingScore ?? 70,
        shuffleQuestions: data.shuffleQuestions ?? false,
        shuffleOptions: data.shuffleOptions ?? false,
        showResults: data.showResults ?? 'after_submit',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        availableFrom: data.availableFrom ? new Date(data.availableFrom) : null,
      },
      include: {
        module: { select: { id: true, title: true } },
      },
    });

    logger.info({ quizId: quiz.id, courseId }, 'Quiz created');
    return quiz;
  }

  async updateQuiz(quizId: number, instructorId: number, data: UpdateQuizInput, isAdmin = false) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { course: true },
    });

    if (!quiz) throw new AppError('Quiz not found', 404);
    if (quiz.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const updated = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        title: data.title,
        description: data.description,
        instructions: data.instructions,
        timeLimit: data.timeLimit,
        maxAttempts: data.maxAttempts,
        passingScore: data.passingScore,
        shuffleQuestions: data.shuffleQuestions,
        shuffleOptions: data.shuffleOptions,
        showResults: data.showResults,
        isPublished: data.isPublished,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        availableFrom: data.availableFrom ? new Date(data.availableFrom) : undefined,
        moduleId: data.moduleId,
      },
    });

    return updated;
  }

  async deleteQuiz(quizId: number, instructorId: number, isAdmin = false) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { course: true },
    });

    if (!quiz) throw new AppError('Quiz not found', 404);
    if (quiz.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    await prisma.quiz.delete({ where: { id: quizId } });
    logger.info({ quizId }, 'Quiz deleted');
    return { message: 'Quiz deleted successfully' };
  }

  // =========================================================================
  // QUESTION MANAGEMENT
  // =========================================================================

  async addQuestion(quizId: number, instructorId: number, data: CreateQuestionInput, isAdmin = false) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { course: true, _count: { select: { questions: true } } },
    });

    if (!quiz) throw new AppError('Quiz not found', 404);
    if (quiz.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const question = await prisma.quizQuestion.create({
      data: {
        quizId,
        questionType: data.questionType,
        questionText: data.questionText,
        options: data.options ? JSON.stringify(data.options) : null,
        correctAnswer: data.correctAnswer,
        explanation: data.explanation,
        points: data.points ?? 1,
        orderIndex: data.orderIndex ?? quiz._count.questions,
      },
    });

    return {
      ...question,
      options: question.options ? JSON.parse(question.options) : null,
    };
  }

  async updateQuestion(questionId: number, instructorId: number, data: Partial<CreateQuestionInput>, isAdmin = false) {
    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
      include: { quiz: { include: { course: true } } },
    });

    if (!question) throw new AppError('Question not found', 404);
    if (question.quiz.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const updated = await prisma.quizQuestion.update({
      where: { id: questionId },
      data: {
        questionType: data.questionType,
        questionText: data.questionText,
        options: data.options ? JSON.stringify(data.options) : undefined,
        correctAnswer: data.correctAnswer,
        explanation: data.explanation,
        points: data.points,
        orderIndex: data.orderIndex,
      },
    });

    return {
      ...updated,
      options: updated.options ? JSON.parse(updated.options) : null,
    };
  }

  async deleteQuestion(questionId: number, instructorId: number, isAdmin = false) {
    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
      include: { quiz: { include: { course: true } } },
    });

    if (!question) throw new AppError('Question not found', 404);
    if (question.quiz.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    await prisma.quizQuestion.delete({ where: { id: questionId } });
    return { message: 'Question deleted successfully' };
  }

  async reorderQuestions(quizId: number, instructorId: number, questionIds: number[], isAdmin = false) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { course: true },
    });

    if (!quiz) throw new AppError('Quiz not found', 404);
    if (quiz.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    // Update each question's order
    await Promise.all(
      questionIds.map((id, index) =>
        prisma.quizQuestion.update({
          where: { id },
          data: { orderIndex: index },
        })
      )
    );

    return { message: 'Questions reordered successfully' };
  }

  /**
   * Add multiple questions to a quiz at once (bulk operation)
   */
  async addQuestionsBulk(
    quizId: number,
    instructorId: number,
    questions: CreateQuestionInput[],
    isAdmin = false
  ) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { course: true, _count: { select: { questions: true } } },
    });

    if (!quiz) throw new AppError('Quiz not found', 404);
    if (quiz.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    // Get the starting order index
    let orderIndex = quiz._count.questions;

    // Create all questions
    const createdQuestions = await Promise.all(
      questions.map(async (data, idx) => {
        const question = await prisma.quizQuestion.create({
          data: {
            quizId,
            questionType: data.questionType,
            questionText: data.questionText,
            options: data.options ? JSON.stringify(data.options) : null,
            correctAnswer: data.correctAnswer,
            explanation: data.explanation,
            points: data.points ?? 1,
            orderIndex: orderIndex + idx,
          },
        });

        return {
          ...question,
          options: question.options ? JSON.parse(question.options) : null,
        };
      })
    );

    logger.info({ quizId, count: createdQuestions.length }, 'Questions added in bulk');
    return createdQuestions;
  }

  // =========================================================================
  // QUIZ ATTEMPTS & SUBMISSIONS
  // =========================================================================

  async startAttempt(quizId: number, userId: number, ipAddress?: string) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!quiz) throw new AppError('Quiz not found', 404);
    if (!quiz.isPublished) throw new AppError('Quiz is not available', 400);

    // Check if available
    if (quiz.availableFrom && new Date() < quiz.availableFrom) {
      throw new AppError('Quiz is not yet available', 400);
    }
    if (quiz.dueDate && new Date() > quiz.dueDate) {
      throw new AppError('Quiz due date has passed', 400);
    }

    // Check enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: quiz.courseId } },
    });
    if (!enrollment) throw new AppError('You must be enrolled to take this quiz', 403);

    // Check attempts
    const existingAttempts = await prisma.quizAttempt.count({
      where: { quizId, userId },
    });

    if (quiz.maxAttempts > 0 && existingAttempts >= quiz.maxAttempts) {
      throw new AppError('Maximum attempts reached', 400);
    }

    // Check for in-progress attempt
    const inProgress = await prisma.quizAttempt.findFirst({
      where: { quizId, userId, status: 'in_progress' },
    });

    if (inProgress) {
      // Return existing in-progress attempt
      return this.getAttemptWithQuestions(inProgress.id, quiz);
    }

    // Create new attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        attemptNumber: existingAttempts + 1,
        ipAddress,
      },
    });

    logger.info({ attemptId: attempt.id, quizId, userId }, 'Quiz attempt started');
    return this.getAttemptWithQuestions(attempt.id, quiz);
  }

  private async getAttemptWithQuestions(attemptId: number, quiz: any) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: { select: { questionId: true, answer: true } },
      },
    });

    // Prepare questions (optionally shuffled)
    let questions = quiz.questions.map((q: any) => ({
      id: q.id,
      questionType: q.questionType,
      questionText: q.questionText,
      options: q.options ? JSON.parse(q.options) : null,
      points: q.points,
    }));

    if (quiz.shuffleQuestions) {
      questions = this.shuffleArray(questions);
    }

    if (quiz.shuffleOptions) {
      questions = questions.map((q: any) => ({
        ...q,
        options: q.options ? this.shuffleArray(q.options) : null,
      }));
    }

    // Map saved answers
    const answerMap = new Map(
      attempt?.answers.map(a => [a.questionId, a.answer])
    );

    return {
      attempt: {
        id: attempt?.id,
        attemptNumber: attempt?.attemptNumber,
        startedAt: attempt?.startedAt,
        status: attempt?.status,
      },
      quiz: {
        id: quiz.id,
        title: quiz.title,
        instructions: quiz.instructions,
        timeLimit: quiz.timeLimit,
      },
      questions: questions.map((q: any) => ({
        ...q,
        savedAnswer: answerMap.get(q.id) || null,
      })),
    };
  }

  async saveAnswer(attemptId: number, userId: number, data: SubmitAnswerInput) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: { quiz: true },
    });

    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.userId !== userId) throw new AppError('Not authorized', 403);
    if (attempt.status !== 'in_progress') throw new AppError('Attempt already submitted', 400);

    // Check time limit
    if (attempt.quiz.timeLimit) {
      const elapsed = (Date.now() - attempt.startedAt.getTime()) / 1000 / 60;
      if (elapsed > attempt.quiz.timeLimit) {
        throw new AppError('Time limit exceeded', 400);
      }
    }

    await prisma.quizAnswer.upsert({
      where: {
        attemptId_questionId: { attemptId, questionId: data.questionId },
      },
      create: {
        attemptId,
        questionId: data.questionId,
        answer: data.answer,
      },
      update: {
        answer: data.answer,
        answeredAt: new Date(),
      },
    });

    return { message: 'Answer saved' };
  }

  async submitAttempt(attemptId: number, userId: number) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          include: {
            questions: true,
          },
        },
        answers: true,
      },
    });

    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.userId !== userId) throw new AppError('Not authorized', 403);
    if (attempt.status !== 'in_progress') throw new AppError('Attempt already submitted', 400);

    // Grade objective questions
    let pointsEarned = 0;
    let pointsTotal = 0;

    for (const question of attempt.quiz.questions) {
      pointsTotal += question.points;
      const answer = attempt.answers.find(a => a.questionId === question.id);

      if (answer) {
        const isCorrect = this.checkAnswer(question, answer.answer || '');
        const points = isCorrect ? question.points : 0;
        pointsEarned += points;

        await prisma.quizAnswer.update({
          where: { id: answer.id },
          data: {
            isCorrect,
            pointsAwarded: points,
          },
        });
      }
    }

    const score = pointsTotal > 0 ? (pointsEarned / pointsTotal) * 100 : 0;
    const timeTaken = Math.round((Date.now() - attempt.startedAt.getTime()) / 1000);

    const updatedAttempt = await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        submittedAt: new Date(),
        score,
        pointsEarned,
        pointsTotal,
        timeTaken,
        status: 'graded',
      },
    });

    logger.info({ attemptId, score, timeTaken }, 'Quiz attempt submitted');

    const passed = score >= attempt.quiz.passingScore;

    // Send quiz result notification (non-blocking)
    emailService.sendQuizResultNotification(
      userId,
      attempt.quiz.courseId,
      attempt.quizId,
      attemptId,
      attempt.quiz.title,
      score,
      passed
    ).catch((err) => {
      logger.warn({ err, attemptId }, 'Failed to send quiz result notification');
    });

    return {
      ...updatedAttempt,
      passed,
    };
  }

  private checkAnswer(question: any, userAnswer: string): boolean {
    const correct = question.correctAnswer.toLowerCase().trim();
    const answer = userAnswer.toLowerCase().trim();

    switch (question.questionType) {
      case 'multiple_choice':
      case 'true_false':
        return answer === correct;
      case 'short_answer':
      case 'fill_in_blank':
        // Allow some flexibility for text answers
        return answer === correct || correct.includes(answer);
      default:
        return answer === correct;
    }
  }

  async getAttemptResults(attemptId: number, userId: number, isInstructor = false, isAdmin = false) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          include: {
            course: { select: { instructorId: true } },
            questions: { orderBy: { orderIndex: 'asc' } },
          },
        },
        answers: true,
      },
    });

    if (!attempt) throw new AppError('Attempt not found', 404);

    // Check authorization
    const isOwner = attempt.userId === userId;
    const isCourseInstructor = attempt.quiz.course.instructorId === userId;

    if (!isOwner && !isCourseInstructor && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    // Check if results should be shown
    if (isOwner && !isInstructor && !isAdmin) {
      const showResults = attempt.quiz.showResults;
      if (showResults === 'never') {
        throw new AppError('Results are not available for this quiz', 403);
      }
      if (showResults === 'after_due_date' && attempt.quiz.dueDate && new Date() < attempt.quiz.dueDate) {
        throw new AppError('Results will be available after the due date', 403);
      }
    }

    // Build results with answers
    const answerMap = new Map(attempt.answers.map(a => [a.questionId, a]));

    const results = attempt.quiz.questions.map(q => {
      const answer = answerMap.get(q.id);
      return {
        question: {
          id: q.id,
          questionType: q.questionType,
          questionText: q.questionText,
          options: q.options ? JSON.parse(q.options) : null,
          points: q.points,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        },
        userAnswer: answer?.answer || null,
        isCorrect: answer?.isCorrect ?? null,
        pointsAwarded: answer?.pointsAwarded ?? 0,
      };
    });

    return {
      attempt: {
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        score: attempt.score,
        pointsEarned: attempt.pointsEarned,
        pointsTotal: attempt.pointsTotal,
        timeTaken: attempt.timeTaken,
        status: attempt.status,
        passed: (attempt.score ?? 0) >= attempt.quiz.passingScore,
      },
      quiz: {
        id: attempt.quiz.id,
        title: attempt.quiz.title,
        passingScore: attempt.quiz.passingScore,
      },
      results,
    };
  }

  async getQuizAttempts(quizId: number, instructorId: number, isAdmin = false) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { course: true },
    });

    if (!quiz) throw new AppError('Quiz not found', 404);
    if (quiz.course.instructorId !== instructorId && !isAdmin) {
      throw new AppError('Not authorized', 403);
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        attemptNumber: true,
        startedAt: true,
        submittedAt: true,
        score: true,
        pointsEarned: true,
        pointsTotal: true,
        timeTaken: true,
        status: true,
      },
    });

    // Get user info
    const userIds = [...new Set(attempts.map(a => a.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullname: true, email: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return attempts.map(a => ({
      ...a,
      user: userMap.get(a.userId),
      passed: (a.score ?? 0) >= quiz.passingScore,
    }));
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

export const quizService = new QuizService();
