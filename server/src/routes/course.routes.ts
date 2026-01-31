import { Router, Response } from 'express';
import { courseService } from '../services/course.service.js';
import { moduleService } from '../services/module.service.js';
import { lectureService } from '../services/lecture.service.js';
import { sectionService } from '../services/section.service.js';
import { chatbotConversationService } from '../services/chatbotConversation.service.js';
import { authenticateToken, requireInstructor, optionalAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  createCourseSchema,
  updateCourseSchema,
  createModuleSchema,
  updateModuleSchema,
  reorderModulesSchema,
  createLectureSchema,
  updateLectureSchema,
  createSectionSchema,
  updateSectionSchema,
  reorderSectionsSchema,
  generateAIContentSchema,
  chatbotMessageSchema,
  parsePaginationLimit,
} from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// ============= COURSES =============

// Get all published courses (catalog)
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parsePaginationLimit(req.query.limit as string, 10);
  const filters = {
    category: req.query.category as string,
    difficulty: req.query.difficulty as string,
    search: req.query.search as string,
  };

  const result = await courseService.getCourses(filters, page, limit);
  res.json({ success: true, ...result });
}));

// Get instructor's courses (admins see all courses)
router.get('/my-courses', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courses = await courseService.getInstructorCourses(req.user!.id, req.user!.isAdmin);
  res.json({ success: true, data: courses });
}));

// Get course by ID
router.get('/:id', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  // Only admins can see ALL unpublished courses
  // Instructors can only see their own unpublished courses
  const course = await courseService.getCourseByIdWithOwnerCheck(
    id,
    req.user?.id,
    req.user?.isAdmin || false,
    req.user?.isInstructor || false
  );
  res.json({ success: true, data: course });
}));

// Get course by slug
router.get('/slug/:slug', asyncHandler(async (req: AuthRequest, res: Response) => {
  const course = await courseService.getCourseBySlug(req.params.slug);
  res.json({ success: true, data: course });
}));

// Create course
router.post('/', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createCourseSchema.parse(req.body);
  const course = await courseService.createCourse(req.user!.id, data);
  res.status(201).json({ success: true, data: course });
}));

// Update course
router.put('/:id', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const data = updateCourseSchema.parse(req.body);
  const course = await courseService.updateCourse(id, req.user!.id, data, req.user!.isAdmin);
  res.json({ success: true, data: course });
}));

// Delete course
router.delete('/:id', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const result = await courseService.deleteCourse(id, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// Publish course
router.post('/:id/publish', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const course = await courseService.publishCourse(id, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, data: course });
}));

// Unpublish course
router.post('/:id/unpublish', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const course = await courseService.unpublishCourse(id, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, data: course });
}));

// Get course students
router.get('/:id/students', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const students = await courseService.getCourseStudents(id, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, data: students });
}));

// Update course AI settings (Collaborative Module)
router.put('/:id/ai-settings', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const settings = req.body;
  const course = await courseService.updateAISettings(id, req.user!.id, settings, req.user!.isAdmin);
  res.json({ success: true, data: course });
}));

// ============= MODULES =============

// Get course modules (requires authentication)
router.get('/:courseId/modules', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const modules = await moduleService.getModules(courseId, req.user!.id, req.user!.isInstructor, req.user!.isAdmin);
  res.json({ success: true, data: modules });
}));

// Create module
router.post('/:courseId/modules', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const data = createModuleSchema.parse(req.body);
  const module = await moduleService.createModule(courseId, req.user!.id, data, req.user!.isAdmin);
  res.status(201).json({ success: true, data: module });
}));

// Update module
router.put('/modules/:moduleId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const moduleId = parseInt(req.params.moduleId);
  const data = updateModuleSchema.parse(req.body);
  const module = await moduleService.updateModule(moduleId, req.user!.id, data, req.user!.isAdmin);
  res.json({ success: true, data: module });
}));

// Delete module
router.delete('/modules/:moduleId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const moduleId = parseInt(req.params.moduleId);
  const result = await moduleService.deleteModule(moduleId, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// Reorder modules
router.put('/:courseId/modules/reorder', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const { moduleIds } = reorderModulesSchema.parse(req.body);
  const result = await moduleService.reorderModules(courseId, req.user!.id, moduleIds, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// ============= LECTURES =============

// Get module lectures
router.get('/modules/:moduleId/lectures', asyncHandler(async (req: AuthRequest, res: Response) => {
  const moduleId = parseInt(req.params.moduleId);
  const lectures = await lectureService.getLectures(moduleId);
  res.json({ success: true, data: lectures });
}));

// Get lecture by ID
router.get('/lectures/:lectureId', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const lectureId = parseInt(req.params.lectureId);
  const lecture = await lectureService.getLectureById(lectureId, req.user?.id);
  res.json({ success: true, data: lecture });
}));

// Create lecture
router.post('/modules/:moduleId/lectures', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const moduleId = parseInt(req.params.moduleId);
  const data = createLectureSchema.parse(req.body);
  const lecture = await lectureService.createLecture(moduleId, req.user!.id, data, req.user!.isAdmin);
  res.status(201).json({ success: true, data: lecture });
}));

