import { Router, Response } from 'express';
import { surveyService } from '../services/survey.service.js';
import { authenticateToken, requireInstructor, optionalAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  createSurveySchema,
  updateSurveySchema,
  createSurveyQuestionSchema,
  updateSurveyQuestionSchema,
  reorderQuestionsSchema,
  submitSurveyResponseSchema,
} from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// =============================================================================
// SURVEY CRUD (Instructor)
// =============================================================================

// Get surveys (for a course or all user's surveys)
router.get('/', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;
  const surveys = await surveyService.getSurveys(courseId, req.user!.id, true);
  res.json({ success: true, data: surveys });
}));

// Get survey by ID (public for taking, instructor for management)
router.get('/:id', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const isInstructor = req.user?.isInstructor || req.user?.isAdmin || false;
  const survey = await surveyService.getSurveyById(id, req.user?.id, isInstructor);
  res.json({ success: true, data: survey });
}));

// Create survey
router.post('/', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createSurveySchema.parse(req.body);
  const survey = await surveyService.createSurvey(req.user!.id, data, req.user!.isAdmin);
  res.status(201).json({ success: true, data: survey });
}));

// Update survey
router.put('/:id', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const data = updateSurveySchema.parse(req.body);
  const survey = await surveyService.updateSurvey(id, req.user!.id, data, req.user!.isAdmin);
  res.json({ success: true, data: survey });
}));

// Delete survey
router.delete('/:id', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const result = await surveyService.deleteSurvey(id, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// Publish survey
router.post('/:id/publish', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const survey = await surveyService.publishSurvey(id, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, data: survey });
}));

// =============================================================================
// QUESTIONS
// =============================================================================

// Add question
router.post('/:surveyId/questions', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const surveyId = parseInt(req.params.surveyId);
  const data = createSurveyQuestionSchema.parse(req.body);
  const question = await surveyService.addQuestion(surveyId, req.user!.id, data, req.user!.isAdmin);
  res.status(201).json({ success: true, data: question });
}));

// Update question
router.put('/:surveyId/questions/:questionId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const surveyId = parseInt(req.params.surveyId);
  const questionId = parseInt(req.params.questionId);
  const data = updateSurveyQuestionSchema.parse(req.body);
  const question = await surveyService.updateQuestion(surveyId, questionId, req.user!.id, data, req.user!.isAdmin);
  res.json({ success: true, data: question });
}));

// Delete question
router.delete('/:surveyId/questions/:questionId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const surveyId = parseInt(req.params.surveyId);
  const questionId = parseInt(req.params.questionId);
  const result = await surveyService.deleteQuestion(surveyId, questionId, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// Reorder questions
router.post('/:surveyId/questions/reorder', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const surveyId = parseInt(req.params.surveyId);
  const data = reorderQuestionsSchema.parse(req.body);
  const result = await surveyService.reorderQuestions(surveyId, req.user!.id, data.questionIds, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// =============================================================================
// RESPONSES (Student)
// =============================================================================

// Submit survey response
router.post('/:id/submit', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const surveyId = parseInt(req.params.id);
  const data = submitSurveyResponseSchema.parse(req.body);
  const response = await surveyService.submitResponse(surveyId, req.user?.id || null, data);
  res.status(201).json({ success: true, data: response });
}));

// Check if user already completed survey
router.get('/:id/my-response', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const surveyId = parseInt(req.params.id);
  const result = await surveyService.checkIfCompleted(surveyId, req.user!.id);
  res.json({ success: true, data: result });
}));

// =============================================================================
// ANALYTICS (Instructor)
// =============================================================================

// Get all responses for a survey
router.get('/:id/responses', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const surveyId = parseInt(req.params.id);
  const data = await surveyService.getResponses(surveyId, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, data });
}));

// Export responses as CSV
router.get('/:id/export', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const surveyId = parseInt(req.params.id);
  const { filename, content } = await surveyService.exportResponses(surveyId, req.user!.id, req.user!.isAdmin);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(content);
}));

export default router;
