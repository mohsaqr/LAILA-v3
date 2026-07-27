import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserManagementService } from './userManagement.service.js';
import { AppError } from '../middleware/error.middleware.js';

// One shared `tx` object stands in for both the client and the interactive
// transaction callback, so assertions can target it regardless of which the
// service reached for.
const mocks = vi.hoisted(() => {
  const tx = {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    course: { findMany: vi.fn() },
    courseAnnouncement: { findMany: vi.fn() },
    batchEnrollmentJob: { findMany: vi.fn() },
    survey: { findMany: vi.fn() },
    customLab: { findMany: vi.fn() },
  };
  return {
    tx,
    logMany: vi.fn(),
    invalidateUserStatusCache: vi.fn(),
  };
});

vi.mock('../utils/prisma.js', () => ({
  default: {
    ...mocks.tx,
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mocks.tx)),
  },
}));

vi.mock('./adminAudit.service.js', () => ({
  adminAuditService: { log: vi.fn(), logMany: mocks.logMany },
}));

vi.mock('../middleware/auth.middleware.js', () => ({
  invalidateUserStatusCache: mocks.invalidateUserStatusCache,
}));

type MockUser = {
  id: number;
  isAdmin: boolean;
  isInstructor: boolean;
  isActive: boolean;
  isConfirmed: boolean;
  status: string;
};

const user = (id: number, over: Partial<MockUser> = {}): MockUser => ({
  id,
  isAdmin: false,
  isInstructor: false,
  isActive: true,
  isConfirmed: true,
  status: 'active',
  ...over,
});

const ADMIN_CONTEXT = { adminId: 99, adminEmail: 'admin@example.com', ipAddress: '10.0.0.1' };

