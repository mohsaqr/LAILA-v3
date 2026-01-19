import { Router, Response } from 'express';
import { enrollmentService } from '../services/enrollment.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// Get my enrollments
router.get('/', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const enrollments = await enrollmentService.getMyEnrollments(req.user!.id);
  res.json({ success: true, data: enrollments });
}));

// Get specific enrollment
router.get('/course/:courseId', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const enrollment = await enrollmentService.getEnrollment(req.user!.id, courseId);

  if (!enrollment) {
    res.json({ success: true, data: null, enrolled: false });
    return;
  }

  res.json({ success: true, data: enrollment, enrolled: true });
}));

// Enroll in course
router.post('/', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.body;

  if (!courseId) {
    res.status(400).json({ success: false, error: 'Course ID is required' });
    return;
  }

  const enrollment = await enrollmentService.enroll(req.user!.id, parseInt(courseId));
  res.status(201).json({ success: true, data: enrollment });
}));

// Unenroll from course
router.delete('/course/:courseId', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const result = await enrollmentService.unenroll(req.user!.id, courseId);
  res.json({ success: true, ...result });
}));

// Get progress for a course
router.get('/course/:courseId/progress', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const progress = await enrollmentService.getProgress(req.user!.id, courseId);
  res.json({ success: true, data: progress });
}));

// Mark lecture as complete
router.post('/course/:courseId/lectures/:lectureId/complete', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const lectureId = parseInt(req.params.lectureId);

  const progress = await enrollmentService.markLectureComplete(req.user!.id, courseId, lectureId);
  res.json({ success: true, data: progress });
}));

// Update time spent on lecture
router.post('/course/:courseId/lectures/:lectureId/time', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const lectureId = parseInt(req.params.lectureId);
  const { timeSpent } = req.body;

  if (typeof timeSpent !== 'number' || timeSpent < 0) {
    res.status(400).json({ success: false, error: 'Valid time spent is required' });
    return;
  }

  const progress = await enrollmentService.updateLectureTime(req.user!.id, courseId, lectureId, timeSpent);
  res.json({ success: true, data: progress });
}));

export default router;
