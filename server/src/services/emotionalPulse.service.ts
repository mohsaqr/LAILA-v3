import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { activityLogService } from './activityLog.service.js';

export interface LogPulseInput {
  emotion: string;
  context?: string;
  contextId?: number;
  agentId?: number;
}

export class EmotionalPulseService {
  // Valid emotions
  private readonly validEmotions = [
    'productive',
    'stimulated',
    'frustrated',
    'learning',
    'enjoying',
    'bored',
    'quitting',
  ];

  // Valid contexts
  private readonly validContexts = ['chatbot', 'lesson', 'assignment'];

  // =============================================================================
  // LOG PULSE
  // =============================================================================

  async logPulse(userId: number, data: LogPulseInput) {
    // Validate emotion
    const emotion = data.emotion.toLowerCase();
    if (!this.validEmotions.includes(emotion)) {
      throw new AppError(
        `Invalid emotion. Must be one of: ${this.validEmotions.join(', ')}`,
        400
      );
    }

    // Validate context if provided
    const context = data.context?.toLowerCase() || 'chatbot';
    if (!this.validContexts.includes(context)) {
      throw new AppError(
        `Invalid context. Must be one of: ${this.validContexts.join(', ')}`,
        400
      );
    }

    const pulse = await prisma.emotionalPulse.create({
      data: {
        userId,
        emotion,
        context,
        contextId: data.contextId,
        agentId: data.agentId,
      },
    });

    // Log to unified activity log
    activityLogService.logActivity({
      userId,
      verb: 'expressed',
      objectType: 'emotional_pulse',
      objectId: pulse.id,
      objectTitle: emotion,
      objectSubtype: context,
      extensions: {
        emotion,
        context,
        contextId: data.contextId,
        agentId: data.agentId,
      },
    }).catch(err => console.error('[EmotionalPulse] Failed to log activity:', err));

    return pulse;
  }

  // =============================================================================
  // GET USER HISTORY
  // =============================================================================

  async getMyHistory(
    userId: number,
    options?: {
      context?: string;
      contextId?: number;
      agentId?: number;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { userId };

    if (options?.context) {
      where.context = options.context;
    }
    if (options?.contextId) {
      where.contextId = options.contextId;
    }
    if (options?.agentId) {
      where.agentId = options.agentId;
    }

    const [pulses, total] = await Promise.all([
      prisma.emotionalPulse.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.emotionalPulse.count({ where }),
    ]);

    return {
      pulses,
      total,
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    };
  }

  // =============================================================================
  // COURSE OWNERSHIP VERIFICATION
  // =============================================================================

  private async verifyCourseOwnership(courseId: number, userId: number, isAdmin = false) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (!isAdmin && course.instructorId !== userId) {
      throw new AppError('Not authorized to view emotional pulse stats for this course', 403);
    }
  }

  // =============================================================================
  // GET STATS (Instructor/Admin)
  // =============================================================================

  async getStats(options?: {
    courseId?: number;
    contextId?: number;
    context?: string;
    agentId?: number;
    startDate?: Date;
    endDate?: Date;
  }, userId?: number, isAdmin = false) {
    // If courseId is provided, verify ownership
    if (options?.courseId && userId) {
      await this.verifyCourseOwnership(options.courseId, userId, isAdmin);
    }
    const where: any = {};

    if (options?.context) {
      where.context = options.context;
    }
    if (options?.contextId) {
      where.contextId = options.contextId;
    }
    if (options?.agentId) {
      where.agentId = options.agentId;
    }
    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    // Get total count and count by emotion
    const [total, byEmotion, recentPulses] = await Promise.all([
      prisma.emotionalPulse.count({ where }),
      prisma.emotionalPulse.groupBy({
        by: ['emotion'],
        where,
        _count: { emotion: true },
      }),
      prisma.emotionalPulse.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: {
            select: { id: true, fullname: true },
          },
        },
      }),
    ]);

    // Format emotion counts
    const emotionCounts: Record<string, number> = {};
    this.validEmotions.forEach((e) => (emotionCounts[e] = 0));
    byEmotion.forEach((item) => {
      emotionCounts[item.emotion] = item._count.emotion;
    });

    // Calculate sentiment score (-1 to 1)
    // Positive: productive, stimulated, learning, enjoying
    // Negative: frustrated, bored, quitting
    const positiveCount =
      (emotionCounts.productive || 0) +
      (emotionCounts.stimulated || 0) +
      (emotionCounts.learning || 0) +
      (emotionCounts.enjoying || 0);
    const negativeCount =
      (emotionCounts.frustrated || 0) +
      (emotionCounts.bored || 0) +
      (emotionCounts.quitting || 0);

    const sentimentScore =
      total > 0 ? (positiveCount - negativeCount) / total : 0;

    // Get unique users
    const uniqueUsers = await prisma.emotionalPulse.groupBy({
      by: ['userId'],
      where,
    });

    return {
      total,
      uniqueUsers: uniqueUsers.length,
      emotionCounts,
      sentimentScore: Math.round(sentimentScore * 100) / 100,
      recentPulses: recentPulses.map((p) => ({
        id: p.id,
        emotion: p.emotion,
        context: p.context,
        contextId: p.contextId,
        agentId: p.agentId,
        createdAt: p.createdAt,
        user: p.user,
      })),
    };
  }

  // =============================================================================
  // GET TIMELINE (for charts)
  // =============================================================================

  async getTimeline(options?: {
    context?: string;
    contextId?: number;
    agentId?: number;
    courseId?: number;
    days?: number;
  }, userId?: number, isAdmin = false) {
    // If courseId is provided, verify ownership
    if (options?.courseId && userId) {
      await this.verifyCourseOwnership(options.courseId, userId, isAdmin);
    }
    const days = options?.days || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: any = {
      createdAt: { gte: startDate },
    };

    if (options?.context) {
      where.context = options.context;
    }
    if (options?.contextId) {
      where.contextId = options.contextId;
    }
    if (options?.agentId) {
      where.agentId = options.agentId;
    }

    const pulses = await prisma.emotionalPulse.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        emotion: true,
        createdAt: true,
      },
    });

    // Group by day
    const timeline: Record<string, Record<string, number>> = {};

    pulses.forEach((p) => {
      const day = p.createdAt.toISOString().split('T')[0];
      if (!timeline[day]) {
        timeline[day] = {};
        this.validEmotions.forEach((e) => (timeline[day][e] = 0));
      }
      timeline[day][p.emotion]++;
    });

    return Object.entries(timeline).map(([date, emotions]) => ({
      date,
      ...emotions,
    }));
  }
}

export const emotionalPulseService = new EmotionalPulseService();
