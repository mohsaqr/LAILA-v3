import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth.service.js';
import { AppError } from '../middleware/error.middleware.js';

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn(),
  },
}));

// Mock prisma
vi.mock('../utils/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      // register() clears a stale unverified row before re-creating it.
      delete: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    userSetting: {
      findUnique: vi.fn(),
    },
    verificationCode: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    // register() consults the registration policy, which is stored here.
    systemSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    // An invited signup resolves + consumes an invitation and may enrol the
    // new account, all inside one $transaction.
    invitation: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      fields: { maxUses: { modelName: 'Invitation', name: 'maxUses', typeName: 'Int' } },
    },
    enrollment: {
      create: vi.fn(),
    },
    // A signup carrying a course code resolves it GLOBALLY, code -> course,
    // which is why courses.activation_code is unique.
    course: {
      findUnique: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock auth middleware
vi.mock('../middleware/auth.middleware.js', () => ({
  generateToken: vi.fn().mockReturnValue('mock_jwt_token'),
  invalidateUserStatusCache: vi.fn(),
}));

// Mock learning analytics (fire and forget)
vi.mock('./learningAnalytics.service.js', () => ({
  learningAnalyticsService: {
    logAuthEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  authLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock email service
vi.mock('./email.service.js', () => ({
  emailService: {
    sendVerificationCode: vi.fn().mockResolvedValue(true),
  },
  VERIFICATION_CODE_TTL_MS: 10 * 60 * 1000,
}));

import prisma from '../utils/prisma.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth.middleware.js';
import { resetInvitationSecretCache } from './invitation.service.js';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();
    // No stored registration policy -> the defaults, i.e. open registration
    // with an emailed code, which is what these tests assert.
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue(null);
    // Run transaction callbacks against the same mocked client.
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: any) => fn(prisma)) as any);
    process.env.SESSION_SECRET = 'test-session-secret';
    resetInvitationSecretCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    const validRegistration = {
      fullname: 'Test User',
      email: 'test@example.com',
      password: 'StrongPass123!',
    };

    it('should successfully register a new user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 1,
        fullname: 'Test User',
        email: 'test@example.com',
        isAdmin: false,
        isInstructor: false,
        tokenVersion: 0,
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.verificationCode.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.verificationCode.create).mockResolvedValue({} as any);

      const result = await authService.register(validRegistration);

      expect(result.email).toBe('test@example.com');
      expect(result.message).toBe('Verification code sent');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.verificationCode.create).toHaveBeenCalled();
    });

    it('should throw error if verified email already exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        isConfirmed: true,
      } as any);

      await expect(authService.register(validRegistration)).rejects.toThrow(AppError);
      await expect(authService.register(validRegistration)).rejects.toThrow('Email already registered');
    });

    it('should hash the password before storing', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 1,
        fullname: 'Test User',
        email: 'test@example.com',
        isAdmin: false,
        isInstructor: false,
        tokenVersion: 0,
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.verificationCode.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.verificationCode.create).mockResolvedValue({} as any);

      await authService.register(validRegistration);

      expect(bcrypt.hash).toHaveBeenCalledWith('StrongPass123!', 10);
    });

    it('should still register user when registration logging fails', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 1,
        fullname: 'Test User',
        email: 'test@example.com',
        isAdmin: false,
        isInstructor: false,
        tokenVersion: 0,
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.verificationCode.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.verificationCode.create).mockResolvedValue({} as any);
      vi.mocked(learningAnalyticsService.logAuthEvent).mockRejectedValueOnce(new Error('Log failed'));

      const result = await authService.register(validRegistration);

      expect(result.email).toBe('test@example.com');
      expect(result.message).toBe('Verification code sent');
    });

    // The registration policy gate (services/registrationPolicy.service.ts).
    it('should refuse to register when the policy is closed', async () => {
      vi.mocked(prisma.systemSetting.findUnique).mockImplementation((async (args: any) =>
        args.where.settingKey === 'registration.mode'
          ? { settingKey: 'registration.mode', settingValue: 'closed' }
          : null) as any);

      await expect(authService.register(validRegistration)).rejects.toThrow(/closed/i);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should refuse to register an email outside the allowed domains', async () => {
      vi.mocked(prisma.systemSetting.findUnique).mockImplementation((async (args: any) =>
        args.where.settingKey === 'registration.allowedEmailDomains'
          ? { settingKey: 'registration.allowedEmailDomains', settingValue: '["uef.fi"]' }
          : null) as any);

      await expect(authService.register(validRegistration)).rejects.toThrow(/approved email domains/i);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should skip the verification code when the policy waives verification', async () => {
      vi.mocked(prisma.systemSetting.findUnique).mockImplementation((async (args: any) =>
        args.where.settingKey === 'registration.emailVerification'
          ? { settingKey: 'registration.emailVerification', settingValue: 'false' }
          : null) as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 1,
        fullname: 'Test User',
        email: 'test@example.com',
        isAdmin: false,
        isInstructor: false,
        tokenVersion: 0,
        createdAt: new Date(),
      } as any);

      const result = await authService.register(validRegistration);

      expect(result.verificationRequired).toBe(false);
      expect(prisma.verificationCode.create).not.toHaveBeenCalled();
      expect(vi.mocked(prisma.user.create).mock.calls[0][0]).toMatchObject({
        data: { isConfirmed: true, isInstructor: false },
      });
    });

    it('should grant the configured default role', async () => {
      vi.mocked(prisma.systemSetting.findUnique).mockImplementation((async (args: any) =>
        args.where.settingKey === 'registration.defaultRole'
          ? { settingKey: 'registration.defaultRole', settingValue: 'instructor' }
          : null) as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 1,
        fullname: 'Test User',
        email: 'test@example.com',
        isAdmin: false,
        isInstructor: true,
        tokenVersion: 0,
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.verificationCode.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.verificationCode.create).mockResolvedValue({} as any);

      await authService.register(validRegistration);

      expect(vi.mocked(prisma.user.create).mock.calls[0][0]).toMatchObject({
        data: { isInstructor: true },
      });
    });
  });

  // ===========================================================================
  // Invited registration (services/invitation.service.ts)
  // ===========================================================================

  describe('register with an invitation', () => {
    const validRegistration = {
      fullname: 'Test User',
      email: 'test@example.com',
      password: 'StrongPass123!',
    };

    /** A usable invitation row as invitation.service selects it. */
    const invitation = (overrides: Record<string, unknown> = {}) => ({
      id: 5,
      email: null,
      role: 'student',
      courseId: null,
      token: 'tok_abc',
      codeHint: 'WXYZ',
      invitedById: 1,
      maxUses: 1,
      useCount: 0,
      expiresAt: null,
      acceptedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      ...overrides,
    });

    const createdUser = (overrides: Record<string, unknown> = {}) => ({
      id: 1,
      fullname: 'Test User',
      email: 'test@example.com',
      isAdmin: false,
      isInstructor: false,
      tokenVersion: 0,
      createdAt: new Date(),
      ...overrides,
    });

    /** Put the platform in invite_only mode. */
    const inviteOnlyPolicy = () => {
      vi.mocked(prisma.systemSetting.findUnique).mockImplementation((async (args: any) =>
        args.where.settingKey === 'registration.mode'
          ? { settingKey: 'registration.mode', settingValue: 'invite_only' }
          : null) as any);
    };

    beforeEach(() => {
      vi.mocked(prisma.verificationCode.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.verificationCode.create).mockResolvedValue({} as any);
      vi.mocked(prisma.invitation.updateMany).mockResolvedValue({ count: 1 } as any);
    });

    it('lets a valid invitation through an invite_only platform', async () => {
      inviteOnlyPolicy();
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitation() as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(createdUser() as any);

      const result = await authService.register({ ...validRegistration, inviteToken: 'tok_abc' });

      expect(result.email).toBe('test@example.com');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('hard-fails an invalid token instead of falling back to open signup', async () => {
      // Platform is OPEN, so a silent fallback would succeed — and that is
      // exactly the bug this asserts against.
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null);

      await expect(
        authService.register({ ...validRegistration, inviteToken: 'typo' })
      ).rejects.toThrow(AppError);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hard-fails an expired invitation', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(
        invitation({ expiresAt: new Date(Date.now() - 1000) }) as any
      );

      await expect(
        authService.register({ ...validRegistration, inviteToken: 'tok_abc' })
      ).rejects.toThrow(/expired/i);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hard-fails an invitation issued to a different email address', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(
        invitation({ email: 'someone.else@example.com' }) as any
      );

      await expect(
        authService.register({ ...validRegistration, inviteToken: 'tok_abc' })
      ).rejects.toThrow(/different email/i);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects a token and a code supplied together', async () => {
      await expect(
        authService.register({ ...validRegistration, inviteToken: 't', inviteCode: 'c' })
      ).rejects.toThrow(/not both/i);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('takes the new account role from the invitation, not from the client', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(
        invitation({ role: 'instructor' }) as any
      );
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(createdUser({ isInstructor: true }) as any);

      // The client asks for admin; only the invitation's role is consulted.
      await authService.register({
        ...validRegistration,
        inviteToken: 'tok_abc',
        role: 'admin',
      } as any);

      const written = (vi.mocked(prisma.user.create).mock.calls[0][0] as any).data;
      expect(written.isInstructor).toBe(true);
      expect(written).not.toHaveProperty('isAdmin');
      expect(written).not.toHaveProperty('role');
    });

    it('bypasses the domain allow-list for an invited account', async () => {
      vi.mocked(prisma.systemSetting.findUnique).mockImplementation((async (args: any) =>
        args.where.settingKey === 'registration.allowedEmailDomains'
          ? { settingKey: 'registration.allowedEmailDomains', settingValue: '["uef.fi"]' }
          : null) as any);
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitation() as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(createdUser() as any);

      await authService.register({ ...validRegistration, inviteToken: 'tok_abc' });

      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('skips the approval queue — an invitation is the approval', async () => {
      vi.mocked(prisma.systemSetting.findUnique).mockImplementation((async (args: any) =>
        args.where.settingKey === 'registration.mode'
          ? { settingKey: 'registration.mode', settingValue: 'approval' }
          : null) as any);
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitation() as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(createdUser() as any);

      const result = await authService.register({ ...validRegistration, inviteToken: 'tok_abc' });

      expect(result.approvalRequired).toBe(false);
      expect((vi.mocked(prisma.user.create).mock.calls[0][0] as any).data.status).toBe('active');
    });

    it('consumes the invitation and creates the user in one transaction', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitation() as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(createdUser() as any);

      await authService.register({ ...validRegistration, inviteToken: 'tok_abc' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.invitation.updateMany).toHaveBeenCalledTimes(1);
      const consume = (vi.mocked(prisma.invitation.updateMany).mock.calls[0][0] as any);
      expect(consume.where.id).toBe(5);
      expect(consume.data.useCount).toEqual({ increment: 1 });
    });

    it('creates nothing when the invitation loses the race to be consumed', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitation() as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      // Another registration got there first between validation and consume.
      vi.mocked(prisma.invitation.updateMany).mockResolvedValue({ count: 0 } as any);

      await expect(
        authService.register({ ...validRegistration, inviteToken: 'tok_abc' })
      ).rejects.toThrow(/no longer valid/i);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('enrols the new account in the invitation course, inside the transaction', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitation({ courseId: 12 }) as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(createdUser() as any);
      vi.mocked(prisma.enrollment.create).mockResolvedValue({} as any);

      await authService.register({ ...validRegistration, inviteToken: 'tok_abc' });

      expect(prisma.enrollment.create).toHaveBeenCalledWith({
        data: { userId: 1, courseId: 12 },
      });
    });

    it('does not enrol anyone when the invitation names no course', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(invitation() as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(createdUser() as any);

      await authService.register({ ...validRegistration, inviteToken: 'tok_abc' });

      expect(prisma.enrollment.create).not.toHaveBeenCalled();
    });

    it('opens no transaction at all for an ordinary uninvited signup', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(createdUser() as any);

      await authService.register(validRegistration);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.invitation.updateMany).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Verifying an email is NOT the approval gate (regression, Codex finding #1)
  // ===========================================================================

  describe('verifyCode and the approval gate', () => {
    const codeRow = { id: 9, userId: 1, code: '123456', expiresAt: new Date(Date.now() + 60_000) };

    const confirmedAs = (status: string) => ({
      id: 1,
      fullname: 'Test User',
      email: 'test@example.com',
      isAdmin: false,
      isInstructor: false,
      avatarUrl: null,
      tokenVersion: 0,
      status,
    });

    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 1, email: 'test@example.com' } as any);
      vi.mocked(prisma.verificationCode.findFirst).mockResolvedValue(codeRow as any);
      vi.mocked(prisma.verificationCode.deleteMany).mockResolvedValue({ count: 1 } as any);
    });

    it('issues no token to an applicant still awaiting approval', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue(confirmedAs('pending_approval') as any);

      const result = await authService.verifyCode('test@example.com', '123456');

      // The email is still confirmed — they proved they own the mailbox.
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isConfirmed: true } })
      );
      // But that is not the approval gate, so no session is handed out.
      expect(result.token).toBeNull();
      expect(result.statusMessage).toMatch(/awaiting administrator approval/i);
    });

    it('issues no token to a rejected applicant', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue(confirmedAs('rejected') as any);

      const result = await authService.verifyCode('test@example.com', '123456');

      expect(result.token).toBeNull();
      expect(result.statusMessage).toMatch(/declined/i);
    });

    it('issues a token once the account is active', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue(confirmedAs('active') as any);

      const result = await authService.verifyCode('test@example.com', '123456');

      expect(result.token).toBe('mock_jwt_token');
      expect(result.statusMessage).toBeNull();
    });
  });

  describe('verifyCode brute-force and takeover defenses', () => {
    beforeEach(() => {
      vi.mocked(prisma.verificationCode.deleteMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(prisma.verificationCode.update).mockResolvedValue({} as any);
    });

    it('refuses an already-confirmed account (blocks the forgot-password → verify-code takeover)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 1,
        email: 'victim@example.com',
        isConfirmed: true,
      } as any);

      await expect(authService.verifyCode('victim@example.com', '123456')).rejects.toThrow(
        /already verified/i
      );
      // No confirmation, no token minting for a live account.
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('counts a wrong guess instead of letting the 6-digit code be brute-forced for free', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        isConfirmed: false,
      } as any);
      vi.mocked(prisma.verificationCode.findFirst).mockResolvedValue({
        id: 9,
        userId: 1,
        code: '123456',
        attempts: 0,
        purpose: 'signup',
        expiresAt: new Date(Date.now() + 60_000),
      } as any);

      await expect(authService.verifyCode('test@example.com', '000000')).rejects.toThrow(
        /invalid verification code/i
      );
      expect(prisma.verificationCode.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { attempts: { increment: 1 } } })
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('destroys the code after too many wrong guesses', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        isConfirmed: false,
      } as any);
      vi.mocked(prisma.verificationCode.findFirst).mockResolvedValue({
        id: 9,
        userId: 1,
        code: '123456',
        attempts: 4, // one more failure crosses MAX_CODE_ATTEMPTS (5)
        purpose: 'signup',
        expiresAt: new Date(Date.now() + 60_000),
      } as any);

      await expect(authService.verifyCode('test@example.com', '000000')).rejects.toThrow(
        /too many/i
      );
      expect(prisma.verificationCode.deleteMany).toHaveBeenCalled();
    });
  });

  describe('re-registration cannot erase an administrator verdict', () => {
    const validRegistration = {
      fullname: 'Test User',
      email: 'test@example.com',
      password: 'StrongPass123!',
    };

    it('refuses a rejected applicant rather than deleting the rejection', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 1, email: 'test@example.com', isConfirmed: false, status: 'rejected',
      } as any);

      await expect(authService.register({ ...validRegistration })).rejects.toThrow(/declined/i);
      expect(prisma.user.delete).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('refuses to restart a registration already in the queue', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 1, email: 'test@example.com', isConfirmed: false, status: 'pending_approval',
      } as any);

      await expect(authService.register({ ...validRegistration })).rejects.toThrow(/awaiting/i);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('still lets an ordinary unverified account re-register', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 1, email: 'test@example.com', isConfirmed: false, status: 'active',
      } as any);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 2, fullname: 'Test User', email: 'test@example.com',
        isAdmin: false, isInstructor: false, tokenVersion: 0, createdAt: new Date(),
      } as any);

      await authService.register({ ...validRegistration });

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  // ===========================================================================
  // Signup with a teacher's course code (services/courseCodeSignup.service.ts)
  // ===========================================================================

  describe('register with a course code', () => {
    const validRegistration = {
      fullname: 'Test User',
      email: 'test@example.com',
      password: 'StrongPass123!',
    };

    const createdUser = (overrides: Record<string, unknown> = {}) => ({
      id: 1,
      fullname: 'Test User',
      email: 'test@example.com',
      isAdmin: false,
      isInstructor: false,
      tokenVersion: 0,
      createdAt: new Date(),
      ...overrides,
    });

    /**
     * A DISTINCT transaction client, so "did this happen in the transaction?"
     * is a real question the tests can answer rather than an assumption. A
     * write that lands on the base client would survive a rollback; a write
     * that lands here would not.
     */
    let tx: {
      user: { create: ReturnType<typeof vi.fn> };
      enrollment: { create: ReturnType<typeof vi.fn> };
      invitation: { updateMany: ReturnType<typeof vi.fn> };
      // The verification code is written on the transaction client too, so an
      // interruption cannot leave a spent sponsorship beside an unverifiable
      // account.
      verificationCode: {
        deleteMany: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
      };
    };

    /** Answer the code -> course lookup with a published course. */
    const courseFor = (overrides: Record<string, unknown> = {}) =>
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: 7,
        title: 'Learning Analytics',
        status: 'published',
        ...overrides,
      } as any);

    /** Put the platform in one registration mode. */
    const policyMode = (mode: string) => {
      vi.mocked(prisma.systemSetting.findUnique).mockImplementation((async (args: any) =>
        args.where.settingKey === 'registration.mode'
          ? { settingKey: 'registration.mode', settingValue: mode }
          : null) as any);
    };

    beforeEach(() => {
      vi.mocked(prisma.verificationCode.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.verificationCode.create).mockResolvedValue({} as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      tx = {
        user: { create: vi.fn().mockResolvedValue(createdUser()) },
        enrollment: { create: vi.fn().mockResolvedValue({}) },
        invitation: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        // A sponsored signup stores its verification code in the SAME
        // transaction as the account, so that an interruption cannot leave a
        // spent invitation beside an account with no way to verify it.
        verificationCode: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue({}),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementation((async (fn: any) => fn(tx)) as any);
    });

    it('enrols the new account in the course the code names', async () => {
      courseFor();

      const result = await authService.register({ ...validRegistration, courseCode: 'ABC12345' });

      expect(tx.enrollment.create).toHaveBeenCalledWith({
        data: { userId: 1, courseId: 7 },
      });
      // The one course detail an unauthenticated caller ever gets back.
      expect(result.courseTitle).toBe('Learning Analytics');
    });

    it('creates the account and the enrolment in ONE transaction', async () => {
      courseFor();

      await authService.register({ ...validRegistration, courseCode: 'ABC12345' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Both writes went to the transaction client, so a rollback takes both.
      expect(tx.user.create).toHaveBeenCalledTimes(1);
      expect(tx.enrollment.create).toHaveBeenCalledTimes(1);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.enrollment.create).not.toHaveBeenCalled();
    });

    it('creates no user when the enrolment fails', async () => {
      courseFor();
      tx.enrollment.create.mockRejectedValue(new Error('enrolment exploded'));

      await expect(
        authService.register({ ...validRegistration, courseCode: 'ABC12345' })
      ).rejects.toThrow(/enrolment exploded/);

      // The only user insert was issued inside the transaction that just
      // aborted; nothing was written outside it that could survive.
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hard-fails an unknown code instead of falling through to a plain signup', async () => {
      // The platform is OPEN, so a silent fallback would happily create an
      // account with no course attached — the exact bug this guards.
      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(
        authService.register({ ...validRegistration, courseCode: 'NOSUCH12' })
      ).rejects.toThrow(/not valid/i);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(tx.user.create).not.toHaveBeenCalled();
    });

    it('matches codes case-insensitively by uppercasing before the lookup', async () => {
      courseFor();

      await authService.register({ ...validRegistration, courseCode: '  abc12345 ' });

      expect(vi.mocked(prisma.course.findUnique).mock.calls[0][0]).toMatchObject({
        where: { activationCode: 'ABC12345' },
      });
    });

    it('gives an unpublished course the same answer as an unknown code', async () => {
      courseFor({ status: 'draft' });

      // Identical message, so a probe cannot tell "no such code" from
      // "that course exists but is not open".
      await expect(
        authService.register({ ...validRegistration, courseCode: 'ABC12345' })
      ).rejects.toThrow(/not valid/i);
      expect(tx.user.create).not.toHaveBeenCalled();
    });

    it('satisfies invite_only — the teacher who issued the code is the sponsor', async () => {
      policyMode('invite_only');
      courseFor();

      const result = await authService.register({ ...validRegistration, courseCode: 'ABC12345' });

      expect(result.email).toBe('test@example.com');
      expect(tx.user.create).toHaveBeenCalled();
    });

    it('skips the approval queue — teacher sponsorship IS the approval', async () => {
      policyMode('approval');
      courseFor();

      const result = await authService.register({ ...validRegistration, courseCode: 'ABC12345' });

      expect(result.approvalRequired).toBe(false);
      expect(tx.user.create.mock.calls[0][0].data.status).toBe('active');
    });

    it('does NOT waive email verification', async () => {
      courseFor();

      const result = await authService.register({ ...validRegistration, courseCode: 'ABC12345' });

      // A teacher can vouch for a person; nobody can vouch for a mailbox
      // whose owner has not proved they read it.
      expect(result.verificationRequired).toBe(true);
      expect(tx.user.create.mock.calls[0][0].data.isConfirmed).toBe(false);
      // On the TRANSACTION client, not the base one: the code has to be stored
      // atomically with the account, or an interruption would leave the
      // invitation/course sponsorship spent and the account unverifiable.
      expect(tx.verificationCode.create).toHaveBeenCalled();
      expect(prisma.verificationCode.create).not.toHaveBeenCalled();
    });

    it('cannot reopen a closed platform', async () => {
      policyMode('closed');
      courseFor();

      await expect(
        authService.register({ ...validRegistration, courseCode: 'ABC12345' })
      ).rejects.toThrow(/closed/i);
      expect(tx.user.create).not.toHaveBeenCalled();
    });

    it('does not override the administrator\'s blocked-domain list', async () => {
      // A teacher may decide who joins their course; only an admin decides who
      // may hold an account here at all.
      vi.mocked(prisma.systemSetting.findUnique).mockImplementation((async (args: any) =>
        args.where.settingKey === 'registration.blockedEmailDomains'
          ? { settingKey: 'registration.blockedEmailDomains', settingValue: '["example.com"]' }
          : null) as any);
      courseFor();

      await expect(
        authService.register({ ...validRegistration, courseCode: 'ABC12345' })
      ).rejects.toThrow(/not permitted/i);
      expect(tx.user.create).not.toHaveBeenCalled();
    });

    it('accepts an invitation and a course code together: invitation names the role, code names the course', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue({
        id: 5,
        email: null,
        role: 'instructor',
        courseId: null,
        token: 'tok_abc',
        codeHint: 'WXYZ',
        invitedById: 1,
        maxUses: 1,
        useCount: 0,
        expiresAt: null,
        acceptedAt: null,
        revokedAt: null,
        createdAt: new Date(),
      } as any);
      courseFor();
      tx.user.create.mockResolvedValue(createdUser({ isInstructor: true }));

      await authService.register({
        ...validRegistration,
        inviteToken: 'tok_abc',
        courseCode: 'ABC12345',
      });

      expect(tx.user.create.mock.calls[0][0].data.isInstructor).toBe(true);
      expect(tx.invitation.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.enrollment.create).toHaveBeenCalledWith({
        data: { userId: 1, courseId: 7 },
      });
    });

    it('enrols only once when the invitation and the code name the same course', async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue({
        id: 5,
        email: null,
        role: 'student',
        courseId: 7,
        token: 'tok_abc',
        codeHint: 'WXYZ',
        invitedById: 1,
        maxUses: 1,
        useCount: 0,
        expiresAt: null,
        acceptedAt: null,
        revokedAt: null,
        createdAt: new Date(),
      } as any);
      courseFor();

      await authService.register({
        ...validRegistration,
        inviteToken: 'tok_abc',
        courseCode: 'ABC12345',
      });

      // Two enrolments would trip the (userId, courseId) unique constraint and
      // roll the whole signup back over nothing.
      expect(tx.enrollment.create).toHaveBeenCalledTimes(1);
    });

    it('does not look a course up at all when no code was supplied', async () => {
      vi.mocked(prisma.user.create).mockResolvedValue(createdUser() as any);

      await authService.register(validRegistration);

      expect(prisma.course.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const validLogin = {
      email: 'test@example.com',
      password: 'StrongPass123!',
    };

    const mockUser = {
      id: 1,
      fullname: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashed_password',
      isAdmin: false,
      isInstructor: false,
      isConfirmed: true,
      isActive: true,
      tokenVersion: 0,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };

    it('should successfully login with correct credentials', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.userSetting.findUnique).mockResolvedValue(null);

      const result = await authService.login(validLogin);

      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBe('mock_jwt_token');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          lastLogin: expect.any(Date),
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      });
    });

    it('should throw error for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(authService.login(validLogin)).rejects.toThrow(AppError);
      await expect(authService.login(validLogin)).rejects.toThrow('Invalid credentials');
    });

    it('should still throw invalid credentials when user not found and logging fails', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(learningAnalyticsService.logAuthEvent).mockRejectedValueOnce(new Error('Log failed'));

      await expect(authService.login(validLogin)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for incorrect password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, failedLoginAttempts: 1 } as any);

      await expect(authService.login(validLogin)).rejects.toThrow(AppError);
      await expect(authService.login(validLogin)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for deactivated account', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);

      await expect(authService.login(validLogin)).rejects.toThrow(AppError);
      await expect(authService.login(validLogin)).rejects.toThrow('Account is deactivated');
    });

    // status and isActive are separate gates; an applicant still in the queue
    // must not be told their account was "deactivated".
    it('should throw a distinct error for an account awaiting approval', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        status: 'pending_approval',
      } as any);

      await expect(authService.login(validLogin)).rejects.toThrow(AppError);
      await expect(authService.login(validLogin)).rejects.toThrow(
        'Your account is awaiting administrator approval'
      );
    });

    it('should throw a distinct error for a rejected account', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        status: 'rejected',
      } as any);

      await expect(authService.login(validLogin)).rejects.toThrow(
        /registration request was declined/
      );
    });

    it('lets an approved account through the status gate', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        status: 'active',
      } as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

      await expect(authService.login(validLogin)).resolves.toBeDefined();
    });

    // The queue is checked before deactivation, so a pending account reports
    // pending even if it is also inactive.
    it('reports pending rather than deactivated when both apply', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        status: 'pending_approval',
        isActive: false,
      } as any);

      await expect(authService.login(validLogin)).rejects.toThrow(
        'Your account is awaiting administrator approval'
      );
    });

    // Account lockout is ENABLED again (LOCKOUT_ENABLED = true), after the
    // ratchet that made it unusable was fixed. See MAX_FAILED_ATTEMPTS in
    // auth.service.ts for the history.
    it('refuses a login while the account is locked', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        lockedUntil: futureDate,
      } as any);

      await expect(authService.login(validLogin)).rejects.toThrow(/locked/i);
      // The password is never even checked while a lock is live — that is what
      // makes the lock cost an attacker time rather than just changing the
      // error message.
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('lets the user back in once the lock has lapsed', async () => {
      const pastDate = new Date(Date.now() - 60 * 1000); // lapsed a minute ago
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 10,
        lockedUntil: pastDate,
      } as any);

      const result = await authService.login(validLogin);
      expect(result.token).toBeDefined();
    });

    it('should increment failed login attempts on wrong password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, failedLoginAttempts: 1 } as any);

      await expect(authService.login(validLogin)).rejects.toThrow('Invalid credentials');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          failedLoginAttempts: 1,
        }),
      });
    });

    it('does not lock before the threshold', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 4, // this makes it the 5th attempt, still under 10
      } as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, failedLoginAttempts: 5 } as any);

      await expect(authService.login(validLogin)).rejects.toThrow('Invalid credentials');

      // Five wrong passwords is a person who has forgotten theirs, not an
      // attack; it must read exactly like the first failure.
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { failedLoginAttempts: 5 },
      });
      expect(prisma.user.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lockedUntil: expect.anything() }),
        })
      );
    });

    it('locks the account on the 10th failed attempt', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 9, // this will be the 10th
      } as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, failedLoginAttempts: 10 } as any);

      await expect(authService.login(validLogin)).rejects.toThrow(/locked/i);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          failedLoginAttempts: 10,
          lockedUntil: expect.any(Date),
        }),
      });
    });

    // REGRESSION: this is the bug that got the whole feature switched off on
    // 2026-08-03. Nothing reset the counter when a lock lapsed, so an account
    // came back from its 15 minutes still at the maximum and re-locked on the
    // very next wrong password — one guess per 15 minutes, forever, for anyone
    // who had simply forgotten their password. A lapsed lock must hand back a
    // full budget, not a single attempt.
    it('starts a fresh budget after a lock lapses, instead of re-locking at once', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        failedLoginAttempts: 10, // was at the maximum when the lock was set
        lockedUntil: new Date(Date.now() - 60 * 1000), // and that lock has lapsed
      } as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, failedLoginAttempts: 1 } as any);

      // A plain 401, NOT another lock.
      await expect(authService.login(validLogin)).rejects.toThrow('Invalid credentials');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        // Counter restarts at 1 (not 11), and the spent timestamp is cleared so
        // it cannot later read as a live lock.
        data: { failedLoginAttempts: 1, lockedUntil: null },
      });
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const mockProfile = {
        id: 1,
        fullname: 'Test User',
        email: 'test@example.com',
        isAdmin: false,
        isInstructor: true,
        isConfirmed: true,
        createdAt: new Date(),
        lastLogin: new Date(),
        settings: null,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockProfile as any);

      const result = await authService.getProfile(1);

      expect(result.email).toBe('test@example.com');
      expect(result.isInstructor).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(authService.getProfile(999)).rejects.toThrow(AppError);
      await expect(authService.getProfile(999)).rejects.toThrow('User not found');
    });
  });

  describe('updatePassword', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      passwordHash: 'old_hashed_password',
    };

    it('should successfully update password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

      const result = await authService.updatePassword(1, 'oldPassword', 'NewPassword123!');

      expect(result.message).toBe('Password updated successfully');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          passwordHash: 'hashed_password',
          tokenVersion: { increment: 1 },
        }),
      });
    });

    it('should throw error for incorrect current password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(authService.updatePassword(1, 'wrongPassword', 'NewPassword123!')).rejects.toThrow(AppError);
      await expect(authService.updatePassword(1, 'wrongPassword', 'NewPassword123!')).rejects.toThrow(
        'Current password is incorrect'
      );
    });

    it('should throw error for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(authService.updatePassword(999, 'oldPassword', 'NewPassword123!')).rejects.toThrow(AppError);
      await expect(authService.updatePassword(999, 'oldPassword', 'NewPassword123!')).rejects.toThrow('User not found');
    });

    it('should increment token version to invalidate existing tokens', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

      await authService.updatePassword(1, 'oldPassword', 'NewPassword123!');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          tokenVersion: { increment: 1 },
        }),
      });
    });
  });

  describe('logLogout', () => {
    it('should log logout event successfully', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');

      await authService.logLogout(1, 'test@example.com');

      expect(learningAnalyticsService.logAuthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          userEmail: 'test@example.com',
          eventType: 'logout',
        }),
        undefined
      );
    });

    it('should log logout with context and session duration', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');
      const context = {
        sessionId: 'sess-123',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        deviceType: 'desktop',
        browserName: 'Chrome',
        browserVersion: '120',
        osName: 'Windows',
        osVersion: '10',
      };

      await authService.logLogout(1, 'test@example.com', context, 3600);

      expect(learningAnalyticsService.logAuthEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          userEmail: 'test@example.com',
          eventType: 'logout',
          sessionId: 'sess-123',
          sessionDuration: 3600,
        }),
        '127.0.0.1'
      );
    });

    it('should handle error when logging logout fails', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');
      const { authLogger } = await import('../utils/logger.js');

      vi.mocked(learningAnalyticsService.logAuthEvent).mockRejectedValueOnce(new Error('Log failed'));

      // Should not throw, just log warning
      await authService.logLogout(1, 'test@example.com');

      expect(authLogger.warn).toHaveBeenCalled();
    });
  });

  describe('updatePassword - error handling', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      passwordHash: 'old_hashed_password',
    };

    it('should handle error when logging password change fails', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');
      const { authLogger } = await import('../utils/logger.js');

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);
      vi.mocked(learningAnalyticsService.logAuthEvent).mockRejectedValueOnce(new Error('Log failed'));

      // Should still succeed, just log warning
      const result = await authService.updatePassword(1, 'oldPassword', 'NewPassword123!');

      expect(result.message).toBe('Password updated successfully');
      expect(authLogger.warn).toHaveBeenCalled();
    });
  });

  describe('login - logging failures', () => {
    const validLogin = { email: 'test@example.com', password: 'Password123!' };
    const mockUser = {
      id: 1,
      fullname: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashed_password',
      isConfirmed: true,
      isActive: true,
      isAdmin: false,
      isInstructor: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      tokenVersion: 0,
    };

    // Was 'should still throw locked error when logging fails'. The locked
    // branch is unreachable now that lockout is disabled, but the property this
    // test exists to protect is not about locking — it is that a failure inside
    // the analytics logger must never swallow the auth outcome. Re-pointed at
    // the wrong-password path, which is still live.
    it('should still throw invalid-credentials when logging fails', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);
      vi.mocked(learningAnalyticsService.logAuthEvent).mockRejectedValueOnce(new Error('Log failed'));

      await expect(authService.login(validLogin)).rejects.toThrow('Invalid credentials');
    });

    it('should still throw deactivated error when logging fails', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);
      vi.mocked(learningAnalyticsService.logAuthEvent).mockRejectedValueOnce(new Error('Log failed'));

      await expect(authService.login(validLogin)).rejects.toThrow('Account is deactivated');
    });

    it('should still throw invalid credentials when logging fails', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, failedLoginAttempts: 1 } as any);
      vi.mocked(learningAnalyticsService.logAuthEvent).mockRejectedValueOnce(new Error('Log failed'));

      await expect(authService.login(validLogin)).rejects.toThrow('Invalid credentials');
    });

    it('should succeed on login even when logging fails', async () => {
      const { learningAnalyticsService } = await import('./learningAnalytics.service.js');

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.userSetting.findUnique).mockResolvedValue(null);
      vi.mocked(learningAnalyticsService.logAuthEvent).mockRejectedValueOnce(new Error('Log failed'));

      const result = await authService.login(validLogin);

      expect(result.user.email).toBe('test@example.com');
    });
  });
});
