import nodemailer from 'nodemailer';
import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const emailLogger = createLogger('email');

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface NotificationPayload {
  userId: number;
  type: 'enrollment' | 'assignment_due' | 'grade_posted' | 'announcement' | 'quiz_result' | 'password_reset';
  data: Record<string, any>;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Check if email is configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      emailLogger.warn('Email service not configured - SMTP credentials missing');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || '587'),
        secure: smtpPort === '465', // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      this.isConfigured = true;
      emailLogger.info('Email service initialized');
    } catch (error) {
      emailLogger.error({ err: error }, 'Failed to initialize email service');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      emailLogger.debug({ to: options.to, subject: options.subject }, 'Email service not configured - skipping send');
      return false;
    }

    try {
      const fromName = process.env.EMAIL_FROM_NAME || 'LAILA LMS';
      const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER;

      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      emailLogger.info({ to: options.to, subject: options.subject }, 'Email sent successfully');
      return true;
    } catch (error) {
      emailLogger.error({ err: error, to: options.to }, 'Failed to send email');
      return false;
    }
  }

  async sendNotification(payload: NotificationPayload): Promise<boolean> {
    try {
      // Get user
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        emailLogger.warn({ userId: payload.userId }, 'User not found for notification');
        return false;
      }

      // Get notification preferences separately
      const prefs = await prisma.notificationPreference.findUnique({
        where: { userId: payload.userId },
      });

      // Check notification preferences
      if (prefs) {
        switch (payload.type) {
          case 'enrollment':
            if (!prefs.emailEnrollment) return false;
            break;
          case 'assignment_due':
            if (!prefs.emailAssignmentDue) return false;
            break;
          case 'grade_posted':
          case 'quiz_result':
            if (!prefs.emailGradePosted) return false;
            break;
          case 'announcement':
            if (!prefs.emailAnnouncement) return false;
            break;
        }
      }

      // Generate email content based on type
      const emailContent = this.generateEmailContent(payload.type, payload.data, user.fullname);

      return await this.sendEmail({
        to: user.email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      });
    } catch (error) {
      emailLogger.error({ err: error, payload }, 'Failed to send notification');
      return false;
    }
  }

  private generateEmailContent(
    type: NotificationPayload['type'],
    data: Record<string, any>,
    userName: string
  ): { subject: string; text: string; html: string } {
    const appName = process.env.APP_NAME || 'LAILA LMS';
    const appUrl = process.env.CLIENT_URL || 'http://localhost:5174';

    switch (type) {
      case 'enrollment':
        return {
          subject: `Enrolled in ${data.courseName}`,
          text: `Hi ${userName},\n\nYou have been enrolled in "${data.courseName}".\n\nVisit ${appUrl}/courses/${data.courseId} to start learning.\n\nBest,\n${appName}`,
          html: this.wrapInTemplate(`
            <h2>Welcome to ${data.courseName}!</h2>
            <p>Hi ${userName},</p>
            <p>You have been enrolled in <strong>${data.courseName}</strong>.</p>
            <p><a href="${appUrl}/courses/${data.courseId}" class="button">Start Learning</a></p>
          `, userName),
        };

      case 'assignment_due':
        return {
          subject: `Assignment Due Soon: ${data.assignmentTitle}`,
          text: `Hi ${userName},\n\nReminder: "${data.assignmentTitle}" in ${data.courseName} is due ${data.dueDate}.\n\nVisit ${appUrl}/courses/${data.courseId}/assignments/${data.assignmentId} to submit your work.\n\nBest,\n${appName}`,
          html: this.wrapInTemplate(`
            <h2>Assignment Due Soon</h2>
            <p>Hi ${userName},</p>
            <p>This is a reminder that <strong>${data.assignmentTitle}</strong> in ${data.courseName} is due <strong>${data.dueDate}</strong>.</p>
            <p><a href="${appUrl}/courses/${data.courseId}/assignments/${data.assignmentId}" class="button">Submit Assignment</a></p>
          `, userName),
        };

      case 'grade_posted':
        return {
          subject: `Grade Posted: ${data.assignmentTitle}`,
          text: `Hi ${userName},\n\nYour grade for "${data.assignmentTitle}" has been posted.\n\nScore: ${data.score}/${data.maxScore} (${data.percentage}%)\n\nVisit ${appUrl}/courses/${data.courseId}/grades to view details.\n\nBest,\n${appName}`,
          html: this.wrapInTemplate(`
            <h2>Grade Posted</h2>
            <p>Hi ${userName},</p>
            <p>Your grade for <strong>${data.assignmentTitle}</strong> has been posted.</p>
            <div class="score-box">
              <p><strong>Score:</strong> ${data.score}/${data.maxScore} (${data.percentage}%)</p>
            </div>
            <p><a href="${appUrl}/courses/${data.courseId}/grades" class="button">View Grades</a></p>
          `, userName),
        };

      case 'quiz_result':
        return {
          subject: `Quiz Result: ${data.quizTitle}`,
          text: `Hi ${userName},\n\nYour quiz "${data.quizTitle}" has been graded.\n\nScore: ${data.score}%\nStatus: ${data.passed ? 'Passed' : 'Not Passed'}\n\nVisit ${appUrl}/course/${data.courseId}/quiz/${data.quizId}/results/${data.attemptId} to view details.\n\nBest,\n${appName}`,
          html: this.wrapInTemplate(`
            <h2>Quiz Result</h2>
            <p>Hi ${userName},</p>
            <p>Your quiz <strong>${data.quizTitle}</strong> has been graded.</p>
            <div class="score-box ${data.passed ? 'passed' : 'failed'}">
              <p><strong>Score:</strong> ${data.score}%</p>
              <p><strong>Status:</strong> ${data.passed ? '✓ Passed' : '✗ Not Passed'}</p>
            </div>
            <p><a href="${appUrl}/course/${data.courseId}/quiz/${data.quizId}/results/${data.attemptId}" class="button">View Details</a></p>
          `, userName),
        };

      case 'announcement':
        return {
          subject: `Announcement: ${data.title}`,
          text: `Hi ${userName},\n\n${data.title}\n\n${data.content}\n\nFrom: ${data.courseName}\n\nBest,\n${appName}`,
          html: this.wrapInTemplate(`
            <h2>${data.title}</h2>
            <p>Hi ${userName},</p>
            <p><em>From: ${data.courseName}</em></p>
            <div class="announcement-content">
              ${data.content}
            </div>
          `, userName),
        };

      case 'password_reset':
        return {
          subject: 'Password Reset Request',
          text: `Hi ${userName},\n\nWe received a request to reset your password.\n\nClick this link to reset your password: ${data.resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.\n\nBest,\n${appName}`,
          html: this.wrapInTemplate(`
            <h2>Password Reset Request</h2>
            <p>Hi ${userName},</p>
            <p>We received a request to reset your password.</p>
            <p><a href="${data.resetUrl}" class="button">Reset Password</a></p>
            <p><small>This link will expire in 1 hour.</small></p>
            <p><small>If you didn't request this, you can safely ignore this email.</small></p>
          `, userName),
        };

      default:
        return {
          subject: 'Notification from LAILA',
          text: `Hi ${userName},\n\nYou have a new notification.\n\nBest,\n${appName}`,
          html: this.wrapInTemplate(`
            <h2>Notification</h2>
            <p>Hi ${userName},</p>
            <p>You have a new notification.</p>
          `, userName),
        };
    }
  }

  private wrapInTemplate(content: string, userName: string): string {
    const appName = process.env.APP_NAME || 'LAILA LMS';
    const appUrl = process.env.CLIENT_URL || 'http://localhost:5174';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      background: white;
      padding: 30px;
      border-radius: 0 0 8px 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white !important;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .score-box {
      background: #f0f9ff;
      border: 1px solid #0ea5e9;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
    .score-box.passed {
      background: #f0fdf4;
      border-color: #22c55e;
    }
    .score-box.failed {
      background: #fef2f2;
      border-color: #ef4444;
    }
    .announcement-content {
      background: #f9fafb;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin: 15px 0;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 12px;
    }
    .footer a {
      color: #667eea;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${appName}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>This email was sent by ${appName}.</p>
      <p><a href="${appUrl}">Visit ${appName}</a></p>
    </div>
  </div>
</body>
</html>
`;
  }

  // Convenience methods
  async sendEnrollmentNotification(userId: number, courseId: number, courseName: string): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: 'enrollment',
      data: { courseId, courseName },
    });
  }

  async sendAssignmentDueNotification(
    userId: number,
    courseId: number,
    courseName: string,
    assignmentId: number,
    assignmentTitle: string,
    dueDate: string
  ): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: 'assignment_due',
      data: { courseId, courseName, assignmentId, assignmentTitle, dueDate },
    });
  }

  async sendGradeNotification(
    userId: number,
    courseId: number,
    assignmentTitle: string,
    score: number,
    maxScore: number
  ): Promise<boolean> {
    const percentage = Math.round((score / maxScore) * 100);
    return this.sendNotification({
      userId,
      type: 'grade_posted',
      data: { courseId, assignmentTitle, score, maxScore, percentage },
    });
  }

  async sendQuizResultNotification(
    userId: number,
    courseId: number,
    quizId: number,
    attemptId: number,
    quizTitle: string,
    score: number,
    passed: boolean
  ): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: 'quiz_result',
      data: { courseId, quizId, attemptId, quizTitle, score: score.toFixed(1), passed },
    });
  }

  async sendAnnouncementNotification(
    userId: number,
    courseName: string,
    title: string,
    content: string
  ): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: 'announcement',
      data: { courseName, title, content },
    });
  }

  async sendPasswordResetEmail(userId: number, resetToken: string): Promise<boolean> {
    const appUrl = process.env.CLIENT_URL || 'http://localhost:5174';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    return this.sendNotification({
      userId,
      type: 'password_reset',
      data: { resetUrl },
    });
  }

  // Bulk notification helpers
  async notifyEnrolledStudents(courseId: number, title: string, content: string): Promise<number> {
    try {
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId, status: 'active' },
        include: {
          user: true,
          course: { select: { title: true } },
        },
      });

      let sentCount = 0;
      for (const enrollment of enrollments) {
        const sent = await this.sendAnnouncementNotification(
          enrollment.userId,
          enrollment.course.title,
          title,
          content
        );
        if (sent) sentCount++;
      }

      emailLogger.info({ courseId, sentCount, total: enrollments.length }, 'Bulk announcement notifications sent');
      return sentCount;
    } catch (error) {
      emailLogger.error({ err: error, courseId }, 'Failed to send bulk notifications');
      return 0;
    }
  }
}

export const emailService = new EmailService();
