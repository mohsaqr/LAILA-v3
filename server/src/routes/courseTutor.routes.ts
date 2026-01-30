import { Router, Response } from 'express';
import { courseTutorService } from '../services/courseTutor.service.js';
import { authenticateToken, requireInstructor, requireAdmin } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// =============================================================================
// HELPER: Check course access
// =============================================================================

async function checkInstructorAccess(req: AuthRequest, courseId: number): Promise<boolean> {
  const userId = req.user!.id;
  const isAdmin = req.user!.isAdmin;
  if (isAdmin) return true;
  return courseTutorService.isCourseInstructor(courseId, userId);
}

function detectDeviceType(userAgent?: string): string {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }
  return 'desktop';
}

// =============================================================================
// INSTRUCTOR ENDPOINTS
// =============================================================================

/**
 * GET /api/courses/:courseId/tutors
 * List all tutors for a course (with stats for instructor)
 */
router.get(
  '/:courseId/tutors',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const courseId = parseInt(req.params.courseId);
    const userId = req.user!.id;

    if (isNaN(courseId)) {
      res.status(400).json({ success: false, error: 'Invalid course ID' });
      return;
    }

    // Check if instructor or enrolled student
    const isInstructor = await checkInstructorAccess(req, courseId);

    if (isInstructor) {
      // Instructor view: full stats
      const tutors = await courseTutorService.getCourseTutors(courseId);
      res.json({ success: true, data: tutors });
    } else {
      // Student view: merged configs only
      const tutors = await courseTutorService.getStudentTutors(courseId, userId);
      res.json({ success: true, data: tutors });
    }
  })
);

/**
 * GET /api/courses/:courseId/tutors/available
 * Get available global tutors that can be added
 */
router.get(
  '/:courseId/tutors/available',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const courseId = parseInt(req.params.courseId);

    if (isNaN(courseId)) {
      res.status(400).json({ success: false, error: 'Invalid course ID' });
      return;
    }

    const hasAccess = await checkInstructorAccess(req, courseId);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const tutors = await courseTutorService.getAvailableTutors(courseId);
    res.json({ success: true, data: tutors });
  })
);

/**
 * POST /api/courses/:courseId/tutors
 * Add a tutor to the course
 */
router.post(
  '/:courseId/tutors',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const courseId = parseInt(req.params.courseId);
    const userId = req.user!.id;

    if (isNaN(courseId)) {
      res.status(400).json({ success: false, error: 'Invalid course ID' });
      return;
    }

    const hasAccess = await checkInstructorAccess(req, courseId);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { chatbotId, customName, customDescription, customSystemPrompt, customWelcomeMessage, customPersonality, customTemperature } = req.body;

    if (!chatbotId || typeof chatbotId !== 'number') {
      res.status(400).json({ success: false, error: 'chatbotId is required' });
      return;
    }

    const tutor = await courseTutorService.addTutorToCourse(courseId, {
      chatbotId,
      customName,
      customDescription,
      customSystemPrompt,
      customWelcomeMessage,
      customPersonality,
      customTemperature,
    }, userId);

    res.status(201).json({ success: true, data: tutor });
  })
);

/**
 * PUT /api/courses/:courseId/tutors/:id
 * Update tutor customization
 */
router.put(
  '/:courseId/tutors/:id',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const courseId = parseInt(req.params.courseId);
    const tutorId = parseInt(req.params.id);
    const userId = req.user!.id;

    if (isNaN(courseId) || isNaN(tutorId)) {
      res.status(400).json({ success: false, error: 'Invalid ID' });
      return;
    }

    const hasAccess = await checkInstructorAccess(req, courseId);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { customName, customDescription, customSystemPrompt, customWelcomeMessage, customPersonality, customTemperature, isActive } = req.body;

    const tutor = await courseTutorService.updateCourseTutor(tutorId, {
      customName,
      customDescription,
      customSystemPrompt,
      customWelcomeMessage,
      customPersonality,
      customTemperature,
      isActive,
    }, userId);

    res.json({ success: true, data: tutor });
  })
);

/**
 * DELETE /api/courses/:courseId/tutors/:id
 * Remove tutor from course
 */
