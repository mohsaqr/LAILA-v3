import prisma from '../utils/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { createLogger } from '../utils/logger.js';
import { notificationService } from './notification.service.js';
import crypto from 'crypto';

const logger = createLogger('certificate');

export interface CreateCertificateInput {
  userId: number;
  courseId: number;
  templateId?: number;
  metadata?: Record<string, any>;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  templateHtml: string;
  isDefault?: boolean;
}

class CertificateService {
  // =========================================================================
  // CERTIFICATE TEMPLATES
  // =========================================================================

  async getTemplates(isAdmin = false) {
    const templates = await prisma.certificateTemplate.findMany({
      where: isAdmin ? {} : { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { certificates: true } },
      },
    });

    return templates.map(t => ({
      ...t,
      issuedCount: t._count.certificates,
      _count: undefined,
    }));
  }

  async getTemplate(templateId: number) {
    const template = await prisma.certificateTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) throw new AppError('Template not found', 404);
    return template;
  }

  async createTemplate(data: CreateTemplateInput, _isAdmin = false) {
    // Allow instructors and admins to create templates

    // If this is the default template, unset any existing default
    if (data.isDefault) {
      await prisma.certificateTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.certificateTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        templateHtml: data.templateHtml,
        isDefault: data.isDefault ?? false,
      },
    });

    logger.info({ templateId: template.id }, 'Certificate template created');
    return template;
  }

  async updateTemplate(templateId: number, data: Partial<CreateTemplateInput>, _isAdmin = false) {
    // Allow instructors and admins to update templates

    const existing = await prisma.certificateTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existing) throw new AppError('Template not found', 404);

    // If setting as default, unset others
    if (data.isDefault) {
      await prisma.certificateTemplate.updateMany({
        where: { isDefault: true, id: { not: templateId } },
        data: { isDefault: false },
      });
    }

    return prisma.certificateTemplate.update({
      where: { id: templateId },
      data,
    });
  }

  async deleteTemplate(templateId: number, _isAdmin = false) {
    // Allow instructors and admins to delete templates

    const template = await prisma.certificateTemplate.findUnique({
      where: { id: templateId },
      include: { _count: { select: { certificates: true } } },
    });

    if (!template) throw new AppError('Template not found', 404);
    if (template._count.certificates > 0) {
      throw new AppError('Cannot delete template with issued certificates', 400);
    }

    await prisma.certificateTemplate.delete({ where: { id: templateId } });
    logger.info({ templateId }, 'Certificate template deleted');

    return { message: 'Template deleted' };
  }

  // =========================================================================
  // CERTIFICATES
  // =========================================================================

  async getMyCertificates(userId: number) {
    return prisma.certificate.findMany({
      where: { userId },
      include: {
        template: { select: { id: true, name: true } },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  /**
   * Get certificates earned by a user in a specific course
   */
  async getCourseCertificates(courseId: number, userId: number) {
    return prisma.certificate.findMany({
      where: { courseId, userId },
      include: {
        template: { select: { id: true, name: true } },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  /**
   * Get certificate templates available to earn in a course (not yet earned by user)
   */
  async getAvailableCertificates(courseId: number, userId: number) {
    // Get user's existing certificates for this course
    const existingCerts = await prisma.certificate.findMany({
      where: { courseId, userId },
      select: { templateId: true },
    });
    const earnedTemplateIds = existingCerts.map(c => c.templateId);

    // Get active templates that haven't been earned
    const templates = await prisma.certificateTemplate.findMany({
      where: {
        isActive: true,
        id: { notIn: earnedTemplateIds },
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });

    return templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      requirements: 'Complete the course to earn this certificate',
    }));
  }

  /**
   * Get all certificates issued for a course (instructor view)
   */
  async getCourseIssuedCertificates(courseId: number, instructorId: number, isAdmin = false) {
    // Verify instructor owns the course
    if (!isAdmin) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { instructorId: true },
      });
      if (!course || course.instructorId !== instructorId) {
        throw new AppError('Not authorized', 403);
      }
    }

    const certificates = await prisma.certificate.findMany({
      where: { courseId },
      include: {
        template: { select: { id: true, name: true } },
      },
      orderBy: { issueDate: 'desc' },
    });

    // Get user info for certificates
    const userIds = [...new Set(certificates.map(c => c.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullname: true, email: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return certificates.map(cert => ({
      ...cert,
      user: userMap.get(cert.userId),
    }));
  }

  /**
   * Get students eligible to receive a certificate (instructor view)
   */
  async getEligibleStudents(courseId: number, instructorId: number, isAdmin = false) {
    // Verify instructor owns the course
    if (!isAdmin) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { instructorId: true },
      });
      if (!course || course.instructorId !== instructorId) {
        throw new AppError('Not authorized', 403);
      }
    }

    // Get course with modules and lectures
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            lectures: { select: { id: true } },
          },
        },
      },
    });

    if (!course) throw new AppError('Course not found', 404);

    const totalLectures = course.modules.reduce(
      (acc, m) => acc + m.lectures.length,
      0
    );

    // Get enrolled students with their progress
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      include: {
        user: { select: { id: true, fullname: true, email: true } },
        lectureProgress: {
          where: { isCompleted: true },
        },
      },
    });

    // Get existing certificates for this course
    const existingCerts = await prisma.certificate.findMany({
      where: { courseId },
      select: { userId: true },
    });
    const usersWithCerts = new Set(existingCerts.map(c => c.userId));

    return enrollments.map(e => ({
      id: e.user.id,
      fullname: e.user.fullname,
      email: e.user.email,
      completionPercentage: totalLectures > 0
        ? Math.round((e.lectureProgress.length / totalLectures) * 100)
        : 0,
      hasCertificate: usersWithCerts.has(e.user.id),
    }));
  }

  async getCertificate(certificateId: number, userId?: number, isAdmin = false, isInstructor = false) {
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        template: true,
      },
    });

    if (!certificate) throw new AppError('Certificate not found', 404);

    // Check authorization - owner, admin, or course instructor can view
    const isOwner = certificate.userId === userId;

    if (!isAdmin && !isOwner) {
      // Check if user is the course instructor
      if (isInstructor && userId) {
        const course = await prisma.course.findUnique({
          where: { id: certificate.courseId },
          select: { instructorId: true },
        });
        const isCourseInstructor = course?.instructorId === userId;
        if (!isCourseInstructor) {
          throw new AppError('Not authorized', 403);
        }
      } else {
        throw new AppError('Not authorized', 403);
      }
    }

    // Get user and course info for rendering
    const [user, course] = await Promise.all([
      prisma.user.findUnique({
        where: { id: certificate.userId },
        select: { id: true, fullname: true, email: true },
      }),
      prisma.course.findUnique({
        where: { id: certificate.courseId },
        select: {
          id: true,
          title: true,
          instructor: { select: { id: true, fullname: true } },
        },
      }),
    ]);

    return {
      ...certificate,
      user,
      course,
      metadata: certificate.metadata ? JSON.parse(certificate.metadata) : null,
    };
  }

  async verifyCertificate(verificationCode: string) {
    const certificate = await prisma.certificate.findUnique({
      where: { verificationCode },
      include: {
        template: { select: { id: true, name: true } },
      },
    });

    if (!certificate) {
      return { valid: false, message: 'Certificate not found' };
    }

    // Check expiry
    if (certificate.expiryDate && new Date() > certificate.expiryDate) {
      return { valid: false, message: 'Certificate has expired' };
    }

    // Get user and course info
    const [user, course] = await Promise.all([
      prisma.user.findUnique({
        where: { id: certificate.userId },
        select: { fullname: true },
      }),
      prisma.course.findUnique({
        where: { id: certificate.courseId },
        select: { title: true },
      }),
    ]);

    return {
      valid: true,
      certificate: {
        id: certificate.id,
        recipientName: user?.fullname,
        courseName: course?.title,
        issueDate: certificate.issueDate,
        verificationCode: certificate.verificationCode,
      },
    };
  }

  async issueCertificate(data: CreateCertificateInput, isAdmin = false, isInstructor = false) {
    // Verify the user has completed the course
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: data.userId, courseId: data.courseId } },
      include: {
        course: {
          include: {
            modules: {
              include: {
                lectures: { select: { id: true } },
              },
            },
            instructor: { select: { id: true, fullname: true } },
          },
        },
        lectureProgress: {
          where: { isCompleted: true },
        },
      },
    });

    if (!enrollment) {
      throw new AppError('User is not enrolled in this course', 400);
    }

    // Check authorization
    if (!isAdmin && enrollment.course.instructorId !== data.userId && !isInstructor) {
      // Only instructors of the course or admins can issue certificates
      throw new AppError('Not authorized to issue certificates', 403);
    }

    // Check if certificate already exists
    const existing = await prisma.certificate.findUnique({
      where: { userId_courseId: { userId: data.userId, courseId: data.courseId } },
    });

    if (existing) {
      throw new AppError('Certificate already issued for this course', 400);
    }

    // Calculate completion percentage
    const totalLectures = enrollment.course.modules.reduce(
      (acc, m) => acc + m.lectures.length,
      0
    );
    const completedLectures = enrollment.lectureProgress.length;
    const completionPercentage = totalLectures > 0
      ? Math.round((completedLectures / totalLectures) * 100)
      : 0;

    // Get template
    let templateId = data.templateId;
    if (!templateId) {
      const defaultTemplate = await prisma.certificateTemplate.findFirst({
        where: { isDefault: true, isActive: true },
      });
      if (!defaultTemplate) {
        throw new AppError('No certificate template available', 400);
      }
      templateId = defaultTemplate.id;
    }

    // Generate verification code
    const verificationCode = this.generateVerificationCode();

    // Create certificate
    const certificate = await prisma.certificate.create({
      data: {
        userId: data.userId,
        courseId: data.courseId,
        templateId,
        verificationCode,
        metadata: JSON.stringify({
          completionPercentage,
          instructorName: enrollment.course.instructor.fullname,
          courseName: enrollment.course.title,
          ...data.metadata,
        }),
      },
      include: {
        template: { select: { id: true, name: true } },
      },
    });

    logger.info({ certificateId: certificate.id, userId: data.userId, courseId: data.courseId }, 'Certificate issued');

    // Send in-app notification (non-blocking)
    notificationService.notifyCertificateEarned({
      userId: data.userId,
      courseId: data.courseId,
      courseName: enrollment.course.title,
      certificateId: certificate.id,
    }).catch(err => {
      logger.warn({ err, certificateId: certificate.id }, 'Failed to send certificate notification');
    });

    return certificate;
  }

  async revokeCertificate(certificateId: number, isAdmin = false) {
    if (!isAdmin) throw new AppError('Not authorized', 403);

    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
    });

    if (!certificate) throw new AppError('Certificate not found', 404);

    await prisma.certificate.delete({ where: { id: certificateId } });
    logger.info({ certificateId }, 'Certificate revoked');

    return { message: 'Certificate revoked' };
  }

  // =========================================================================
  // RENDER CERTIFICATE
  // =========================================================================

  async renderCertificate(certificateId: number, userId?: number, isAdmin = false, isInstructor = false): Promise<string> {
    const cert = await this.getCertificate(certificateId, userId, isAdmin, isInstructor);

    if (!cert.template) {
      throw new AppError('Certificate template not found', 404);
    }

    // Replace placeholders in template
    let html = cert.template.templateHtml;

    const replacements: Record<string, string> = {
      '{{recipientName}}': cert.user?.fullname || 'Student',
      '{{courseName}}': cert.course?.title || 'Course',
      '{{instructorName}}': cert.course?.instructor?.fullname || 'Instructor',
      '{{issueDate}}': new Date(cert.issueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      '{{verificationCode}}': cert.verificationCode,
      '{{verificationUrl}}': `${process.env.CLIENT_URL || 'http://localhost:5174'}/verify/${cert.verificationCode}`,
      '{{completionPercentage}}': cert.metadata?.completionPercentage?.toString() || '100',
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      html = html.replace(new RegExp(placeholder, 'g'), value);
    }

    return html;
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private generateVerificationCode(): string {
    // Generate a unique, URL-safe verification code with 256 bits of entropy
    return crypto.randomBytes(32).toString('base64url');
  }

  // Create default template if none exists
  async ensureDefaultTemplate() {
    const exists = await prisma.certificateTemplate.findFirst({
      where: { isDefault: true },
    });

    if (!exists) {
      await this.createTemplate({
        name: 'Default Certificate',
        description: 'Standard course completion certificate',
        templateHtml: this.getDefaultTemplateHtml(),
        isDefault: true,
      }, true);
    }
  }

  private getDefaultTemplateHtml(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: landscape; margin: 0; }
    body {
      font-family: 'Georgia', serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px;
      margin: 0;
    }
    .certificate {
      background: white;
      max-width: 900px;
      margin: 0 auto;
      padding: 60px;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      text-align: center;
      position: relative;
    }
    .certificate::before {
      content: '';
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
      bottom: 20px;
      border: 2px solid #667eea;
      border-radius: 8px;
    }
    .header {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: #667eea;
      margin-bottom: 20px;
    }
    .title {
      font-size: 48px;
      color: #1a1a2e;
      margin: 20px 0;
      font-weight: bold;
    }
    .subtitle {
      font-size: 18px;
      color: #666;
      margin-bottom: 30px;
    }
    .recipient {
      font-size: 36px;
      color: #1a1a2e;
      font-style: italic;
      margin: 30px 0;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
      display: inline-block;
    }
    .course-name {
      font-size: 24px;
      color: #333;
      margin: 20px 0;
    }
    .details {
      margin-top: 40px;
      display: flex;
      justify-content: space-around;
      color: #666;
    }
    .detail-item {
      text-align: center;
    }
    .detail-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .detail-value {
      font-size: 16px;
      margin-top: 5px;
      color: #333;
    }
    .verification {
      margin-top: 40px;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">Certificate of Completion</div>
    <div class="title">LAILA LMS</div>
    <div class="subtitle">This is to certify that</div>
    <div class="recipient">{{recipientName}}</div>
    <div class="subtitle">has successfully completed the course</div>
    <div class="course-name">{{courseName}}</div>

    <div class="details">
      <div class="detail-item">
        <div class="detail-label">Date Issued</div>
        <div class="detail-value">{{issueDate}}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Instructor</div>
        <div class="detail-value">{{instructorName}}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Completion</div>
        <div class="detail-value">{{completionPercentage}}%</div>
      </div>
    </div>

    <div class="verification">
      Verification Code: {{verificationCode}}<br>
      Verify at: {{verificationUrl}}
    </div>
  </div>
</body>
</html>
`;
  }
}

export const certificateService = new CertificateService();
