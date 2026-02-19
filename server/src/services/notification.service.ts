import prisma from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { emailService } from './email.service.js';
import { emitToUser } from '../utils/socket.js';

const logger = createLogger('notification');

export type NotificationType =
  | 'grade_posted'
  | 'deadline_approaching'
  | 'announcement'
  | 'forum_reply'
  | 'enrollment'
  | 'certificate';

export interface CreateNotificationInput {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  data?: Record<string, any>;
}

export interface GetNotificationsOptions {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

interface NotifyGradePostedInput {
  userId: number;
  courseId: number;
  courseName: string;
  assignmentTitle: string;
  score: number;
  maxScore: number;
}

interface NotifyDeadlineApproachingInput {
  userId: number;
  courseId: number;
  assignmentId: number;
  assignmentTitle: string;
  hoursRemaining: number;
}

interface NotifyForumReplyInput {
  userId: number;
  courseId: number;
  forumId: number;
  threadId: number;
  threadTitle: string;
  replierName: string;
}

interface NotifyCertificateEarnedInput {
  userId: number;
  courseId: number;
  courseName: string;
  certificateId: number;
}

interface NotifyAnnouncementInput {
  userId: number;
  courseId: number;
  courseName: string;
  announcementTitle: string;
  announcementId?: number;
}

interface NotifyEnrollmentInput {
  userId: number;
  courseId: number;
  courseName: string;
}

class NotificationService {
  // =========================================================================
  // CORE CRUD OPERATIONS
  // =========================================================================

  /**
   * Create a notification for a user
   * Checks preferences before creating, optionally sends email
   */
  async create(input: CreateNotificationInput): Promise<{ id: number } | null> {
    try {
      // Get user preferences
      const prefs = await prisma.notificationPreference.findUnique({
        where: { userId: input.userId },
      });

      // Check if in-app notifications are enabled for this type
      if (prefs) {
        if (!prefs.inAppEnabled) {
          logger.debug({ userId: input.userId, type: input.type }, 'In-app notifications disabled for user');
          return null;
        }

        // Check specific type preference
        const typeEnabled = this.isTypeEnabled(input.type, prefs);
        if (!typeEnabled) {
          logger.debug({ userId: input.userId, type: input.type }, 'Notification type disabled for user');
          return null;
        }
      }

      // Create the notification
      const notification = await prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          link: input.link,
          data: input.data ? JSON.stringify(input.data) : null,
        },
      });

      logger.info({ notificationId: notification.id, userId: input.userId, type: input.type }, 'Notification created');

      // Emit real-time notification to connected user
      emitToUser(input.userId, 'notification:new', {
        id: notification.id,
        type: input.type,
        title: input.title,
        message: input.message,
      });

