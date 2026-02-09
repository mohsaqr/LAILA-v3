import { Router } from 'express';
import { quizService } from '../services/quiz.service.js';
import { mcqGenerationService } from '../services/mcqGeneration.service.js';
import { authenticateToken, requireInstructor, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createQuizSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  instructions: z.string().optional(),
  timeLimit: z.number().positive().optional(),
  maxAttempts: z.number().min(0).optional(),
  passingScore: z.number().min(0).max(100).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  showResults: z.enum(['after_submit', 'after_due_date', 'never']).optional(),
  dueDate: z.string().datetime().optional(),
  availableFrom: z.string().datetime().optional(),
  moduleId: z.number().positive().optional(),
});

const createQuestionSchema = z.object({
  questionType: z.enum(['multiple_choice', 'true_false', 'short_answer', 'fill_in_blank']),
  questionText: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  explanation: z.string().optional(),
  points: z.number().positive().optional(),
  orderIndex: z.number().min(0).optional(),
});

const submitAnswerSchema = z.object({
  questionId: z.number().positive(),
  answer: z.string(),
});

// MCQ Generation schemas
const generateMCQSchema = z.object({
  topic: z.string().min(1).max(500),
  content: z.string().optional(),
  questionCount: z.number().min(1).max(10),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  optionCount: z.number().min(3).max(5).optional(),
  includeExplanations: z.boolean().optional(),
  courseContext: z.string().optional(),
});

const bulkQuestionsSchema = z.object({
  questions: z.array(createQuestionSchema).min(1).max(20),
});

const generatePracticeSchema = z.object({
  lectureId: z.number().positive(),
  questionCount: z.number().min(1).max(10),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

// =========================================================================
// PRACTICE MCQ GENERATION (must be before parameterized routes)
// =========================================================================

// Generate practice MCQs for a lecture (student self-study)
// NOTE: This route MUST be before /:quizId routes to avoid matching "practice" as quizId
router.post('/practice/generate', authenticateToken, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const data = generatePracticeSchema.parse(req.body);

  const questions = await mcqGenerationService.generatePracticeQuestions(
    data.lectureId,
    user.id,
    {
      questionCount: data.questionCount,
      difficulty: data.difficulty,
    }
  );

  res.json({ success: true, data: { questions } });
}));

// =========================================================================
// QUIZ CRUD ROUTES
// =========================================================================

// Get all quizzes for instructor (across all their courses)
router.get('/instructor', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const quizzes = await quizService.getInstructorQuizzes(user.id, user.isAdmin);
  res.json({ success: true, data: quizzes });
}));

// Get all quizzes for student (across all enrolled courses)
router.get('/student', authenticateToken, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const quizzes = await quizService.getStudentQuizzes(user.id);
  res.json({ success: true, data: quizzes });
}));

// Get all quizzes for a course
router.get('/course/:courseId', authenticateToken, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const user = (req as any).user;

  const quizzes = await quizService.getQuizzes(
    courseId,
    user.id,
    user.isInstructor,
    user.isAdmin
  );

  res.json({ success: true, data: quizzes });
}));

// Get quiz by ID (with questions)
// Only course owner or admin can see correct answers
router.get('/:quizId', authenticateToken, asyncHandler(async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const user = (req as any).user;

  // First get quiz without answers to check ownership
  const quizBasic = await quizService.getQuizById(quizId, user.id, false);

  // Only course owner or admin can see correct answers
  const isCourseOwner = quizBasic.course?.instructorId === user.id;
  const includeAnswers = user.isAdmin || isCourseOwner;

  // If answers needed, refetch with answers
  const quiz = includeAnswers
    ? await quizService.getQuizById(quizId, user.id, true)
    : quizBasic;

  res.json({ success: true, data: quiz });
}));

// Create quiz (instructor/admin only)
router.post('/course/:courseId', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  const user = (req as any).user;
  const data = createQuizSchema.parse(req.body);

  const quiz = await quizService.createQuiz(courseId, user.id, data, user.isAdmin);
  res.status(201).json({ success: true, data: quiz });
}));

// Update quiz
router.put('/:quizId', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const user = (req as any).user;
  const data = createQuizSchema.partial().extend({
    isPublished: z.boolean().optional(),
  }).parse(req.body);

  const quiz = await quizService.updateQuiz(quizId, user.id, data, user.isAdmin);
  res.json({ success: true, data: quiz });
}));

