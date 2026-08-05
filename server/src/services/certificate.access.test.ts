import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Who may see a course's certificates.
 *
 * `issueCertificate` already gates on courseRoleService.canGrade, so a TA can
 * award a certificate. The eligibility list, the issued list and the
 * certificate itself were owner-or-admin only, which left that TA able to issue
 * but unable to see who qualified or to open what they had issued.
 *
 * The student side is the part that must not move: a learner sees their own
 * certificate and nothing else.
 */

vi.mock('../utils/prisma.js', () => ({
  default: {
    course: { findUnique: vi.fn() },
    certificate: { findUnique: vi.fn(), findMany: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    assignment: { aggregate: vi.fn() },
    assignmentSubmission: { aggregate: vi.fn() },
    lectureProgress: { findMany: vi.fn() },
  },
}));

vi.mock('./courseRole.service.js', () => ({
  courseRoleService: { isCourseStaff: vi.fn(), canGrade: vi.fn() },
}));

import { certificateService } from './certificate.service.js';
import prismaClient from '../utils/prisma.js';
import { courseRoleService } from './courseRole.service.js';

const prisma = prismaClient as any;

const OWNER = 6;
const TA = 99;
const ADMIN = 7;
const RECIPIENT = 1234;
const OTHER_STUDENT = 555;
const FOREIGN_INSTRUCTOR = 888; // teaches a different course entirely
const COURSE_ID = 3;

const CERTIFICATE = {
  id: 12,
  userId: RECIPIENT,
  courseId: COURSE_ID,
  issueDate: new Date('2026-01-01'),
  verificationCode: 'ABC123',
  metadata: null,
  template: { id: 1, name: 'Default', templateHtml: '<p>{{recipientName}}</p>' },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Faithful to the real helper: admin OR course owner OR team member.
  vi.mocked(courseRoleService.isCourseStaff).mockImplementation(
    async (userId, courseId, isAdmin = false) =>
      Boolean(isAdmin) || userId === OWNER || (courseId === COURSE_ID && userId === TA)
  );
  vi.mocked(courseRoleService.canGrade).mockResolvedValue(true);

  prisma.certificate.findUnique.mockResolvedValue(CERTIFICATE);
  prisma.certificate.findMany.mockResolvedValue([]);
  prisma.course.findUnique.mockResolvedValue({
    id: COURSE_ID,
    title: 'Summer Course',
    instructorId: OWNER,
    instructor: { id: OWNER, fullname: 'Owner' },
    modules: [],
  });
  prisma.user.findMany.mockResolvedValue([]);
  prisma.user.findUnique.mockResolvedValue({ id: RECIPIENT, fullname: 'A Student', email: 's@x.com' });
  prisma.enrollment.findMany.mockResolvedValue([]);
  prisma.assignment.aggregate.mockResolvedValue({ _sum: { points: null } });
  prisma.assignmentSubmission.aggregate.mockResolvedValue({ _sum: { grade: null } });
  prisma.lectureProgress.findMany.mockResolvedValue([]);
});

describe('instructor-facing certificate lists', () => {
  const lists: [string, (u: number, a?: boolean) => Promise<unknown>][] = [
    ['issued certificates', (u, a = false) => certificateService.getCourseIssuedCertificates(COURSE_ID, u, a)],
    ['eligible students', (u, a = false) => certificateService.getEligibleStudents(COURSE_ID, u, a)],
  ];

  describe.each(lists)('%s', (_l, call) => {
    it('open to the course owner', async () => {
      await expect(call(OWNER)).resolves.toBeDefined();
    });
    it('open to an admin', async () => {
      await expect(call(ADMIN, true)).resolves.toBeDefined();
    });
    it('open to a course TA — who may already issue certificates', async () => {
      await expect(call(TA)).resolves.toBeDefined();
    });
    it('refused to an instructor of some other course', async () => {
      await expect(call(FOREIGN_INSTRUCTOR)).rejects.toThrow(/not authorized/i);
    });
    it('refused to a student', async () => {
      await expect(call(OTHER_STUDENT)).rejects.toThrow(/not authorized/i);
    });
  });
});

describe('a single certificate', () => {
  it('is visible to its recipient', async () => {
    await expect(certificateService.getCertificate(12, RECIPIENT)).resolves.toBeDefined();
  });

  it('is visible to the course owner', async () => {
    await expect(certificateService.getCertificate(12, OWNER, false, true)).resolves.toBeDefined();
  });

  it('is visible to a course TA', async () => {
    await expect(certificateService.getCertificate(12, TA, false, false)).resolves.toBeDefined();
  });

  it('is visible to an admin', async () => {
    await expect(certificateService.getCertificate(12, ADMIN, true)).resolves.toBeDefined();
  });

  it('is NOT visible to another student', async () => {
    await expect(certificateService.getCertificate(12, OTHER_STUDENT)).rejects.toThrow(/not authorized/i);
  });

  it('is NOT visible to an instructor of an unrelated course, despite the global flag', async () => {
    // Passing isInstructor=true must not be enough — that flag is true for
    // every instructor on the platform.
    await expect(
      certificateService.getCertificate(12, FOREIGN_INSTRUCTOR, false, true)
    ).rejects.toThrow(/not authorized/i);
  });

  it('is NOT visible to an anonymous caller', async () => {
    await expect(certificateService.getCertificate(12, undefined)).rejects.toThrow(/not authorized/i);
  });

  it('404s for a certificate that does not exist', async () => {
    prisma.certificate.findUnique.mockResolvedValue(null);
    await expect(certificateService.getCertificate(999, ADMIN, true)).rejects.toThrow(/not found/i);
  });
});
