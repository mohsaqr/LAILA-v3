import prisma from '../utils/prisma.js';

export interface AuditLogInput {
  adminId: number;
  adminEmail?: string;
  action: string;
  targetType: 'user' | 'enrollment' | 'course_role' | 'batch_enrollment';
  targetId: number;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
}

export class AdminAuditService {
  async log(input: AuditLogInput) {
    try {
      const log = await prisma.adminAuditLog.create({
        data: {
          adminId: input.adminId,
          adminEmail: input.adminEmail,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          previousValues: input.previousValues ? JSON.stringify(input.previousValues) : null,
          newValues: input.newValues ? JSON.stringify(input.newValues) : null,
          ipAddress: input.ipAddress,
        },
      });
      return log;
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw - audit logging should not break main operations
      return null;
    }
  }

  async getAuditLogs(options: {
    page?: number;
    limit?: number;
    adminId?: number;
    targetType?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const page = options.page || 1;
    const limit = options.limit || 50;

    const where: any = {};

    if (options.adminId) {
      where.adminId = options.adminId;
    }
    if (options.targetType) {
      where.targetType = options.targetType;
    }
    if (options.action) {
      where.action = options.action;
    }
    if (options.startDate || options.endDate) {
      where.timestamp = {};
      if (options.startDate) {
        where.timestamp.gte = options.startDate;
      }
      if (options.endDate) {
        where.timestamp.lte = options.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    // Parse JSON fields
    const parsedLogs = logs.map(log => ({
      ...log,
      previousValues: log.previousValues ? JSON.parse(log.previousValues) : null,
      newValues: log.newValues ? JSON.parse(log.newValues) : null,
    }));

    return {
      logs: parsedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAuditLogById(id: number) {
    const log = await prisma.adminAuditLog.findUnique({
      where: { id },
    });

    if (!log) return null;

    return {
      ...log,
      previousValues: log.previousValues ? JSON.parse(log.previousValues) : null,
      newValues: log.newValues ? JSON.parse(log.newValues) : null,
    };
  }
}

export const adminAuditService = new AdminAuditService();