router.delete(
  '/:courseId/tutors/:id',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const courseId = parseInt(req.params.courseId);
    const tutorId = parseInt(req.params.id);
    const userId = req.user!.id;

    if (isNaN(courseId) || isNaN(tutorId)) {
      res.status(400).json({ success: false, error: 'Invalid ID' });
      return;
    }

    const hasAccess = await checkInstructorAccess(req, courseId);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    await courseTutorService.removeCourseTutor(tutorId, userId);
    res.json({ success: true, message: 'Tutor removed from course' });
  })
);

/**
 * PUT /api/courses/:courseId/tutors/reorder
 * Reorder tutors
 */
router.put(
  '/:courseId/tutors/reorder',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const courseId = parseInt(req.params.courseId);

    if (isNaN(courseId)) {
      res.status(400).json({ success: false, error: 'Invalid course ID' });
      return;
    }

    const hasAccess = await checkInstructorAccess(req, courseId);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      res.status(400).json({ success: false, error: 'orderedIds must be an array' });
      return;
    }

    await courseTutorService.reorderCourseTutors(courseId, orderedIds);
    res.json({ success: true, message: 'Tutors reordered' });
  })
);

/**
 * GET /api/courses/:courseId/tutors/stats
 * Get usage statistics for instructors
 */
router.get(
  '/:courseId/tutors/stats',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const courseId = parseInt(req.params.courseId);

    if (isNaN(courseId)) {
      res.status(400).json({ success: false, error: 'Invalid course ID' });
      return;
    }

    const hasAccess = await checkInstructorAccess(req, courseId);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const stats = await courseTutorService.getTutorStats(courseId);
    res.json({ success: true, data: stats });
  })
);

// =============================================================================
// STUDENT CHAT ENDPOINTS
// =============================================================================

/**
 * GET /api/courses/:courseId/tutors/:id/conversations
 * List student's conversations with a tutor
 */
router.get(
  '/:courseId/tutors/:id/conversations',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tutorId = parseInt(req.params.id);
    const userId = req.user!.id;

    if (isNaN(tutorId)) {
      res.status(400).json({ success: false, error: 'Invalid tutor ID' });
      return;
    }

    const conversations = await courseTutorService.getConversations(tutorId, userId);
    res.json({ success: true, data: conversations });
  })
);

/**
 * POST /api/courses/:courseId/tutors/:id/conversations
 * Create a new conversation
 */
router.post(
  '/:courseId/tutors/:id/conversations',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tutorId = parseInt(req.params.id);
    const userId = req.user!.id;

    if (isNaN(tutorId)) {
      res.status(400).json({ success: false, error: 'Invalid tutor ID' });
      return;
    }

    const conversation = await courseTutorService.createConversation(tutorId, userId);
    res.status(201).json({ success: true, data: conversation });
  })
);

/**
 * GET /api/courses/:courseId/tutors/conversations/:convId
 * Get conversation with messages
 */
router.get(
  '/:courseId/tutors/conversations/:convId',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const convId = parseInt(req.params.convId);
    const userId = req.user!.id;

    if (isNaN(convId)) {
      res.status(400).json({ success: false, error: 'Invalid conversation ID' });
      return;
    }

    const conversation = await courseTutorService.getConversation(convId, userId);
    res.json({ success: true, data: conversation });
  })
);

/**
 * POST /api/courses/:courseId/tutors/conversations/:convId/messages
 * Send a message
 */
router.post(
  '/:courseId/tutors/conversations/:convId/messages',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const convId = parseInt(req.params.convId);
    const userId = req.user!.id;
    const { message } = req.body;

    if (isNaN(convId)) {
      res.status(400).json({ success: false, error: 'Invalid conversation ID' });
      return;
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    const clientInfo = {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      deviceType: detectDeviceType(req.headers['user-agent']),
    };

    const result = await courseTutorService.sendMessage(
      convId,
      userId,
      message.trim(),
      clientInfo
    );

    res.json({ success: true, data: result });
  })
);

/**
 * DELETE /api/courses/:courseId/tutors/conversations/:convId
 * Delete a conversation
 */
router.delete(
  '/:courseId/tutors/conversations/:convId',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const convId = parseInt(req.params.convId);
    const userId = req.user!.id;

    if (isNaN(convId)) {
      res.status(400).json({ success: false, error: 'Invalid conversation ID' });
      return;
    }

    await courseTutorService.deleteConversation(convId, userId);
    res.json({ success: true, message: 'Conversation deleted' });
  })
);

export default router;
