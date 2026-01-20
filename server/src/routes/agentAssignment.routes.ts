import { Router, Response } from 'express';
import { agentAssignmentService, EventContext } from '../services/agentAssignment.service.js';
import { authenticateToken, requireInstructor } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  createAgentConfigSchema,
  updateAgentConfigSchema,
  agentTestMessageSchema,
  gradeAgentSubmissionSchema,
} from '../utils/validation.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// Helper to build event context from request
const buildEventContext = (req: AuthRequest): EventContext => ({
  userId: req.user!.id,
  userFullname: req.user!.fullname,
  userEmail: req.user!.email,
  userRole: req.user!.isInstructor ? 'instructor' : 'student',
  ipAddress: req.ip || req.socket.remoteAddress,
  userAgent: req.headers['user-agent'],
  sessionId: req.headers['x-session-id'] as string | undefined,
});

// =============================================================================
// STUDENT ENDPOINTS
// =============================================================================

// Get my agent config for an assignment
router.get(
  '/:assignmentId/my-config',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assignmentId = parseInt(req.params.assignmentId);
    const result = await agentAssignmentService.getMyAgentConfig(assignmentId, req.user!.id);
    res.json({ success: true, data: result });
  })
);

// Create agent config
router.post(
  '/:assignmentId/config',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assignmentId = parseInt(req.params.assignmentId);
    const data = createAgentConfigSchema.parse(req.body);
    const context = buildEventContext(req);
    const config = await agentAssignmentService.createAgentConfig(assignmentId, req.user!.id, data, context);
    res.status(201).json({ success: true, data: config });
  })
);

// Update agent config
router.put(
  '/:assignmentId/config',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assignmentId = parseInt(req.params.assignmentId);
    const data = updateAgentConfigSchema.parse(req.body);
    const context = buildEventContext(req);
    const config = await agentAssignmentService.updateAgentConfig(assignmentId, req.user!.id, data, context);
    res.json({ success: true, data: config });
  })
);

// Submit agent for grading
router.post(
  '/:assignmentId/submit',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assignmentId = parseInt(req.params.assignmentId);
    const context = buildEventContext(req);
    const result = await agentAssignmentService.submitAgentConfig(assignmentId, req.user!.id, context);
    res.json({ success: true, data: result });
  })
);

// Unsubmit agent (return to draft)
router.post(
  '/:assignmentId/unsubmit',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assignmentId = parseInt(req.params.assignmentId);
    const context = buildEventContext(req);
    const config = await agentAssignmentService.unsubmitAgentConfig(assignmentId, req.user!.id, context);
    res.json({ success: true, data: config });
  })
);

// Start test conversation
router.post(
  '/:assignmentId/test/start',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assignmentId = parseInt(req.params.assignmentId);
    const { agentConfigId } = req.body;

    // If no agentConfigId provided, get the user's own config
    let configId = agentConfigId;
    if (!configId) {
      const result = await agentAssignmentService.getMyAgentConfig(assignmentId, req.user!.id);
      if (!result.config) {
        return res.status(404).json({ success: false, error: 'Agent config not found' });
      }
      configId = result.config.id;
    }

    const context = buildEventContext(req);
    const testerInfo = {
      userId: req.user!.id,
      role: 'student' as const,
      fullname: req.user!.fullname,
      email: req.user!.email,
    };

    const result = await agentAssignmentService.startTestConversation(
      assignmentId,
      configId,
      testerInfo,
      context
    );
    res.json({ success: true, data: result });
  })
);

// Send test message
router.post(
  '/:assignmentId/test/:conversationId/message',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const conversationId = parseInt(req.params.conversationId);
    const { message } = agentTestMessageSchema.parse(req.body);
    const context = buildEventContext(req);
    const testerInfo = {
      userId: req.user!.id,
      role: 'student' as const,
      fullname: req.user!.fullname,
      email: req.user!.email,
    };

    const result = await agentAssignmentService.sendTestMessage(
      conversationId,
      message,
      testerInfo,
      context
    );
    res.json({ success: true, data: result });
  })
);

// Get test conversation history
router.get(
  '/:assignmentId/test/:conversationId',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const conversationId = parseInt(req.params.conversationId);
    const conversation = await agentAssignmentService.getTestHistory(conversationId, req.user!.id);
    res.json({ success: true, data: conversation });
  })
);

