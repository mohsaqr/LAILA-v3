import { Router, Response, Request } from 'express';
import { learningAnalyticsService } from '../services/learningAnalytics.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { AuthRequest } from '../types/index.js';
import { z } from 'zod';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const contentEventSchema = z.object({
  sessionId: z.string().optional(),
  courseId: z.number().optional(),
  moduleId: z.number().optional(),
  lectureId: z.number().optional(),
  sectionId: z.number().optional(),
  eventType: z.enum([
    'lecture_view',
    'video_play',
    'video_pause',
    'video_complete',
    'video_seek',
    'document_download',
    'scroll_depth_update',
    'lecture_complete'
  ]),
  videoPosition: z.number().optional(),
  videoDuration: z.number().optional(),
  videoPercentWatched: z.number().optional(),
  scrollDepthPercent: z.number().optional(),
  timeOnPageSeconds: z.number().optional(),
  documentFileName: z.string().optional(),
  documentFileType: z.string().optional(),
  timestamp: z.number().optional(),
  // Client info
  deviceType: z.string().optional(),
  browserName: z.string().optional(),
  timezone: z.string().optional(),
});

const assessmentEventSchema = z.object({
  sessionId: z.string().optional(),
  courseId: z.number().optional(),
  assignmentId: z.number().optional(),
  submissionId: z.number().optional(),
  eventType: z.enum([
    'assignment_view',
    'assignment_submit',
    'grade_received',
    'feedback_view',
    'assignment_start'
  ]),
  grade: z.number().optional(),
  maxPoints: z.number().optional(),
  previousGrade: z.number().optional(),
  attemptNumber: z.number().optional(),
  timeSpentSeconds: z.number().optional(),
  feedbackLength: z.number().optional(),
  timestamp: z.number().optional(),
  // Client info
  deviceType: z.string().optional(),
  browserName: z.string().optional(),
});

const bulkContentEventsSchema = z.object({
  events: z.array(contentEventSchema),
  // Common client info
  sessionId: z.string().optional(),
  deviceType: z.string().optional(),
  browserName: z.string().optional(),
  timezone: z.string().optional(),
});

// ============================================================================
// HELPERS
// ============================================================================

function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
  }
  return req.socket.remoteAddress;
}

// ============================================================================
// CONTENT EVENT LOGGING
// ============================================================================

// Log a single content event (requires authentication)
router.post('/content-event', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = contentEventSchema.parse(req.body);
  const ipAddress = getClientIp(req);

  const result = await learningAnalyticsService.logContentEvent(
    {
      ...data,
      userId: req.user!.id,
    },
    ipAddress
  );

  res.json({ success: true, data: { id: result.id } });
}));

// Log multiple content events in bulk (requires authentication)
router.post('/content-events', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = bulkContentEventsSchema.parse(req.body);
  const ipAddress = getClientIp(req);

  const results = await Promise.all(
    data.events.map(event =>
      learningAnalyticsService.logContentEvent(
        {
          ...event,
          userId: req.user!.id,
          sessionId: event.sessionId || data.sessionId,
          deviceType: event.deviceType || data.deviceType,
          browserName: event.browserName || data.browserName,
          timezone: event.timezone || data.timezone,
        },
        ipAddress
      )
    )
  );

  res.json({ success: true, data: { logged: results.length } });
}));

// ============================================================================
// ASSESSMENT EVENT LOGGING
// ============================================================================

// Log a single assessment event (requires authentication)
router.post('/assessment-event', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = assessmentEventSchema.parse(req.body);
  const ipAddress = getClientIp(req);

  const result = await learningAnalyticsService.logAssessmentEvent(
    {
      ...data,
      userId: req.user!.id,
    },
    ipAddress
  );

  res.json({ success: true, data: { id: result.id } });
}));

export default router;
