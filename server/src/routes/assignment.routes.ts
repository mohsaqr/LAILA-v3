import { Router, Response } from 'express';
import { assignmentService } from '../services/assignment.service.js';
import { authenticateToken, requireInstructor } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  createSubmissionSchema,
  gradeSubmissionSchema,
} from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// ============= ASSIGNMENTS =============

// Get assignments for a course (requires enrollment or instructor/admin access)
router.get('/course/:courseId', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const assignments = await assignmentService.getAssignments(
    courseId,
    req.user!.id,
    req.user!.isInstructor,
    req.user!.isAdmin
  );
  res.json({ success: true, data: assignments });
}));

// Get assignment by ID
router.get('/:id', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const assignment = await assignmentService.getAssignmentById(id, req.user!.id);
  res.json({ success: true, data: assignment });
}));

// Create assignment
router.post('/course/:courseId', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const data = createAssignmentSchema.parse(req.body);
  const assignment = await assignmentService.createAssignment(courseId, req.user!.id, data, req.user!.isAdmin);
  res.status(201).json({ success: true, data: assignment });
}));

// Update assignment
router.put('/:id', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const data = updateAssignmentSchema.parse(req.body);
  const assignment = await assignmentService.updateAssignment(id, req.user!.id, data, req.user!.isAdmin);
  res.json({ success: true, data: assignment });
}));

// Delete assignment
router.delete('/:id', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const result = await assignmentService.deleteAssignment(id, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, ...result });
}));

// ============= SUBMISSIONS =============

// Get submissions for an assignment (instructor)
router.get('/:id/submissions', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const submissions = await assignmentService.getSubmissions(id, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, data: submissions });
}));

// Submit assignment (student)
router.post('/:id/submit', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const data = createSubmissionSchema.parse(req.body);
  const submission = await assignmentService.submitAssignment(id, req.user!.id, data);
  res.status(201).json({ success: true, data: submission });
}));

// Get my submission for an assignment
router.get('/:id/my-submission', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const submission = await assignmentService.getMySubmission(id, req.user!.id);
  res.json({ success: true, data: submission });
}));

// Grade submission (instructor)
router.post('/submissions/:submissionId/grade', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const submissionId = parseInt(req.params.submissionId);
  const data = gradeSubmissionSchema.parse(req.body);
  const submission = await assignmentService.gradeSubmission(submissionId, req.user!.id, data, req.user!.isAdmin);
  res.json({ success: true, data: submission });
}));

// Get course gradebook
router.get('/course/:courseId/gradebook', authenticateToken, requireInstructor, asyncHandler(async (req: AuthRequest, res: Response) => {
  const courseId = parseInt(req.params.courseId);
  const gradebook = await assignmentService.getCourseGradebook(courseId, req.user!.id, req.user!.isAdmin);
  res.json({ success: true, data: gradebook });
}));

export default router;