// Get all my test conversations for an assignment
router.get(
  '/:assignmentId/test/history',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assignmentId = parseInt(req.params.assignmentId);
    const conversations = await agentAssignmentService.getMyTestConversations(assignmentId, req.user!.id);
    res.json({ success: true, data: conversations });
  })
);

// =============================================================================
// INSTRUCTOR ENDPOINTS
// =============================================================================

// Get all submissions for an assignment
router.get(
  '/:assignmentId/submissions',
  authenticateToken,
  requireInstructor,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assignmentId = parseInt(req.params.assignmentId);
    const submissions = await agentAssignmentService.getAgentSubmissions(
      assignmentId,
      req.user!.id,
      req.user!.isAdmin
    );
    res.json({ success: true, data: submissions });
  })
);

// Get single submission detail
router.get(
  '/:assignmentId/submissions/:submissionId',
  authenticateToken,
  requireInstructor,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assignmentId = parseInt(req.params.assignmentId);
    const submissionId = parseInt(req.params.submissionId);
    const submission = await agentAssignmentService.getAgentSubmissionDetail(
      assignmentId,
      submissionId,
      req.user!.id,
      req.user!.isAdmin
    );
    res.json({ success: true, data: submission });
  })
);

// Get config change history for a submission
router.get(
  '/:assignmentId/submissions/:submissionId/config-history',
  authenticateToken,
  requireInstructor,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const submissionId = parseInt(req.params.submissionId);

    // First get the submission to find the agent config ID
    const submission = await agentAssignmentService.getAgentSubmissionDetail(
      parseInt(req.params.assignmentId),
      submissionId,
      req.user!.id,
      req.user!.isAdmin
    );

    const history = await agentAssignmentService.getConfigHistory(
      submission.agentConfig!.id,
      req.user!.id,
      req.user!.isAdmin
    );
    res.json({ success: true, data: history });
  })
);

// Get all test conversations for a submission
router.get(
  '/:assignmentId/submissions/:submissionId/test-conversations',
  authenticateToken,
  requireInstructor,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const submissionId = parseInt(req.params.submissionId);

    // First get the submission to find the agent config ID
    const submission = await agentAssignmentService.getAgentSubmissionDetail(
      parseInt(req.params.assignmentId),
      submissionId,
      req.user!.id,
      req.user!.isAdmin
    );

    const conversations = await agentAssignmentService.getSubmissionTestConversations(
      submission.agentConfig!.id,
      req.user!.id,
      req.user!.isAdmin
    );
    res.json({ success: true, data: conversations });
  })
);

// Instructor test student's agent
router.post(
  '/:assignmentId/submissions/:submissionId/test',
  authenticateToken,
  requireInstructor,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assignmentId = parseInt(req.params.assignmentId);
    const submissionId = parseInt(req.params.submissionId);

    // Get the submission to find the agent config ID
    const submission = await agentAssignmentService.getAgentSubmissionDetail(
      assignmentId,
      submissionId,
      req.user!.id,
      req.user!.isAdmin
    );

    const context = buildEventContext(req);
    const testerInfo = {
      userId: req.user!.id,
      role: 'instructor' as const,
      fullname: req.user!.fullname,
      email: req.user!.email,
    };

    const result = await agentAssignmentService.startTestConversation(
      assignmentId,
      submission.agentConfig!.id,
      testerInfo,
      context
    );
    res.json({ success: true, data: result });
  })
);

// Instructor send message in test (same endpoint as student, role determined by context)
router.post(
  '/test/:conversationId/message',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const conversationId = parseInt(req.params.conversationId);
    const { message } = agentTestMessageSchema.parse(req.body);
    const context = buildEventContext(req);
    const testerInfo = {
      userId: req.user!.id,
      role: (req.user!.isInstructor ? 'instructor' : 'student') as 'student' | 'instructor',
      fullname: req.user!.fullname,
      email: req.user!.email,
    };

    const result = await agentAssignmentService.sendTestMessage(
      conversationId,
      message,
      testerInfo,
      context
    );
    res.json({ success: true, data: result });
  })
);

// Grade submission
router.post(
  '/submissions/:submissionId/grade',
  authenticateToken,
  requireInstructor,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const submissionId = parseInt(req.params.submissionId);
    const data = gradeAgentSubmissionSchema.parse(req.body);
    const context = buildEventContext(req);

    const submission = await agentAssignmentService.gradeAgentSubmission(
      submissionId,
      req.user!.id,
      data,
      req.user!.isAdmin,
      context
    );
    res.json({ success: true, data: submission });
  })
);

export default router;
