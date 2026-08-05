import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { adminAuditService } from './adminAudit.service.js';

export interface BatchEnrollmentRow {
  email: string;
  fullname?: string;
  /** 1-based data row as the operator sees it; the header is row 0. */
  rowNumber?: number;
}

/** A row carrying its own course, for the multi-course paste import. */
export interface MultiCourseRow extends BatchEnrollmentRow {
  courseId: number;
}

/**
 * A row the parser could not use.
 *
 * Deliberately NOT called "skipped": a *result* with status `skipped` means a
 * perfectly good row whose user was already enrolled. These are different
 * outcomes and conflating them in one word is how the counts stop adding up.
 */
export interface InvalidRow {
  rowNumber: number;
  email: string;
  reason: string;
}

export interface ParsedCSV<T extends BatchEnrollmentRow = BatchEnrollmentRow> {
  rows: T[];
  invalid: InvalidRow[];
}

export interface AuditContext {
  adminId: number;
  adminEmail?: string;
  ipAddress?: string;
}

export interface ImportActor {
  id: number;
  email?: string;
  isAdmin: boolean;
}

export class BatchEnrollmentService {
  // Upper bound on rows per batch (see parseCSV for the reasoning).
  private static readonly MAX_ROWS = 2000;

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
    context: AuditContext,
    invalid: InvalidRow[] = []
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

    // Unusable rows are recorded before any real work, rather than dropped.
    // parseCSV used to `continue` past them silently, so a 100-address paste
    // with five typos reported "95 rows, 95 successes" and the five bad
    // addresses appeared nowhere — not in the counts, the results table, or
    // the error log. An operator had no way to discover who was left out.
    for (const bad of invalid) {
      await prisma.batchEnrollmentResult.create({
        data: {
          jobId,
          rowNumber: bad.rowNumber,
          email: bad.email,
          status: 'error',
          errorMessage: bad.reason,
        },
      });
      errors.push(`Row ${bad.rowNumber}: ${bad.reason}`);
      errorCount++;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Prefer the parser's line number so the operator can find the row in
      // what they pasted; fall back to position for programmatic callers.
      const rowNumber = row.rowNumber ?? i + 1;

      try {
        // Use transaction for each row to ensure atomic user creation + enrollment
        const result = await prisma.$transaction(async (tx) => {
          // Find or create user by email
          let user = await tx.user.findUnique({
            where: { email: row.email.toLowerCase().trim() },
          });

          if (!user) {
            // Create new user with temporary password
            const tempPassword = this.generateTempPassword();
            user = await tx.user.create({
              data: {
                email: row.email.toLowerCase().trim(),
                fullname: row.fullname || row.email.split('@')[0],
                passwordHash: await bcrypt.hash(tempPassword, 10),
                isConfirmed: true,
              },
            });
          }

          // Check if already enrolled
          const existingEnrollment = await tx.enrollment.findUnique({
            where: {
              userId_courseId: { userId: user.id, courseId: job.courseId },
            },
          });

          if (existingEnrollment) {
            // Skip - already enrolled
            await tx.batchEnrollmentResult.create({
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
            return { status: 'skipped' as const };
          }

          // Create enrollment
          const enrollment = await tx.enrollment.create({
            data: {
              userId: user.id,
              courseId: job.courseId,
            },
          });

          // Log successful result
          await tx.batchEnrollmentResult.create({
            data: {
              jobId,
              rowNumber,
              email: row.email,
              status: 'success',
              userId: user.id,
              enrollmentId: enrollment.id,
            },
          });

          return { status: 'success' as const };
        });

        if (result.status === 'success') {
          successCount++;
        }
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

      // Update progress in batches (every 25 rows) to reduce DB writes
      const PROGRESS_UPDATE_INTERVAL = 25;
      if ((i + 1) % PROGRESS_UPDATE_INTERVAL === 0 || i === rows.length - 1) {
        await prisma.batchEnrollmentJob.update({
          where: { id: jobId },
          data: {
            processedRows: invalid.length + i + 1,
            successCount,
            errorCount,
          },
        });
      }
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
        totalRows: rows.length + invalid.length,
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
    // Use cryptographically secure random bytes for temporary passwords
    return crypto.randomBytes(16).toString('base64url');
  }

  // Generate CSV template
  getCSVTemplate(): string {
    return 'email,fullname\nstudent1@example.com,John Doe\nstudent2@example.com,Jane Smith';
  }

  /** Template for the multi-course paste import. */
  getMultiCourseTemplate(): string {
    return 'email,course_id,fullname\nstudent1@example.com,1,John Doe\nstudent2@example.com,2,Jane Smith';
  }

  /**
   * Split one CSV line, honouring double-quoted fields.
   *
   * A bare `split(',')` corrupts any row holding a quoted name with a comma in
   * it ("Doe, John") by shifting every column after it. In the single-course
   * format that only mangles a name; in the multi-course format the course id
   * silently becomes a fragment of somebody's surname, so the row either fails
   * or — worse — parses as a different course.
   */
  private splitCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch !== '"') {
          current += ch;
        } else if (line[i + 1] === '"') {
          current += '"'; // A doubled quote inside a quoted field is a literal one.
          i++;
        } else {
          inQuotes = false;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        values.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current);
    // trim() also strips the trailing \r of a CRLF file, so Windows exports
    // do not arrive with a carriage return glued to the last column.
    return values.map(v => v.trim());
  }

  /** Shared header handling: row cap, required columns, column positions. */
  private readHeader(content: string, required: string[]) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      throw new AppError('CSV file must have a header row and at least one data row', 400);
    }

