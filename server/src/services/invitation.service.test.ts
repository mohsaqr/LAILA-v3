import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppError } from '../middleware/error.middleware.js';

// Mock prisma. Invitations are read/written directly, courses are checked for
// existence, and adminAuditLog is written through adminAudit.service.
vi.mock('../utils/prisma.js', () => ({
  default: {
    invitation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      // Prisma exposes field references here; consume() compares use_count to
      // max_uses column-to-column via this descriptor.
      fields: { maxUses: { modelName: 'Invitation', name: 'maxUses', typeName: 'Int' } },
    },
    course: {
      findUnique: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock('../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() })),
}));

import prisma from '../utils/prisma.js';
import {
  InvitationService,
  inviteCodeDigest,
  invitationStatus,
  newInviteCode,
  newInviteToken,
  normalizeInviteCode,
  resetInvitationSecretCache,
  type InvitationRecord,
} from './invitation.service.js';

const SECRET = 'test-session-secret';

/** A usable invitation row; override any field per test. */
const invitationRow = (overrides: Partial<InvitationRecord> = {}): InvitationRecord =>
  ({
    id: 1,
    email: null,
    role: 'student',
    courseId: null,
    token: 'tok_abc',
    codeHint: 'WXYZ',
    invitedById: 99,
    maxUses: 1,
    useCount: 0,
    expiresAt: null,
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }) as InvitationRecord;

const actor = { adminId: 99, adminEmail: 'admin@laila.test', ipAddress: '10.0.0.1' };

describe('InvitationService', () => {
  let service: InvitationService;
  let originalSecret: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = SECRET;
    resetInvitationSecretCache();
    service = new InvitationService();
    vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as any);
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
    resetInvitationSecretCache();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------
  // Code handling — the security-critical part
  // ---------------------------------------------------------------------

  describe('code hashing', () => {
    it('never stores the plaintext code, only its digest and a 4-char hint', async () => {
      vi.mocked(prisma.invitation.create).mockResolvedValue(invitationRow() as any);

      const { code } = await service.create({}, actor);

      const written = vi.mocked(prisma.invitation.create).mock.calls[0][0].data as any;
      const normalized = normalizeInviteCode(code);

      // The code itself appears nowhere in the row that was written.
      expect(JSON.stringify(written)).not.toContain(normalized);
      expect(JSON.stringify(written)).not.toContain(code);

      expect(written.codeDigest).toBe(inviteCodeDigest(code));
      expect(written.codeDigest).not.toBe(code);
      expect(written.codeHint).toBe(normalized.slice(-4));
      expect(written.codeHint).toHaveLength(4);
    });

    it('returns the plaintext code exactly once, from create()', async () => {
      vi.mocked(prisma.invitation.create).mockResolvedValue(invitationRow() as any);

      const { code, invitation } = await service.create({}, actor);

      expect(code).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      // The returned record — the only thing any later read can produce —
      // carries no code and no digest.
      expect(invitation).not.toHaveProperty('codeDigest');
      expect(Object.values(invitation)).not.toContain(code);
    });

    it('normalizes case, spaces and dashes to one digest', () => {
      const canonical = inviteCodeDigest('ABCD-EFGH-JKLM');
      expect(inviteCodeDigest('abcd-efgh-jklm')).toBe(canonical);
      expect(inviteCodeDigest('abcdefghjklm')).toBe(canonical);
      expect(inviteCodeDigest(' AbCd efGH-JKlm ')).toBe(canonical);
    });

    it('keys the digest to SESSION_SECRET, so digests are not portable', () => {
      const withFirst = inviteCodeDigest('ABCD-EFGH-JKLM');

      process.env.SESSION_SECRET = 'a-different-secret';
      resetInvitationSecretCache();

      expect(inviteCodeDigest('ABCD-EFGH-JKLM')).not.toBe(withFirst);
    });

    it('mints codes from an alphabet with no 0/O or 1/I look-alikes', () => {
      const codes = Array.from({ length: 40 }, () => newInviteCode());
      codes.forEach(code => {
        expect(code).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
        expect(code).not.toMatch(/[01OI]/);
      });
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('mints long, unique, URL-safe tokens', () => {
      const tokens = Array.from({ length: 20 }, () => newInviteToken());
      tokens.forEach(token => expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/));
      expect(new Set(tokens).size).toBe(tokens.length);
    });
  });

  // ---------------------------------------------------------------------
  // Status derivation
  // ---------------------------------------------------------------------

  describe('invitationStatus', () => {
    const past = new Date('2020-01-01T00:00:00Z');
    const future = new Date('2099-01-01T00:00:00Z');

    it('reports pending for a fresh, unexpired invitation', () => {
      expect(invitationStatus({ useCount: 0, maxUses: 1, expiresAt: future, revokedAt: null })).toBe('pending');
    });

    it('reports used once the budget is spent', () => {
      expect(invitationStatus({ useCount: 1, maxUses: 1, expiresAt: future, revokedAt: null })).toBe('used');
    });

    it('reports expired for an unused invitation past its date', () => {
      expect(invitationStatus({ useCount: 0, maxUses: 1, expiresAt: past, revokedAt: null })).toBe('expired');
    });

    it('lets revoked outrank both used and expired', () => {
      expect(invitationStatus({ useCount: 1, maxUses: 1, expiresAt: past, revokedAt: past })).toBe('revoked');
    });

    it('lets used outrank expired, so a redeemed invite keeps reading as used', () => {
      expect(invitationStatus({ useCount: 2, maxUses: 2, expiresAt: past, revokedAt: null })).toBe('used');
    });
  });

  // ---------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------

  describe('validateByToken', () => {
    it('rejects an unknown token', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null);
      const result = await service.validateByToken('nope');
      expect(result).toEqual({ valid: false, reason: expect.stringMatching(/not valid/i) });
    });

    it('rejects an expired invitation', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(
        invitationRow({ expiresAt: new Date(Date.now() - 1000) }) as any
      );
      const result = await service.validateByToken('tok_abc');
      expect(result).toMatchObject({ valid: false, reason: expect.stringMatching(/expired/i) });
    });

    it('rejects an invitation whose uses are exhausted', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(
        invitationRow({ maxUses: 3, useCount: 3 }) as any
      );
      const result = await service.validateByToken('tok_abc');
      expect(result).toMatchObject({ valid: false, reason: expect.stringMatching(/already been used/i) });
    });

    it('still accepts a multi-use invitation with budget left', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(
        invitationRow({ maxUses: 3, useCount: 2 }) as any
      );
      expect((await service.validateByToken('tok_abc')).valid).toBe(true);
    });

    it('rejects a revoked invitation', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(
        invitationRow({ revokedAt: new Date() }) as any
      );
      const result = await service.validateByToken('tok_abc');
      expect(result).toMatchObject({ valid: false, reason: expect.stringMatching(/revoked/i) });
    });

    it('rejects an email-bound invitation presented with a different address', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(
        invitationRow({ email: 'invited@uef.fi' }) as any
      );
      const result = await service.validateByToken('tok_abc', 'someone.else@uef.fi');
      expect(result).toMatchObject({ valid: false, reason: expect.stringMatching(/different email/i) });
    });

    it('accepts an email-bound invitation for its own address, case-insensitively', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(
        invitationRow({ email: 'invited@uef.fi' }) as any
      );
      expect((await service.validateByToken('tok_abc', '  Invited@UEF.fi ')).valid).toBe(true);
    });

    it('accepts any address for an open shareable link', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitationRow({ email: null }) as any);
      expect((await service.validateByToken('tok_abc', 'anyone@anywhere.org')).valid).toBe(true);
    });
  });

  describe('validateByCode', () => {
    it('looks the code up by digest, never by plaintext', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitationRow() as any);

      await service.validateByCode('abcd-efgh-jklm');

      expect(prisma.invitation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { codeDigest: inviteCodeDigest('ABCDEFGHJKLM') } })
      );
    });

    it('rejects a wrong-length code without touching the database', async () => {
      const result = await service.validateByCode('ABC');
      expect(result.valid).toBe(false);
      expect(prisma.invitation.findUnique).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // Atomic consumption
  // ---------------------------------------------------------------------

  describe('consume', () => {
    it('checks the limit and increments in ONE conditional update', async () => {
      vi.mocked(prisma.invitation.updateMany).mockResolvedValue({ count: 1 } as any);

      const ok = await service.consume(7);

      expect(ok).toBe(true);
      // No read-then-write: the only statement issued is the update itself.
      expect(prisma.invitation.findUnique).not.toHaveBeenCalled();
      expect(prisma.invitation.updateMany).toHaveBeenCalledTimes(1);

      const call = vi.mocked(prisma.invitation.updateMany).mock.calls[0][0] as any;
      expect(call.where.id).toBe(7);
      expect(call.where.revokedAt).toBeNull();
      // The bound is the row's own max_uses column, compared inside the DB.
      expect(call.where.useCount.lt).toBe(prisma.invitation.fields.maxUses);
      expect(call.data.useCount).toEqual({ increment: 1 });
    });

    it('returns false when the conditional update matched nothing', async () => {
      vi.mocked(prisma.invitation.updateMany).mockResolvedValue({ count: 0 } as any);
      expect(await service.consume(7)).toBe(false);
    });

    it('lets exactly one of two simultaneous redemptions win', async () => {
      // A minimal stand-in for the database's conditional UPDATE: the limit
      // check and the increment happen together, in one indivisible step.
      const row = { id: 7, useCount: 0, maxUses: 1, revokedAt: null as Date | null, expiresAt: null };
      vi.mocked(prisma.invitation.updateMany).mockImplementation((async (args: any) => {
        const bound = args.where.useCount.lt;
        const limit = typeof bound === 'number' ? bound : row.maxUses;
        if (row.revokedAt || row.useCount >= limit) return { count: 0 };
        row.useCount += 1;
        return { count: 1 };
      }) as any);

      const [first, second] = await Promise.all([service.consume(7), service.consume(7)]);

      expect([first, second].filter(Boolean)).toHaveLength(1);
      expect(row.useCount).toBe(1);
    });

    it('runs its update through the supplied transaction client', async () => {
      const tx = { invitation: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };

      expect(await service.consume(7, tx as any)).toBe(true);
      expect(tx.invitation.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.invitation.updateMany).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // Registration entry point
  // ---------------------------------------------------------------------

  describe('resolveForRegistration', () => {
    it('returns null when no invitation was offered', async () => {
      expect(await service.resolveForRegistration({ email: 'a@b.com' })).toBeNull();
    });

    it('rejects a token and a code supplied together', async () => {
      await expect(
        service.resolveForRegistration({ token: 't', code: 'c', email: 'a@b.com' })
      ).rejects.toThrow(/either an invitation link or an invitation code/i);
    });

    it('hard-fails an invalid token instead of falling back to open signup', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null);

      await expect(
        service.resolveForRegistration({ token: 'typo', email: 'a@b.com' })
      ).rejects.toThrow(AppError);
    });

    it('hard-fails an expired invitation', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(
        invitationRow({ expiresAt: new Date(Date.now() - 1000) }) as any
      );

      await expect(
        service.resolveForRegistration({ token: 'tok_abc', email: 'a@b.com' })
      ).rejects.toThrow(/expired/i);
    });

    it('returns the invitation when it is usable', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(
        invitationRow({ role: 'instructor' }) as any
      );

      const invitation = await service.resolveForRegistration({ token: 'tok_abc', email: 'a@b.com' });
      expect(invitation).toMatchObject({ id: 1, role: 'instructor' });
    });
  });

  // ---------------------------------------------------------------------
  // Admin surface
  // ---------------------------------------------------------------------

  describe('create', () => {
    it('refuses to make an email-bound invitation reusable', async () => {
      await expect(service.create({ email: 'one@uef.fi', maxUses: 5 }, actor)).rejects.toThrow(
        /can only be used once/i
      );
      expect(prisma.invitation.create).not.toHaveBeenCalled();
    });

    it('rejects a course that does not exist', async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);
      await expect(service.create({ courseId: 42 }, actor)).rejects.toThrow(/course not found/i);
      expect(prisma.invitation.create).not.toHaveBeenCalled();
    });

    it('audits the creation with the hint but never the token or digest', async () => {
      vi.mocked(prisma.invitation.create).mockResolvedValue(
        invitationRow({ email: 'new@uef.fi', role: 'instructor' }) as any
      );

      await service.create({ email: 'New@UEF.fi', role: 'instructor' }, actor);

      const audited = vi.mocked(prisma.adminAuditLog.create).mock.calls[0][0].data as any;
      expect(audited).toMatchObject({
        action: 'invitation.create',
        targetType: 'invitation',
        targetId: 1,
        adminId: 99,
      });
      expect(audited.newValues).toContain('WXYZ');
      expect(audited.newValues).not.toContain('tok_abc');
    });

    it('lower-cases the target email before storing it', async () => {
      vi.mocked(prisma.invitation.create).mockResolvedValue(invitationRow() as any);
      await service.create({ email: '  New@UEF.fi ' }, actor);
      expect((vi.mocked(prisma.invitation.create).mock.calls[0][0].data as any).email).toBe('new@uef.fi');
    });
  });

  describe('revoke', () => {
    it('stamps revokedAt, keeps the row, and audits', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitationRow() as any);
      vi.mocked(prisma.invitation.update).mockResolvedValue(
        invitationRow({ revokedAt: new Date() }) as any
      );

      await service.revoke(1, actor);

      expect((vi.mocked(prisma.invitation.update).mock.calls[0][0] as any).data.revokedAt).toBeInstanceOf(Date);
      expect(vi.mocked(prisma.adminAuditLog.create).mock.calls[0][0].data).toMatchObject({
        action: 'invitation.revoke',
        targetType: 'invitation',
      });
    });

    it('refuses to revoke twice', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(
        invitationRow({ revokedAt: new Date() }) as any
      );
      await expect(service.revoke(1, actor)).rejects.toThrow(/already revoked/i);
    });

    it('404s an unknown invitation', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null);
      await expect(service.revoke(404, actor)).rejects.toThrow(/not found/i);
    });
  });

  describe('createBulk', () => {
    it('de-duplicates addresses and issues one single-use invite each', async () => {
      vi.mocked(prisma.invitation.create).mockResolvedValue(invitationRow() as any);

      const result = await service.createBulk(['A@uef.fi', 'a@uef.fi', 'b@uef.fi'], {}, actor);

      expect(result.created).toHaveLength(2);
      expect(result.failed).toEqual([]);
      const written = vi.mocked(prisma.invitation.create).mock.calls.map(c => (c[0].data as any).email);
      expect(written).toEqual(['a@uef.fi', 'b@uef.fi']);
      vi.mocked(prisma.invitation.create).mock.calls.forEach(c =>
        expect((c[0].data as any).maxUses).toBe(1)
      );
    });

    it('reports the addresses that failed without aborting the batch', async () => {
      vi.mocked(prisma.invitation.create)
        .mockResolvedValueOnce(invitationRow() as any)
        .mockRejectedValueOnce(new Error('unique violation'))
        .mockResolvedValueOnce(invitationRow() as any);

      const result = await service.createBulk(['a@uef.fi', 'b@uef.fi', 'c@uef.fi'], {}, actor);

      expect(result.created).toHaveLength(2);
      expect(result.failed).toEqual(['b@uef.fi']);
    });
  });

  describe('list', () => {
    it('decorates each row with its derived status', async () => {
      vi.mocked(prisma.invitation.findMany).mockResolvedValue([
        { ...invitationRow({ id: 1 }), invitedBy: { fullname: 'Admin' }, course: null },
        { ...invitationRow({ id: 2, useCount: 1 }), invitedBy: { fullname: 'Admin' }, course: { title: 'Stats' } },
        { ...invitationRow({ id: 3, revokedAt: new Date() }), invitedBy: null, course: null },
      ] as any);

      const rows = await service.list();

      expect(rows.map(r => r.status)).toEqual(['pending', 'used', 'revoked']);
      expect(rows[1].courseTitle).toBe('Stats');
      expect(rows[0].invitedByName).toBe('Admin');
      // The digest is not selected, so it cannot leak through the admin list.
      rows.forEach(r => expect(r).not.toHaveProperty('codeDigest'));
    });

    it('filters to a single status when asked', async () => {
      vi.mocked(prisma.invitation.findMany).mockResolvedValue([
        { ...invitationRow({ id: 1 }), invitedBy: null, course: null },
        { ...invitationRow({ id: 2, useCount: 1 }), invitedBy: null, course: null },
      ] as any);

      const rows = await service.list({ status: 'used' });
      expect(rows.map(r => r.id)).toEqual([2]);
    });
  });
});
