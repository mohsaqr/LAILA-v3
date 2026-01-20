import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { adminAuditService } from './adminAudit.service.js';

export interface BatchEnrollmentRow {
  email: string;
  fullname?: string;
}

export interface AuditContext {
  adminId: number;
  adminEmail?: string;
  ipAddress?: string;
}

export class BatchEnrollmentService {
  async createJob(
    courseId: number,
    fileName: string,
    totalRows: number,
    createdBy: number
  ) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    const job = await prisma.batchEnrollmentJob.create({
      data: {
        courseId,
        createdBy,
        fileName,
        totalRows,
        status: 'pending',
      },
      include: {
        course: {
          select: { id: true, title: true },
        },
        creator: {
          select: { id: true, fullname: true },
        },
      },
    });

    return job;
  }

  async processJob(
    jobId: number,
    rows: BatchEnrollmentRow[],
    context: AuditContext
  ) {
    const job = await prisma.batchEnrollmentJob.findUnique({
      where: { id: jobId },
      include: {
        course: true,
      },
    });

    if (!job) {
      throw new AppError('Batch enrollment job not found', 404);
    }

    // Update job status to processing
    await prisma.batchEnrollmentJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;

      try {
        // Find or create user by email
        let user = await prisma.user.findUnique({
          where: { email: row.email.toLowerCase().trim() },
        });

        if (!user) {
          // Create new user with temporary password
          const tempPassword = this.generateTempPassword();
          user = await prisma.user.create({
            data: {
              email: row.email.toLowerCase().trim(),
              fullname: row.fullname || row.email.split('@')[0],
              passwordHash: await bcrypt.hash(tempPassword, 10),
              isConfirmed: true,
            },
          });
        }

        // Check if already enrolled
        const existingEnrollment = await prisma.enrollment.findUnique({
          where: {
            userId_courseId: { userId: user.id, courseId: job.courseId },
          },
        });

        if (existingEnrollment) {
          // Skip - already enrolled
          await prisma.batchEnrollmentResult.create({
            data: {
              jobId,
              rowNumber,
              email: row.email,
              status: 'skipped',
              userId: user.id,
              enrollmentId: existingEnrollment.id,
              errorMessage: 'User already enrolled',
            },
          });
          continue; // Don't count as success or error
        }

        // Create enrollment
        const enrollment = await prisma.enrollment.create({
          data: {
            userId: user.id,
            courseId: job.courseId,
          },
        });

        // Log successful result
        await prisma.batchEnrollmentResult.create({
          data: {
            jobId,
            rowNumber,
            email: row.email,
            status: 'success',
            userId: user.id,
            enrollmentId: enrollment.id,
          },
        });

        successCount++;
      } catch (error: any) {
        // Log error result
        const errorMessage = error.message || 'Unknown error';
        errors.push(`Row ${rowNumber}: ${errorMessage}`);

        await prisma.batchEnrollmentResult.create({
          data: {
            jobId,
            rowNumber,
            email: row.email,
            status: 'error',
            errorMessage,
          },
        });

        errorCount++;
      }

      // Update progress
      await prisma.batchEnrollmentJob.update({
        where: { id: jobId },
        data: {
          processedRows: i + 1,
          successCount,
          errorCount,
        },
      });
    }

    // Mark job as completed
    const completedJob = await prisma.batchEnrollmentJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        errorLog: errors.length > 0 ? JSON.stringify(errors) : null,
      },
      include: {
        course: {
          select: { id: true, title: true },
        },
        creator: {
          select: { id: true, fullname: true },
        },
      },
    });

    // Create audit log
    await adminAuditService.log({
      adminId: context.adminId,
      adminEmail: context.adminEmail,
      action: 'batch_enrollment',
      targetType: 'batch_enrollment',
      targetId: jobId,
      newValues: {
        courseId: job.courseId,
        courseTitle: job.course.title,
        fileName: job.fileName,
        totalRows: rows.length,
        successCount,
        errorCount,
      },
      ipAddress: context.ipAddress,
    });

    return completedJob;
  }

  async getJobs(
    page = 1,
    limit = 20,
    filters?: {
      courseId?: number;
      createdBy?: number;
      status?: string;
    }
  ) {
    const where: any = {};

    if (filters?.courseId) {
      where.courseId = filters.courseId;
    }
    if (filters?.createdBy) {
      where.createdBy = filters.createdBy;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    const [jobs, total] = await Promise.all([
      prisma.batchEnrollmentJob.findMany({
        where,
        include: {
          course: {
            select: { id: true, title: true },
          },
          creator: {
            select: { id: true, fullname: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.batchEnrollmentJob.count({ where }),
    ]);

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getJobById(id: number) {
    const job = await prisma.batchEnrollmentJob.findUnique({
      where: { id },
      include: {
        course: {
          select: { id: true, title: true },
        },
        creator: {
          select: { id: true, fullname: true },
        },
      },
    });

    if (!job) {
      throw new AppError('Batch enrollment job not found', 404);
    }

    return {
      ...job,
      errorLog: job.errorLog ? JSON.parse(job.errorLog) : null,
    };
  }

  async getJobResults(
    jobId: number,
    page = 1,
    limit = 50,
    status?: string
  ) {
    const job = await prisma.batchEnrollmentJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new AppError('Batch enrollment job not found', 404);
    }

    const where: any = { jobId };
    if (status) {
      where.status = status;
    }

    const [results, total] = await Promise.all([
      prisma.batchEnrollmentResult.findMany({
        where,
        orderBy: { rowNumber: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.batchEnrollmentResult.count({ where }),
    ]);

    return {
      results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async hasAccessToJob(userId: number, jobId: number, isAdmin: boolean) {
    if (isAdmin) return true;

    const job = await prisma.batchEnrollmentJob.findUnique({
      where: { id: jobId },
      include: {
        course: true,
      },
    });

    if (!job) return false;

    // Check if user is the course instructor
    if (job.course.instructorId === userId) return true;

    // Check if user created the job
    if (job.createdBy === userId) return true;

    return false;
  }

  async hasAccessToCourse(userId: number, courseId: number, isAdmin: boolean) {
    if (isAdmin) return true;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) return false;

    // Check if user is the course instructor
    if (course.instructorId === userId) return true;

    // Check if user has manage_students permission via course role
    const courseRole = await prisma.courseRole.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (courseRole) {
      const permissions = courseRole.permissions ? JSON.parse(courseRole.permissions) : [];
      if (permissions.includes('manage_students')) return true;
    }

    return false;
  }

  private generateTempPassword(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // Generate CSV template
  getCSVTemplate(): string {
    return 'email,fullname\nstudent1@example.com,John Doe\nstudent2@example.com,Jane Smith';
  }

  // Parse CSV content
  parseCSV(content: string): BatchEnrollmentRow[] {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      throw new AppError('CSV file must have a header row and at least one data row', 400);
    }

    const header = lines[0].toLowerCase().split(',').map(h => h.trim());
    const emailIndex = header.indexOf('email');

    if (emailIndex === -1) {
      throw new AppError('CSV must have an "email" column', 400);
    }

    const fullnameIndex = header.indexOf('fullname');

    const rows: BatchEnrollmentRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const email = values[emailIndex];

      if (!email || !this.isValidEmail(email)) {
        continue; // Skip invalid rows
      }

      rows.push({
        email,
        fullname: fullnameIndex !== -1 ? values[fullnameIndex] : undefined,
      });
    }

    if (rows.length === 0) {
      throw new AppError('No valid email addresses found in CSV', 400);
    }

    return rows;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export const batchEnrollmentService = new BatchEnrollmentService();
