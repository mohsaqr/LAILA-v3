/**
 * What the PUBLIC certificate verifier is allowed to disclose.
 *
 * `GET /api/certificates/verify/:code` has no auth guard, by design — a
 * certificate is worth nothing if a prospective employer cannot check it. But
 * verification codes travel on printed certificates, LinkedIn posts and email
 * signatures, so "anyone holding a code" is effectively "anyone". Whatever this
 * endpoint returns is published.
 *
 * The authenticated `getCertificate` deliberately returns MORE (it gates on the
 * recipient or this course's staff). These tests exist to keep the two from
 * drifting back together: the risk is not that someone rewrites the verifier,
 * it is that someone copies the richer `select` from the function directly
 * above it, which is exactly how the address got in there.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => {
  const noop = () => {};
  return { createLogger: () => ({ error: noop, warn: noop, info: noop, debug: noop }) };
});
vi.mock('./notification.service.js', () => ({ notificationService: { create: vi.fn() } }));
vi.mock('./courseRole.service.js', () => ({
  courseRoleService: { isCourseStaff: vi.fn().mockResolvedValue(false) },
}));

vi.mock('../utils/prisma.js', () => ({
  default: {
    certificate: { findUnique: vi.fn() },
    certificateTemplate: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    assignment: { aggregate: vi.fn() },
    assignmentSubmission: { aggregate: vi.fn() },
  },
}));

import prisma from '../utils/prisma.js';
import { certificateService } from './certificate.service.js';

const HOLDER_EMAIL = 'student@example.edu';

const cert = {
  id: 7,
  userId: 42,
  courseId: 9,
  templateId: 1,
  verificationCode: 'ABC-123',
  issueDate: new Date('2026-01-15T00:00:00Z'),
  expiryDate: null as Date | null,
  template: { id: 1, name: 'Default', templateHtml: '<p>{{studentName}}</p>' },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.certificate.findUnique).mockResolvedValue(cert as never);
  // The mock returns the address even though production no longer asks for it,
  // so the assertions below fail loudly if the `select` is ever widened again.
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: 42,
    fullname: 'A Student',
    email: HOLDER_EMAIL,
    avatarUrl: null,
  } as never);
  vi.mocked(prisma.course.findUnique).mockResolvedValue({
    id: 9,
    title: 'Statistics',
    instructor: { id: 5, fullname: 'A Teacher' },
  } as never);
  vi.mocked(prisma.assignmentSubmission.aggregate).mockResolvedValue({ _sum: { grade: 80 } } as never);
  vi.mocked(prisma.assignment.aggregate).mockResolvedValue({ _sum: { points: 100 } } as never);
});

describe('verifyCertificate — public disclosure surface', () => {
  it('does not ask the database for the holder\'s email address', async () => {
    await certificateService.verifyCertificate('ABC-123');

    const userQuery = vi.mocked(prisma.user.findUnique).mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    // Asserting on the QUERY, not just the response: a narrow select means the
    // address never leaves Postgres, so it cannot leak through a later refactor
    // that spreads the row into the payload.
    expect(userQuery.select).not.toHaveProperty('email');
    expect(userQuery.select.fullname).toBe(true);
  });

  it('never returns the email anywhere in the payload', async () => {
    const result = await certificateService.verifyCertificate('ABC-123');

    // Whole-payload sweep rather than one field: catches the address arriving
    // via some nested include nobody thought about.
    expect(JSON.stringify(result)).not.toContain(HOLDER_EMAIL);
    expect(JSON.stringify(result)).not.toContain('@example.edu');
  });

  it('still returns what verification is actually for', async () => {
    const result = await certificateService.verifyCertificate('ABC-123');

    expect(result.valid).toBe(true);
    expect(result.certificate?.user?.fullname).toBe('A Student');
    expect(result.certificate?.course?.title).toBe('Statistics');
    expect(result.certificate?.course?.instructor?.fullname).toBe('A Teacher');
    expect(result.certificate?.issueDate).toEqual(cert.issueDate);
  });

  it('reports an unknown code as invalid without throwing', async () => {
    vi.mocked(prisma.certificate.findUnique).mockResolvedValue(null as never);

    const result = await certificateService.verifyCertificate('NOPE');

    expect(result.valid).toBe(false);
    expect(result.certificate).toBeUndefined();
  });

  it('does not disclose the holder when the certificate has expired', async () => {
    vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
      ...cert,
      expiryDate: new Date('2020-01-01T00:00:00Z'),
    } as never);

    const result = await certificateService.verifyCertificate('ABC-123');

    expect(result.valid).toBe(false);
    // An expired certificate answers "no" and nothing else — it must not become
    // an oracle for the holder's name or course history.
    expect(JSON.stringify(result)).not.toContain('A Student');
    expect(JSON.stringify(result)).not.toContain('Statistics');
    expect(vi.mocked(prisma.user.findUnique)).not.toHaveBeenCalled();
  });

  it('treats a not-yet-expired certificate as valid', async () => {
    vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
      ...cert,
      expiryDate: new Date(Date.now() + 86_400_000),
    } as never);

    const result = await certificateService.verifyCertificate('ABC-123');

    expect(result.valid).toBe(true);
  });
});