describe('UserManagementService.bulkUpdate', () => {
  let service: UserManagementService;

  beforeEach(() => {
    service = new UserManagementService();
    vi.clearAllMocks();
    // No blocking relations unless a test says otherwise.
    mocks.tx.course.findMany.mockResolvedValue([]);
    mocks.tx.courseAnnouncement.findMany.mockResolvedValue([]);
    mocks.tx.batchEnrollmentJob.findMany.mockResolvedValue([]);
    mocks.tx.survey.findMany.mockResolvedValue([]);
    mocks.tx.customLab.findMany.mockResolvedValue([]);
    mocks.tx.user.count.mockResolvedValue(5);
    mocks.tx.user.updateMany.mockResolvedValue({ count: 0 });
    mocks.tx.user.deleteMany.mockResolvedValue({ count: 0 });
  });

  describe('activate / deactivate', () => {
    it('activates only the users that are currently inactive', async () => {
      mocks.tx.user.findMany.mockResolvedValue([
        user(1, { isActive: false }),
        user(2, { isActive: false }),
      ]);

      const result = await service.bulkUpdate([1, 2], 'activate', {}, ADMIN_CONTEXT);

      expect(result.changed).toBe(2);
      expect(result.skipped).toBe(0);
      expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
        data: { isActive: true },
      });
    });

    it('skips users already in the requested state, with a reason', async () => {
      mocks.tx.user.findMany.mockResolvedValue([
        user(1, { isActive: true }),
        user(2, { isActive: false }),
      ]);

      const result = await service.bulkUpdate([1, 2], 'activate', {}, ADMIN_CONTEXT);

      expect(result.changed).toBe(1);
      expect(result.skippedDetail).toEqual([{ userId: 1, reason: 'Already in that state' }]);
      expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [2] } },
        data: { isActive: true },
      });
    });

    it('issues no write at all when every user is already in that state', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1), user(2)]);

      const result = await service.bulkUpdate([1, 2], 'activate', {}, ADMIN_CONTEXT);

      expect(result.changed).toBe(0);
      expect(result.skipped).toBe(2);
      expect(mocks.tx.user.updateMany).not.toHaveBeenCalled();
    });

    it('deactivates in one set-based statement rather than one per user', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1), user(2), user(3)]);

      await service.bulkUpdate([1, 2, 3], 'deactivate', {}, ADMIN_CONTEXT);

      expect(mocks.tx.user.updateMany).toHaveBeenCalledTimes(1);
      expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2, 3] } },
        data: { isActive: false },
      });
    });
  });

  describe('last-admin guard', () => {
    // The reason this method exists. A client-side fan-out evaluates the
    // invariant once per request, so each call sees the others still intact
    // and every one of them passes. A single running counter cannot.
    it('stops the batch before it removes the last active admin', async () => {
      mocks.tx.user.findMany.mockResolvedValue([
        user(1, { isAdmin: true }),
        user(2, { isAdmin: true }),
        user(3, { isAdmin: true }),
      ]);
      // Exactly three admins can currently sign in — all three are selected.
      mocks.tx.user.count.mockResolvedValue(3);

      const result = await service.bulkUpdate([1, 2, 3], 'deactivate', {}, ADMIN_CONTEXT);

      expect(result.changed).toBe(2);
      expect(result.skippedDetail).toEqual([
        { userId: 3, reason: 'Would leave no active admin' },
      ]);
      expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
        data: { isActive: false },
      });
    });

    it('skips the same user on every run — the order is deterministic', async () => {
      const rows = [
        user(3, { isAdmin: true }),
        user(1, { isAdmin: true }),
        user(2, { isAdmin: true }),
      ];
      mocks.tx.user.findMany.mockResolvedValue(rows);
      mocks.tx.user.count.mockResolvedValue(3);

      // Ids arrive unsorted, and the rows come back in a different order again.
      const result = await service.bulkUpdate([3, 1, 2], 'deactivate', {}, ADMIN_CONTEXT);

      expect(result.skippedDetail).toEqual([
        { userId: 3, reason: 'Would leave no active admin' },
      ]);
    });

    it('does not count an inactive admin as a slot being consumed', async () => {
      mocks.tx.user.findMany.mockResolvedValue([
        user(1, { isAdmin: true, isActive: false }),
        user(2, { isAdmin: true }),
      ]);
      mocks.tx.user.count.mockResolvedValue(1);

      // Deleting the already-inactive admin costs nothing; admin 2 is the last
      // usable one and must survive.
      const result = await service.bulkUpdate([1, 2], 'delete', {}, ADMIN_CONTEXT);

      expect(result.changed).toBe(1);
      expect(mocks.tx.user.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [1] } } });
      expect(result.skippedDetail).toEqual([
        { userId: 2, reason: 'Would leave no active admin' },
      ]);
    });

    it('applies no guard when the action adds admins instead of removing them', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1), user(2)]);
      mocks.tx.user.count.mockResolvedValue(1);

      const result = await service.bulkUpdate([1, 2], 'setRole', { role: 'admin' }, ADMIN_CONTEXT);

      expect(result.changed).toBe(2);
      expect(result.skipped).toBe(0);
    });
  });

  describe('self-protection', () => {
    it.each(['deactivate', 'delete'] as const)(
      'refuses to %s the acting admin’s own account',
      async action => {
        mocks.tx.user.findMany.mockResolvedValue([user(99, { isAdmin: true }), user(2)]);

        const result = await service.bulkUpdate([99, 2], action, {}, ADMIN_CONTEXT);

        expect(result.skippedDetail).toEqual([
          { userId: 99, reason: 'Cannot apply this action to your own account' },
        ]);
        expect(result.changed).toBe(1);
      }
    );

    it('refuses to change the acting admin’s own role', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(99, { isAdmin: true })]);

      const result = await service.bulkUpdate([99], 'setRole', { role: 'student' }, ADMIN_CONTEXT);

      expect(result.changed).toBe(0);
      expect(result.skippedDetail[0].reason).toBe('Cannot apply this action to your own account');
    });

    it('allows harmless actions on the acting admin’s own account', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(99, { isConfirmed: false })]);

      const result = await service.bulkUpdate([99], 'confirm', {}, ADMIN_CONTEXT);

      expect(result.changed).toBe(1);
      expect(result.skipped).toBe(0);
    });
  });

  describe('setRole', () => {
    it('rejects the call outright when no role was supplied', async () => {
      await expect(service.bulkUpdate([1], 'setRole', {}, ADMIN_CONTEXT)).rejects.toThrow(AppError);
      expect(mocks.tx.user.updateMany).not.toHaveBeenCalled();
    });

    it('bumps tokenVersion so a demotion is enforced before the token expires', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1, { isInstructor: true })]);

      await service.bulkUpdate([1], 'setRole', { role: 'student' }, ADMIN_CONTEXT);

      expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1] } },
        data: { isAdmin: false, isInstructor: false, tokenVersion: { increment: 1 } },
      });
    });

    it('treats instructor as admin=false, instructor=true', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1)]);

      await service.bulkUpdate([1], 'setRole', { role: 'instructor' }, ADMIN_CONTEXT);

      expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1] } },
        data: { isAdmin: false, isInstructor: true, tokenVersion: { increment: 1 } },
      });
    });

    it('skips users that already hold the requested role', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1, { isInstructor: true }), user(2)]);

      const result = await service.bulkUpdate([1, 2], 'setRole', { role: 'instructor' }, ADMIN_CONTEXT);

      expect(result.changed).toBe(1);
      expect(result.skippedDetail).toEqual([{ userId: 1, reason: 'Already in that state' }]);
    });
  });

  describe('delete blockers', () => {
    it('skips a user the database would refuse to delete, naming what they own', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1), user(2)]);
      mocks.tx.course.findMany.mockResolvedValue([{ instructorId: 1 }, { instructorId: 1 }]);

      const result = await service.bulkUpdate([1, 2], 'delete', {}, ADMIN_CONTEXT);

      expect(result.changed).toBe(1);
      expect(result.skippedDetail).toEqual([
        { userId: 1, reason: 'Still owns 2 courses — reassign or remove them first' },
      ]);
      // The blocked user must not reach the statement, or it would roll the
      // whole batch back on a foreign-key violation.
      expect(mocks.tx.user.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [2] } } });
    });

    it('singularises a single owned row', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1)]);
      mocks.tx.survey.findMany.mockResolvedValue([{ createdById: 1 }]);

      const result = await service.bulkUpdate([1], 'delete', {}, ADMIN_CONTEXT);

      expect(result.skippedDetail[0].reason).toBe(
        'Still owns 1 survey — reassign or remove them first'
      );
    });

    it('lists every kind of blocking row a user owns', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1)]);
      mocks.tx.course.findMany.mockResolvedValue([{ instructorId: 1 }]);
      mocks.tx.customLab.findMany.mockResolvedValue([{ createdBy: 1 }, { createdBy: 1 }]);

      const result = await service.bulkUpdate([1], 'delete', {}, ADMIN_CONTEXT);

      expect(result.skippedDetail[0].reason).toBe(
        'Still owns 1 course, 2 labs — reassign or remove them first'
      );
    });

    it('does not look for blockers on non-delete actions', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1, { isActive: false })]);

      await service.bulkUpdate([1], 'activate', {}, ADMIN_CONTEXT);

      expect(mocks.tx.course.findMany).not.toHaveBeenCalled();
    });
  });

  describe('approval queue', () => {
    const pending = (id: number, over = {}) => user(id, { status: 'pending_approval', ...over });

    it('approves everyone in the queue in one statement', async () => {
      mocks.tx.user.findMany.mockResolvedValue([pending(1), pending(2)]);

      const result = await service.bulkUpdate([1, 2], 'approve', {}, ADMIN_CONTEXT);

      expect(result.changed).toBe(2);
      expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
        data: { status: 'active' },
      });
    });

    it('rejects everyone in the queue in one statement', async () => {
      mocks.tx.user.findMany.mockResolvedValue([pending(1)]);

      const result = await service.bulkUpdate([1], 'reject', {}, ADMIN_CONTEXT);

      expect(result.changed).toBe(1);
      expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1] } },
        data: { status: 'rejected' },
      });
    });

    // A verdict on an established account would silently rewrite its lifecycle.
    it('refuses to approve an account that was never in the queue', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1, { status: 'rejected' })]);

      const result = await service.bulkUpdate([1], 'approve', {}, ADMIN_CONTEXT);

      expect(result.changed).toBe(0);
      expect(result.skippedDetail).toEqual([{ userId: 1, reason: 'Not awaiting approval' }]);
      expect(mocks.tx.user.updateMany).not.toHaveBeenCalled();
    });

    it('refuses to reject an already-active account', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1)]);

      const result = await service.bulkUpdate([1], 'reject', {}, ADMIN_CONTEXT);

      expect(result.changed).toBe(0);
      expect(result.skippedDetail).toEqual([{ userId: 1, reason: 'Not awaiting approval' }]);
    });

    it('reports approving an already-active account as a no-op', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1)]);

      const result = await service.bulkUpdate([1], 'approve', {}, ADMIN_CONTEXT);

      expect(result.skippedDetail).toEqual([{ userId: 1, reason: 'Already in that state' }]);
    });

    it('applies verdicts to only the queued members of a mixed selection', async () => {
      mocks.tx.user.findMany.mockResolvedValue([pending(1), user(2), pending(3)]);

      const result = await service.bulkUpdate([1, 2, 3], 'approve', {}, ADMIN_CONTEXT);

      expect(result.changed).toBe(2);
      expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 3] } },
        data: { status: 'active' },
      });
    });

    it('will not let an admin rule on their own application', async () => {
      mocks.tx.user.findMany.mockResolvedValue([pending(99)]);

      const result = await service.bulkUpdate([99], 'approve', {}, ADMIN_CONTEXT);

      expect(result.changed).toBe(0);
      expect(result.skippedDetail[0].reason).toBe('Cannot apply this action to your own account');
    });

    it('drops the cached status so a rejection takes effect at once', async () => {
      mocks.tx.user.findMany.mockResolvedValue([pending(1)]);

      await service.bulkUpdate([1], 'reject', {}, ADMIN_CONTEXT);

      expect(mocks.invalidateUserStatusCache).toHaveBeenCalledWith(1);
    });

    it('audits each verdict against its own user', async () => {
      mocks.tx.user.findMany.mockResolvedValue([pending(1), pending(2)]);

      await service.bulkUpdate([1, 2], 'approve', {}, ADMIN_CONTEXT);

      const rows = mocks.logMany.mock.calls[0][0];
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ action: 'bulk_user_approve', targetType: 'user', targetId: 1 });
    });
  });

  describe('last-admin counter excludes unusable admins', () => {
    // An admin stuck in the queue cannot sign in, so counting them would let
    // the batch strip the last admin who actually can.
    it('counts only admins whose status lets them log in', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1, { isAdmin: true })]);
      mocks.tx.user.count.mockResolvedValue(1);

      const result = await service.bulkUpdate([1], 'deactivate', {}, ADMIN_CONTEXT);

      expect(mocks.tx.user.count).toHaveBeenCalledWith({
        where: { isAdmin: true, isActive: true, status: 'active' },
      });
      expect(result.changed).toBe(0);
      expect(result.skippedDetail[0].reason).toBe('Would leave no active admin');
    });
  });

  describe('input handling', () => {
    it('reports unknown ids as errors instead of dropping them silently', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1)]);

      const result = await service.bulkUpdate([1, 404], 'deactivate', {}, ADMIN_CONTEXT);

      expect(result.errors).toEqual([{ userId: 404, error: 'User not found' }]);
      expect(result.changed).toBe(1);
      expect(result.total).toBe(2);
    });

    it('counts a duplicated id once', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1)]);

      const result = await service.bulkUpdate([1, 1, 1], 'deactivate', {}, ADMIN_CONTEXT);

      expect(result.total).toBe(1);
      expect(result.changed).toBe(1);
      expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1] } },
        data: { isActive: false },
      });
    });
  });

  describe('side effects', () => {
    it('drops the cached status of every user it changed', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1), user(2)]);

      await service.bulkUpdate([1, 2], 'deactivate', {}, ADMIN_CONTEXT);

      expect(mocks.invalidateUserStatusCache).toHaveBeenCalledTimes(2);
      expect(mocks.invalidateUserStatusCache).toHaveBeenCalledWith(1);
      expect(mocks.invalidateUserStatusCache).toHaveBeenCalledWith(2);
    });

    it('does not invalidate the cache for users it skipped', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1), user(2, { isActive: false })]);

      await service.bulkUpdate([1, 2], 'deactivate', {}, ADMIN_CONTEXT);

      expect(mocks.invalidateUserStatusCache).toHaveBeenCalledTimes(1);
      expect(mocks.invalidateUserStatusCache).toHaveBeenCalledWith(1);
    });

    it('writes one audit row per changed user so per-user history stays complete', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1), user(2)]);

      await service.bulkUpdate([1, 2], 'deactivate', {}, ADMIN_CONTEXT);

      const rows = mocks.logMany.mock.calls[0][0];
      expect(rows).toHaveLength(2);
      expect(rows.map((r: { targetId: number }) => r.targetId)).toEqual([1, 2]);
      expect(rows[0]).toMatchObject({
        adminId: 99,
        action: 'bulk_user_deactivate',
        targetType: 'user',
        ipAddress: '10.0.0.1',
      });
      // The shared marker is what correlates the rows back into one action.
      expect(rows[0].newValues.batch).toEqual({ size: 2, requested: 2 });
    });

    it('records the target role on a role change', async () => {
      mocks.tx.user.findMany.mockResolvedValue([user(1)]);

      await service.bulkUpdate([1], 'setRole', { role: 'instructor' }, ADMIN_CONTEXT);

      expect(mocks.logMany.mock.calls[0][0][0].newValues).toMatchObject({
        action: 'setRole',
        role: 'instructor',
      });
    });
  });
});
