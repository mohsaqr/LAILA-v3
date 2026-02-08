import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticateToken, requireInstructor } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { emailService } from '../services/email.service.js';
import { z } from 'zod';

const router = Router();

// Validation schemas - using actual field names from schema
const updatePreferencesSchema = z.object({
  emailEnrollment: z.boolean().optional(),
  emailAssignmentDue: z.boolean().optional(),
  emailGradePosted: z.boolean().optional(),
  emailAnnouncement: z.boolean().optional(),
});

const sendAnnouncementSchema = z.object({
  courseId: z.number().positive(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
});

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
        emailEnrollment: true,
        emailAssignmentDue: true,
        emailGradePosted: true,
        emailAnnouncement: true,
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
      emailEnrollment: data.emailEnrollment ?? true,
      emailAssignmentDue: data.emailAssignmentDue ?? true,
      emailGradePosted: data.emailGradePosted ?? true,
      emailAnnouncement: data.emailAnnouncement ?? true,
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

  // Send announcements
  const sentCount = await emailService.notifyEnrolledStudents(courseId, title, content);

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
}

export default router;
