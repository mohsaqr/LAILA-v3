import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticateToken, requireInstructor } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { emailService } from '../services/email.service.js';
import { notificationService } from '../services/notification.service.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const updatePreferencesSchema = z.object({
  // Email preferences
  emailEnrollment: z.boolean().optional(),
  emailAssignmentDue: z.boolean().optional(),
  emailGradePosted: z.boolean().optional(),
  emailAnnouncement: z.boolean().optional(),
  emailForumReply: z.boolean().optional(),
  emailCertificate: z.boolean().optional(),
  emailDigestFrequency: z.enum(['none', 'daily', 'weekly']).optional(),
  // In-app preferences
  inAppEnabled: z.boolean().optional(),
  inAppGradePosted: z.boolean().optional(),
  inAppDeadline: z.boolean().optional(),
  inAppAnnouncement: z.boolean().optional(),
  inAppForumReply: z.boolean().optional(),
  inAppCertificate: z.boolean().optional(),
});

const sendAnnouncementSchema = z.object({
  courseId: z.number().positive(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
});

const getNotificationsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
  unreadOnly: z.coerce.boolean().optional().default(false),
});

// =========================================================================
// USER NOTIFICATIONS
// =========================================================================

// Get user's notifications (paginated)
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const { limit, offset, unreadOnly } = getNotificationsSchema.parse(req.query);

  const result = await notificationService.getForUser(user.id, { limit, offset, unreadOnly });

  res.json({
    success: true,
    data: result.notifications,
    pagination: {
      total: result.total,
      limit,
      offset,
      hasMore: result.hasMore,
    },
    unreadCount: result.unreadCount,
  });
}));

// Get unread count only (for badge)
router.get('/unread-count', authenticateToken, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const count = await notificationService.getUnreadCount(user.id);

  res.json({ success: true, count });
}));

// Mark single notification as read
router.post('/:id/read', authenticateToken, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const notificationId = parseInt(req.params.id, 10);

  if (isNaN(notificationId)) {
    return res.status(400).json({ success: false, error: 'Invalid notification ID' });
  }

  const success = await notificationService.markAsRead(user.id, notificationId);

  if (!success) {
    return res.status(404).json({ success: false, error: 'Notification not found' });
  }

  res.json({ success: true });
}));

// Mark all notifications as read
router.post('/read-all', authenticateToken, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const count = await notificationService.markAllAsRead(user.id);

  res.json({ success: true, count });
}));

// =========================================================================
// USER NOTIFICATION PREFERENCES
// =========================================================================

// Get notification preferences
router.get('/preferences', authenticateToken, asyncHandler(async (req, res) => {
  const user = (req as any).user;

  let preferences = await prisma.notificationPreference.findUnique({
    where: { userId: user.id },
  });

  // Create default preferences if none exist
  if (!preferences) {
    preferences = await prisma.notificationPreference.create({
      data: {
        userId: user.id,
      },
    });
  }

  res.json({ success: true, data: preferences });
}));

// Update notification preferences
router.put('/preferences', authenticateToken, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const data = updatePreferencesSchema.parse(req.body);

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      ...data,
    },
    update: data,
  });

  res.json({ success: true, data: preferences });
}));

// =========================================================================
// INSTRUCTOR ANNOUNCEMENT ROUTES
// =========================================================================

// Send announcement to all enrolled students
router.post('/announce', authenticateToken, requireInstructor, asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const { courseId, title, content } = sendAnnouncementSchema.parse(req.body);

  // Verify instructor owns the course or is admin
  const course = await prisma.course.findUnique({
    where: { id: courseId },
  });

  if (!course) {
    return res.status(404).json({ success: false, error: 'Course not found' });
  }

  if (course.instructorId !== user.id && !user.isAdmin) {
    return res.status(403).json({ success: false, error: 'Not authorized to send announcements for this course' });
  }

  // Send email announcements
  const sentCount = await emailService.notifyEnrolledStudents(courseId, title, content);

  // Also create in-app notifications for enrolled students
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    select: { userId: true },
  });

  // Create in-app notifications (non-blocking)
  Promise.all(
    enrollments.map(e =>
      notificationService.notifyAnnouncement({
        userId: e.userId,
        courseId,
        courseName: course.title,
        announcementTitle: title,
      })
    )
  ).catch(err => {
    console.error('Failed to create announcement notifications:', err);
  });

  res.json({
    success: true,
    message: `Announcement sent to ${sentCount} students`,
    sentCount,
  });
}));

// =========================================================================
// TEST ROUTES (development only)
// =========================================================================

if (process.env.NODE_ENV !== 'production') {
  // Test email sending
  router.post('/test', authenticateToken, asyncHandler(async (req, res) => {
    const user = (req as any).user;

    const sent = await emailService.sendEmail({
      to: user.email,
      subject: 'Test Email from LAILA LMS',
      text: 'This is a test email to verify your email configuration is working correctly.',
      html: '<h1>Test Email</h1><p>This is a test email to verify your email configuration is working correctly.</p>',
    });

    res.json({
      success: true,
      message: sent ? 'Test email sent successfully' : 'Email service not configured',
      emailSent: sent,
    });
  }));

  // Create test notification
  router.post('/test-notification', authenticateToken, asyncHandler(async (req, res) => {
    const user = (req as any).user;

    const result = await notificationService.create({
      userId: user.id,
      type: 'announcement',
      title: 'Test Notification',
      message: 'This is a test notification to verify the notification system is working.',
      link: '/settings',
    });

    res.json({
      success: true,
      message: result ? 'Test notification created' : 'Notification creation skipped (preferences)',
      notificationId: result?.id,
    });
  }));
}

export default router;