// Delete quiz
router.delete('/:quizId', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const user = (req as any).user;

  const result = await quizService.deleteQuiz(quizId, user.id, user.isAdmin);
  res.json({ success: true, ...result });
}));

// =========================================================================
// QUESTION ROUTES
// =========================================================================

// Add question to quiz
router.post('/:quizId/questions', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const user = (req as any).user;
  const data = createQuestionSchema.parse(req.body);

  const question = await quizService.addQuestion(quizId, user.id, data, user.isAdmin);
  res.status(201).json({ success: true, data: question });
}));

// Update question
router.put('/questions/:questionId', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const questionId = parseInt(req.params.questionId);
  const user = (req as any).user;
  const data = createQuestionSchema.partial().parse(req.body);

  const question = await quizService.updateQuestion(questionId, user.id, data, user.isAdmin);
  res.json({ success: true, data: question });
}));

// Delete question
router.delete('/questions/:questionId', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const questionId = parseInt(req.params.questionId);
  const user = (req as any).user;

  const result = await quizService.deleteQuestion(questionId, user.id, user.isAdmin);
  res.json({ success: true, ...result });
}));

// Reorder questions
router.put('/:quizId/questions/reorder', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const user = (req as any).user;
  const { questionIds } = z.object({ questionIds: z.array(z.number()) }).parse(req.body);

  const result = await quizService.reorderQuestions(quizId, user.id, questionIds, user.isAdmin);
  res.json({ success: true, ...result });
}));

// =========================================================================
// MCQ GENERATION ROUTES
// =========================================================================

// Generate MCQs using AI for a quiz (instructor only)
router.post('/:quizId/generate', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const user = (req as any).user;
  const data = generateMCQSchema.parse(req.body);

  // Verify quiz ownership
  const quiz = await quizService.getQuizById(quizId, user.id, true);
  if (quiz.course?.instructorId !== user.id && !user.isAdmin) {
    return res.status(403).json({ success: false, error: 'Not authorized' });
  }

  const result = await mcqGenerationService.generateQuestions(data);
  res.json({ success: true, data: result });
}));

// Add multiple questions to a quiz at once (bulk)
router.post('/:quizId/questions/bulk', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const user = (req as any).user;
  const { questions } = bulkQuestionsSchema.parse(req.body);

  const createdQuestions = await quizService.addQuestionsBulk(quizId, user.id, questions, user.isAdmin);
  res.status(201).json({ success: true, data: createdQuestions });
}));

// =========================================================================
// ATTEMPT ROUTES (Student taking quiz)
// =========================================================================

// Start a quiz attempt
router.post('/:quizId/attempts', authenticateToken, asyncHandler(async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const user = (req as any).user;
  const ipAddress = req.ip || req.socket.remoteAddress;

  const result = await quizService.startAttempt(quizId, user.id, ipAddress);
  res.json({ success: true, data: result });
}));

// Save answer (auto-save as student answers)
router.post('/attempts/:attemptId/answers', authenticateToken, asyncHandler(async (req, res) => {
  const attemptId = parseInt(req.params.attemptId);
  const user = (req as any).user;
  const data = submitAnswerSchema.parse(req.body);

  const result = await quizService.saveAnswer(attemptId, user.id, data);
  res.json({ success: true, ...result });
}));

// Submit attempt (finalize and grade)
router.post('/attempts/:attemptId/submit', authenticateToken, asyncHandler(async (req, res) => {
  const attemptId = parseInt(req.params.attemptId);
  const user = (req as any).user;

  const result = await quizService.submitAttempt(attemptId, user.id);
  res.json({ success: true, data: result });
}));

// Get attempt results
router.get('/attempts/:attemptId/results', authenticateToken, asyncHandler(async (req, res) => {
  const attemptId = parseInt(req.params.attemptId);
  const user = (req as any).user;

  const results = await quizService.getAttemptResults(
    attemptId,
    user.id,
    user.isInstructor,
    user.isAdmin
  );
  res.json({ success: true, data: results });
}));

// =========================================================================
// INSTRUCTOR ROUTES
// =========================================================================

// Get all attempts for a quiz (instructor view)
router.get('/:quizId/attempts', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const user = (req as any).user;

  const attempts = await quizService.getQuizAttempts(quizId, user.id, user.isAdmin);
  res.json({ success: true, data: attempts });
}));

export default router;