      return { id: notification.id };
    } catch (error) {
      logger.error({ err: error, input }, 'Failed to create notification');
      return null;
    }
  }

  /**
   * Get notifications for a user with pagination
   */
  async getForUser(userId: number, options: GetNotificationsOptions = {}) {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId,
          ...(unreadOnly ? { isRead: false } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({
        where: {
          userId,
          ...(unreadOnly ? { isRead: false } : {}),
        },
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      notifications: notifications.map(n => ({
        ...n,
        data: n.data ? JSON.parse(n.data) : null,
      })),
      total,
      unreadCount,
      hasMore: offset + notifications.length < total,
    };
  }

  /**
   * Get unread count for badge display
   */
  async getUnreadCount(userId: number): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId: number, notificationId: number): Promise<boolean> {
    try {
      const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId },
      });

      if (!notification) {
        return false;
      }

      if (notification.isRead) {
        return true; // Already read
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true, readAt: new Date() },
      });

      return true;
    } catch (error) {
      logger.error({ err: error, userId, notificationId }, 'Failed to mark notification as read');
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number): Promise<number> {
    try {
      const result = await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });

      logger.info({ userId, count: result.count }, 'Marked all notifications as read');
      return result.count;
    } catch (error) {
      logger.error({ err: error, userId }, 'Failed to mark all notifications as read');
      return 0;
    }
  }

  /**
   * Delete old notifications (cleanup job)
   */
  async deleteOldNotifications(daysOld: number = 90): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        isRead: true, // Only delete read notifications
      },
    });

    logger.info({ count: result.count, daysOld }, 'Deleted old notifications');
    return result.count;
  }

  // =========================================================================
  // CONVENIENCE METHODS
  // =========================================================================

  /**
   * Notify a student about a graded assignment
   */
  async notifyGradePosted(input: NotifyGradePostedInput): Promise<void> {
    const percentage = Math.round((input.score / input.maxScore) * 100);

    await this.create({
      userId: input.userId,
      type: 'grade_posted',
      title: 'Grade Posted',
      message: `Your grade for "${input.assignmentTitle}" in ${input.courseName} has been posted: ${input.score}/${input.maxScore} (${percentage}%)`,
      link: `/courses/${input.courseId}/grades`,
      data: {
        courseId: input.courseId,
        courseName: input.courseName,
        assignmentTitle: input.assignmentTitle,
        score: input.score,
        maxScore: input.maxScore,
        percentage,
      },
    });
  }

  /**
   * Notify a student about an approaching deadline
   */
  async notifyDeadlineApproaching(input: NotifyDeadlineApproachingInput): Promise<void> {
    const timeText = input.hoursRemaining <= 24
      ? `${input.hoursRemaining} hours`
      : `${Math.ceil(input.hoursRemaining / 24)} days`;

    await this.create({
      userId: input.userId,
      type: 'deadline_approaching',
      title: 'Deadline Approaching',
      message: `"${input.assignmentTitle}" is due in ${timeText}`,
      link: `/courses/${input.courseId}/assignments/${input.assignmentId}`,
      data: {
        courseId: input.courseId,
        assignmentId: input.assignmentId,
        assignmentTitle: input.assignmentTitle,
        hoursRemaining: input.hoursRemaining,
      },
    });
  }

  /**
   * Notify a user about a reply to their forum thread or post
   */
  async notifyForumReply(input: NotifyForumReplyInput): Promise<void> {
    await this.create({
      userId: input.userId,
      type: 'forum_reply',
      title: 'New Forum Reply',
      message: `${input.replierName} replied to your thread "${input.threadTitle}"`,
      link: `/courses/${input.courseId}/forum/${input.forumId}/thread/${input.threadId}`,
      data: {
        courseId: input.courseId,
        forumId: input.forumId,
        threadId: input.threadId,
        threadTitle: input.threadTitle,
        replierName: input.replierName,
      },
    });
  }

  /**
   * Notify a student about earning a certificate
   */
  async notifyCertificateEarned(input: NotifyCertificateEarnedInput): Promise<void> {
    await this.create({
      userId: input.userId,
      type: 'certificate',
      title: 'Certificate Earned!',
      message: `Congratulations! You've earned a certificate for completing "${input.courseName}"`,
      link: `/certificates/${input.certificateId}`,
      data: {
        courseId: input.courseId,
        courseName: input.courseName,
        certificateId: input.certificateId,
      },
    });
  }

  /**
   * Notify a student about a course announcement
   */
  async notifyAnnouncement(input: NotifyAnnouncementInput): Promise<void> {
    await this.create({
      userId: input.userId,
      type: 'announcement',
      title: 'New Announcement',
      message: `New announcement in ${input.courseName}: "${input.announcementTitle}"`,
      link: `/courses/${input.courseId}/announcements`,
      data: {
        courseId: input.courseId,
        courseName: input.courseName,
        announcementTitle: input.announcementTitle,
        announcementId: input.announcementId,
      },
    });
  }

  /**
   * Notify a student about enrollment in a course
   */
  async notifyEnrollment(input: NotifyEnrollmentInput): Promise<void> {
    await this.create({
      userId: input.userId,
      type: 'enrollment',
      title: 'Enrolled in Course',
      message: `You have been enrolled in "${input.courseName}"`,
      link: `/courses/${input.courseId}`,
      data: {
        courseId: input.courseId,
        courseName: input.courseName,
      },
    });
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private isTypeEnabled(type: NotificationType, prefs: {
    inAppGradePosted: boolean;
    inAppDeadline: boolean;
    inAppAnnouncement: boolean;
    inAppForumReply: boolean;
    inAppCertificate: boolean;
  }): boolean {
    switch (type) {
      case 'grade_posted':
        return prefs.inAppGradePosted;
      case 'deadline_approaching':
        return prefs.inAppDeadline;
      case 'announcement':
        return prefs.inAppAnnouncement;
      case 'forum_reply':
        return prefs.inAppForumReply;
      case 'certificate':
        return prefs.inAppCertificate;
      case 'enrollment':
        return true; // Always enabled for enrollment
      default:
        return true;
    }
  }
}

export const notificationService = new NotificationService();