// Update lecture
router.put('/lectures/:lectureId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const lectureId = parseInt(req.params.lectureId);
  const data = updateLectureSchema.parse(req.body);
  const lecture = await lectureService.updateLecture(lectureId, req.user!.id, data, req.user!.isAdmin);
  res.json({ success: true, data: lecture });
}));

// Delete lecture
router.delete('/lectures/:lectureId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const lectureId = parseInt(req.params.lectureId);
  const result = await lectureService.deleteLecture(lectureId, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// Reorder lectures
router.put('/modules/:moduleId/lectures/reorder', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const moduleId = parseInt(req.params.moduleId);
  const { lectureIds } = req.body;
  const result = await lectureService.reorderLectures(moduleId, req.user!.id, lectureIds, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// Add attachment to lecture
router.post('/lectures/:lectureId/attachments', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const lectureId = parseInt(req.params.lectureId);
  const file = req.body;
  const attachment = await lectureService.addAttachment(lectureId, req.user!.id, file, req.user!.isAdmin);
  res.status(201).json({ success: true, data: attachment });
}));

// Delete attachment
router.delete('/attachments/:attachmentId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const attachmentId = parseInt(req.params.attachmentId);
  const result = await lectureService.deleteAttachment(attachmentId, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// ============= SECTIONS =============

// Get lecture sections
router.get('/lectures/:lectureId/sections', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const lectureId = parseInt(req.params.lectureId);
  const sections = await sectionService.getSections(lectureId);
  res.json({ success: true, data: sections });
}));

// Create section
router.post('/lectures/:lectureId/sections', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const lectureId = parseInt(req.params.lectureId);
  const data = createSectionSchema.parse(req.body);
  const section = await sectionService.createSection(lectureId, req.user!.id, data, req.user!.isAdmin);
  res.status(201).json({ success: true, data: section });
}));

// Update section
router.put('/sections/:sectionId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const sectionId = parseInt(req.params.sectionId);
  const data = updateSectionSchema.parse(req.body);
  const section = await sectionService.updateSection(sectionId, req.user!.id, data, req.user!.isAdmin);
  res.json({ success: true, data: section });
}));

// Delete section
router.delete('/sections/:sectionId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const sectionId = parseInt(req.params.sectionId);
  const result = await sectionService.deleteSection(sectionId, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// Reorder sections
router.put('/lectures/:lectureId/sections/reorder', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const lectureId = parseInt(req.params.lectureId);
  const { sectionIds } = reorderSectionsSchema.parse(req.body);
  const result = await sectionService.reorderSections(lectureId, req.user!.id, sectionIds, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// Generate AI content
router.post('/sections/generate', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { prompt, context } = generateAIContentSchema.parse(req.body);
  const content = await sectionService.generateAIContent(prompt, context);
  res.json({ success: true, data: { content } });
}));

// Get assignments list for section (instructor only)
router.get('/:courseId/assignments/list', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const assignments = await sectionService.getCourseAssignmentsForSection(courseId);
  res.json({ success: true, data: assignments });
}));

// ============= CHATBOT CONVERSATIONS (Student) =============

// Send message to chatbot section
router.post('/sections/:sectionId/chat', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const sectionId = parseInt(req.params.sectionId);
  const data = chatbotMessageSchema.parse(req.body);
  const result = await chatbotConversationService.sendMessage(sectionId, req.user!.id, data);
  res.json({ success: true, data: result });
}));

// Get conversation history for chatbot section
router.get('/sections/:sectionId/chat/history', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const sectionId = parseInt(req.params.sectionId);
  const history = await chatbotConversationService.getConversationHistory(sectionId, req.user!.id);
  res.json({ success: true, data: history });
}));

// Clear conversation history
router.delete('/sections/:sectionId/chat', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const sectionId = parseInt(req.params.sectionId);
  const result = await chatbotConversationService.clearConversation(sectionId, req.user!.id);
  res.json({ success: true, ...result });
}));

// ============= CHATBOT ANALYTICS (Instructor) =============

// Get all chatbot sections for a course with conversation counts
router.get('/:courseId/chatbot-sections', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const sections = await chatbotConversationService.getChatbotSectionsForCourse(courseId, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, data: sections });
}));

// Get chatbot analytics for a course
router.get('/:courseId/chatbot-analytics', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const analytics = await chatbotConversationService.getChatbotAnalytics(courseId, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, data: analytics });
}));

// Get all conversations for a chatbot section
router.get('/sections/:sectionId/conversations', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const sectionId = parseInt(req.params.sectionId);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parsePaginationLimit(req.query.limit as string, 20);
  const result = await chatbotConversationService.getConversationsForSection(sectionId, req.user!.id, req.user!.isAdmin, page, limit);
  res.json({ success: true, data: result });
}));

// Get messages for a specific conversation (instructor view)
router.get('/chatbot-conversations/:conversationId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const conversationId = parseInt(req.params.conversationId);
  const result = await chatbotConversationService.getConversationMessagesForInstructor(conversationId, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, data: result });
}));

export default router;