    // Cap the batch. Each new row does a bcrypt hash + several queries inside a
    // per-row transaction, all synchronously within the HTTP request; an
    // uncapped multi-MB CSV (100k+ rows) would tie the request up until it
    // times out and the job is stranded in 'processing'.
    if (lines.length - 1 > BatchEnrollmentService.MAX_ROWS) {
      throw new AppError(`CSV exceeds the ${BatchEnrollmentService.MAX_ROWS}-row limit for a single batch`, 400);
    }

    const header = this.splitCsvLine(lines[0]).map(h => h.toLowerCase());
    const missing = required.filter(column => !header.includes(column));
    if (missing.length > 0) {
      throw new AppError(
        `CSV must have ${missing.map(m => `"${m}"`).join(' and ')} column${missing.length > 1 ? 's' : ''}`,
        400
      );
    }

    return { lines, header };
  }

  // Parse CSV content
  parseCSV(content: string): ParsedCSV {
    const { lines, header } = this.readHeader(content, ['email']);
    const emailIndex = header.indexOf('email');
    const fullnameIndex = header.indexOf('fullname');

    const rows: BatchEnrollmentRow[] = [];
    const invalid: InvalidRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue; // Blank line, not a mistake worth reporting.

      const values = this.splitCsvLine(lines[i]);
      const email = values[emailIndex] || '';

      if (!this.collectIfInvalidEmail(email, i, invalid)) continue;

      rows.push({
        email,
        fullname: (fullnameIndex !== -1 ? values[fullnameIndex] : '') || undefined,
        rowNumber: i,
      });
    }

    if (rows.length === 0) {
      throw new AppError('No valid email addresses found in CSV', 400);
    }

    return { rows, invalid };
  }

  /**
   * Parse the `email,course_id[,fullname]` format used by the paste importer,
   * where every row names its own course.
   */
  parseMultiCourseCSV(content: string): ParsedCSV<MultiCourseRow> {
    const { lines, header } = this.readHeader(content, ['email', 'course_id']);
    const emailIndex = header.indexOf('email');
    const courseIndex = header.indexOf('course_id');
    const fullnameIndex = header.indexOf('fullname');

    const rows: MultiCourseRow[] = [];
    const invalid: InvalidRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;

      const values = this.splitCsvLine(lines[i]);
      const email = values[emailIndex] || '';
      const rawCourseId = values[courseIndex] || '';

      if (!this.collectIfInvalidEmail(email, i, invalid)) continue;

      // Strict digits only: parseInt would accept "1.9" and "1abc" as course 1,
      // enrolling somebody into a course the operator never named.
      if (!/^\d+$/.test(rawCourseId)) {
        invalid.push({
          rowNumber: i,
          email,
          reason: rawCourseId ? `"${rawCourseId}" is not a course id` : 'Missing course id',
        });
        continue;
      }

      rows.push({
        email,
        courseId: Number(rawCourseId),
        fullname: (fullnameIndex !== -1 ? values[fullnameIndex] : '') || undefined,
        rowNumber: i,
      });
    }

    if (rows.length === 0) {
      throw new AppError('No valid rows found — every line was missing an email address or a course id', 400);
    }

    return { rows, invalid };
  }

  /** Records an unusable address and returns false; returns true when it is fine. */
  private collectIfInvalidEmail(email: string, rowNumber: number, invalid: InvalidRow[]): boolean {
    if (!email) {
      invalid.push({ rowNumber, email: '', reason: 'Missing email address' });
      return false;
    }
    if (!this.isValidEmail(email)) {
      invalid.push({ rowNumber, email, reason: 'Not a valid email address' });
      return false;
    }
    return true;
  }

  /**
   * Import rows that each name their own course, creating one job per course.
   *
   * `BatchEnrollmentJob` is keyed to a single course, so a multi-course import
   * is N ordinary jobs rather than a new kind of thing — no schema change, and
   * each course keeps its own auditable job and result rows.
   */
  async importMultiCourse(content: string, actor: ImportActor, context: { ipAddress?: string }) {
    const { rows, invalid } = this.parseMultiCourseCSV(content);
    const courseIds = Array.from(new Set(rows.map(row => row.courseId)));

    // Both checks run across every course before anything is written. A partial
    // import is far worse than a refusal here: the operator would be left
    // working out which courses landed and which did not, with users already
    // created and no single job to point at.
    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, title: true },
    });
    const known = new Set(courses.map(course => course.id));
    const unknown = courseIds.filter(id => !known.has(id));
    if (unknown.length > 0) {
      throw new AppError(
        `Unknown course id${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`,
        400
      );
    }

    const permitted = await Promise.all(
      courseIds.map(id => this.hasAccessToCourse(actor.id, id, actor.isAdmin))
    );
    const forbidden = courseIds.filter((_, index) => !permitted[index]);
    if (forbidden.length > 0) {
      throw new AppError(
        `Not authorized to manage enrollments for course${forbidden.length > 1 ? 's' : ''}: ${forbidden.join(', ')}`,
        403
      );
    }

    const titles = new Map(courses.map(course => [course.id, course.title]));
    const jobs = [];

    for (const courseId of courseIds) {
      const courseRows = rows.filter(row => row.courseId === courseId);
      const job = await this.createJob(courseId, 'pasted-import.csv', courseRows.length, actor.id);
      const completed = await this.processJob(job.id, courseRows, {
        adminId: actor.id,
        adminEmail: actor.email,
        ipAddress: context.ipAddress,
      });

      // 'skipped' means already enrolled. It is tracked on the result rows
      // rather than the job, so it has to be counted back out here.
      const alreadyEnrolled = await prisma.batchEnrollmentResult.count({
        where: { jobId: job.id, status: 'skipped' },
      });

      jobs.push({
        jobId: completed.id,
        courseId,
        courseTitle: titles.get(courseId) ?? '',
        totalRows: courseRows.length,
        successCount: completed.successCount,
        errorCount: completed.errorCount,
        alreadyEnrolled,
      });
    }

    // Unusable rows name no course, so they belong to no job — attaching them
    // to an arbitrary one would claim the operator asked for something they
    // did not. They are reported on the response instead.
    return { jobs, invalid };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export const batchEnrollmentService = new BatchEnrollmentService();
