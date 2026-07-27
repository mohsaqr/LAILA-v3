import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RegistrationPolicyService,
  DEFAULT_REGISTRATION_POLICY,
  REGISTRATION_SETTING_KEYS,
  domainMatches,
  evaluateRegistration,
  normalizeDomainList,
  type RegistrationPolicy,
} from './registrationPolicy.service.js';

// Mock prisma — the policy is stored in the SystemSetting key/value table and
// read through settings.service.ts, which talks to prisma directly.
vi.mock('../utils/prisma.js', () => ({
  default: {
    systemSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import prisma from '../utils/prisma.js';

/** Build a policy from the defaults with the given fields overridden. */
const policyWith = (overrides: Partial<RegistrationPolicy> = {}): RegistrationPolicy => ({
  ...DEFAULT_REGISTRATION_POLICY,
  ...overrides,
});

/** Make prisma answer findUnique from a { key: storedValue } map. */
const storedSettings = (rows: Record<string, string | null>) => {
  vi.mocked(prisma.systemSetting.findUnique).mockImplementation((async (args: any) => {
    const key = args.where.settingKey as string;
    return key in rows ? { settingKey: key, settingValue: rows[key] } : null;
  }) as any);
};

describe('registration policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Modes
  // ===========================================================================

  describe('modes', () => {
    it('allows registration in open mode', () => {
      const decision = evaluateRegistration('learner@example.com', policyWith({ mode: 'open' }));

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
      expect(decision.reason).toBeUndefined();
    });

    it('allows registration in approval mode but flags it for approval', () => {
      const decision = evaluateRegistration('learner@example.com', policyWith({ mode: 'approval' }));

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(true);
    });

    it('blocks registration in invite_only mode', () => {
      const decision = evaluateRegistration('learner@example.com', policyWith({ mode: 'invite_only' }));

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/invitation only/i);
      expect(decision.reason).toMatch(/administrator/i);
    });

    it('blocks registration in closed mode', () => {
      const decision = evaluateRegistration('learner@example.com', policyWith({ mode: 'closed' }));

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/closed/i);
    });

    it('reports closed before any domain check, even for an allowed domain', () => {
      const decision = evaluateRegistration(
        'learner@uef.fi',
        policyWith({ mode: 'closed', allowedEmailDomains: ['uef.fi'] })
      );

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/closed/i);
    });

    it('never asks for verification or approval on a rejected signup', () => {
      const decision = evaluateRegistration('learner@example.com', policyWith({ mode: 'closed' }));

      expect(decision.requiresEmailVerification).toBe(false);
      expect(decision.requiresApproval).toBe(false);
    });
  });

  // ===========================================================================
  // Allow-list
  // ===========================================================================

  describe('allowed domains', () => {
    it('accepts any domain when the allow-list is empty', () => {
      const decision = evaluateRegistration('anyone@anywhere.org', policyWith());

      expect(decision.allowed).toBe(true);
    });

    it('accepts a listed domain', () => {
      const decision = evaluateRegistration(
        'teacher@uef.fi',
        policyWith({ allowedEmailDomains: ['uef.fi', 'student.uef.fi'] })
      );

      expect(decision.allowed).toBe(true);
    });

    it('rejects an unlisted domain', () => {
      const decision = evaluateRegistration(
        'someone@gmail.com',
        policyWith({ allowedEmailDomains: ['uef.fi'] })
      );

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/approved email domains/i);
    });

    it('does not treat a subdomain as an exact-domain match', () => {
      const decision = evaluateRegistration(
        'someone@student.uef.fi',
        policyWith({ allowedEmailDomains: ['uef.fi'] })
      );

      expect(decision.allowed).toBe(false);
    });
  });

  // ===========================================================================
  // Block-list
  // ===========================================================================

  describe('blocked domains', () => {
    it('rejects a blocked domain', () => {
      const decision = evaluateRegistration(
        'spammer@throwaway.io',
        policyWith({ blockedEmailDomains: ['throwaway.io'] })
      );

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/not permitted/i);
    });

    it('lets the block-list win over the allow-list', () => {
      const decision = evaluateRegistration(
        'someone@uef.fi',
        policyWith({ allowedEmailDomains: ['uef.fi'], blockedEmailDomains: ['uef.fi'] })
      );

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/not permitted/i);
    });

    it('lets the block-list win over an auto-approved domain', () => {
      const decision = evaluateRegistration(
        'someone@uef.fi',
        policyWith({ mode: 'approval', autoApproveDomains: ['uef.fi'], blockedEmailDomains: ['uef.fi'] })
      );

      expect(decision.allowed).toBe(false);
    });
  });

  // ===========================================================================
  // Wildcards, case, malformed input
  // ===========================================================================

  describe('domain matching', () => {
    it('matches a wildcard against a subdomain of the apex', () => {
      expect(domainMatches('student@mit.edu', ['*.edu'])).toBe(true);
      expect(domainMatches('student@cs.mit.edu', ['*.edu'])).toBe(true);
    });

    it('matches a wildcard against the bare apex', () => {
      expect(domainMatches('root@edu', ['*.edu'])).toBe(true);
    });

    it('does not let a wildcard match a domain that merely ends in the same letters', () => {
      expect(domainMatches('someone@notedu', ['*.edu'])).toBe(false);
      expect(domainMatches('someone@example.com', ['*.edu'])).toBe(false);
    });

    it('matches case-insensitively on the email side', () => {
      expect(domainMatches('Someone@UEF.FI', ['uef.fi'])).toBe(true);
    });

    it('matches case-insensitively on the pattern side', () => {
      expect(domainMatches('someone@uef.fi', ['  UEF.FI  '])).toBe(true);
    });

    it('ignores blank patterns instead of matching everything', () => {
      expect(domainMatches('someone@uef.fi', ['', '   '])).toBe(false);
    });

    it('uses the last @ so a quoted local part cannot spoof the domain', () => {
      expect(domainMatches('weird@thing@uef.fi', ['uef.fi'])).toBe(true);
      expect(domainMatches('weird@thing@uef.fi', ['thing'])).toBe(false);
    });

    it('returns false for an address with no @', () => {
      expect(domainMatches('not-an-email', ['uef.fi'])).toBe(false);
    });

    it('normalizes a domain list by trimming, lower-casing and dropping blanks', () => {
      expect(normalizeDomainList([' UEF.FI ', '', '  ', 'Example.COM'])).toEqual([
        'uef.fi',
        'example.com',
      ]);
    });

    it('rejects an address with no @ outright', () => {
      const decision = evaluateRegistration('not-an-email', policyWith());

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/valid email address/i);
    });

    it('rejects an address with an empty domain', () => {
      expect(evaluateRegistration('someone@', policyWith()).allowed).toBe(false);
    });

    it('accepts a wildcard-allowed domain end to end', () => {
      const decision = evaluateRegistration(
        'student@cs.mit.edu',
        policyWith({ allowedEmailDomains: ['*.edu'] })
      );

      expect(decision.allowed).toBe(true);
    });
  });

  // ===========================================================================
  // Auto-approve
  // ===========================================================================

  describe('auto-approve domains', () => {
    it('skips the approval queue for an auto-approved domain', () => {
      const decision = evaluateRegistration(
        'teacher@uef.fi',
        policyWith({ mode: 'approval', autoApproveDomains: ['uef.fi'] })
      );

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
    });

    it('still queues a domain that is not auto-approved', () => {
      const decision = evaluateRegistration(
        'someone@gmail.com',
        policyWith({ mode: 'approval', autoApproveDomains: ['uef.fi'] })
      );

      expect(decision.requiresApproval).toBe(true);
    });

    it('has no effect in open mode, which never queues anyone', () => {
      const decision = evaluateRegistration(
        'teacher@uef.fi',
        policyWith({ mode: 'open', autoApproveDomains: ['uef.fi'] })
      );

      expect(decision.requiresApproval).toBe(false);
    });

    it('matches auto-approve wildcards case-insensitively', () => {
      const decision = evaluateRegistration(
        'Teacher@CS.MIT.EDU',
        policyWith({ mode: 'approval', autoApproveDomains: ['*.EDU'] })
      );

      expect(decision.requiresApproval).toBe(false);
    });
  });

  // ===========================================================================
  // Verification + role
  // ===========================================================================

  describe('verification and role', () => {
    it('requires email verification by default', () => {
      expect(evaluateRegistration('someone@example.com', policyWith()).requiresEmailVerification).toBe(true);
    });

    it('waives email verification when the policy switches it off', () => {
      const decision = evaluateRegistration(
        'someone@example.com',
        policyWith({ emailVerification: false })
      );

      expect(decision.requiresEmailVerification).toBe(false);
      expect(decision.allowed).toBe(true);
    });

    it('grants the configured default role', () => {
      expect(evaluateRegistration('someone@example.com', policyWith()).role).toBe('student');
      expect(
        evaluateRegistration('someone@example.com', policyWith({ defaultRole: 'instructor' })).role
      ).toBe('instructor');
    });
  });

  // ===========================================================================
  // Invitations
  //
  // An invitation reaching this function has ALREADY been validated by
  // invitation.service; here it stands for "an administrator decided about
  // this person by name", and the rules written for strangers give way to it.
  // ===========================================================================

  describe('invitations', () => {
    const invite = { role: 'student' } as const;

    it('satisfies invite_only mode', () => {
      const decision = evaluateRegistration(
        'learner@example.com',
        policyWith({ mode: 'invite_only' }),
        invite
      );

      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBeUndefined();
    });

    it('bypasses the blocked-domain list', () => {
      const decision = evaluateRegistration(
        'learner@spam.example',
        policyWith({ blockedEmailDomains: ['spam.example'] }),
        invite
      );

      expect(decision.allowed).toBe(true);
    });

    it('bypasses the allowed-domain list', () => {
      const decision = evaluateRegistration(
        'guest@elsewhere.org',
        policyWith({ allowedEmailDomains: ['uef.fi'] }),
        invite
      );

      expect(decision.allowed).toBe(true);
    });

    it('skips the approval queue — the invitation IS the approval', () => {
      const decision = evaluateRegistration(
        'learner@example.com',
        policyWith({ mode: 'approval' }),
        invite
      );

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
    });

    it('takes its role from the invitation, not the policy default', () => {
      const decision = evaluateRegistration(
        'teacher@example.com',
        policyWith({ defaultRole: 'student' }),
        { role: 'instructor' }
      );

      expect(decision.role).toBe('instructor');
    });

    it('does not reopen a closed platform', () => {
      const decision = evaluateRegistration(
        'learner@example.com',
        policyWith({ mode: 'closed' }),
        invite
      );

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/closed/i);
    });

    it('still rejects an unparseable address', () => {
      expect(evaluateRegistration('not-an-email', policyWith(), invite).allowed).toBe(false);
    });

    it('still honours the email-verification setting', () => {
      expect(
        evaluateRegistration('learner@example.com', policyWith({ emailVerification: true }), invite)
          .requiresEmailVerification
      ).toBe(true);
      expect(
        evaluateRegistration('learner@example.com', policyWith({ emailVerification: false }), invite)
          .requiresEmailVerification
      ).toBe(false);
    });

    it('leaves every existing two-argument call site unchanged', () => {
      // The third parameter defaults to null, so a call that predates
      // invitations still gets the strangers' rules.
      expect(
        evaluateRegistration('learner@example.com', policyWith({ mode: 'invite_only' })).allowed
      ).toBe(false);
    });
  });

  // ===========================================================================
  // Course-code sponsorship
  //
  // `sponsored` reaching this function means courseCodeSignup.service already
  // resolved a teacher's code to a real, published course. It is a NARROWER
  // authority than an invitation: a teacher decides who joins their course, an
  // administrator decides who may hold an account here at all.
  // ===========================================================================

  describe('course-code sponsorship', () => {
    const sponsored = true;

    it('satisfies invite_only mode', () => {
      const decision = evaluateRegistration(
        'learner@example.com',
        policyWith({ mode: 'invite_only' }),
        null,
        sponsored
      );

      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBeUndefined();
    });

    it('skips the approval queue — the teacher who issued the code IS the approval', () => {
      const decision = evaluateRegistration(
        'learner@example.com',
        policyWith({ mode: 'approval' }),
        null,
        sponsored
      );

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
    });

    it('does not reopen a closed platform', () => {
      const decision = evaluateRegistration(
        'learner@example.com',
        policyWith({ mode: 'closed' }),
        null,
        sponsored
      );

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/closed/i);
    });

    it('does NOT override the blocked-domain list', () => {
      const decision = evaluateRegistration(
        'learner@spam.example',
        policyWith({ blockedEmailDomains: ['spam.example'] }),
        null,
        sponsored
      );

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/not permitted/i);
    });

    it('does NOT override the allowed-domain list', () => {
      const decision = evaluateRegistration(
        'guest@elsewhere.org',
        policyWith({ allowedEmailDomains: ['uef.fi'] }),
        null,
        sponsored
      );

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toMatch(/approved email domains/i);
    });

    it('does NOT waive email verification', () => {
      expect(
        evaluateRegistration(
          'learner@example.com',
          policyWith({ emailVerification: true }),
          null,
          sponsored
        ).requiresEmailVerification
      ).toBe(true);
    });

    it('confers no role — a code-sponsored account gets the policy default', () => {
      expect(
        evaluateRegistration(
          'learner@example.com',
          policyWith({ defaultRole: 'student' }),
          null,
          sponsored
        ).role
      ).toBe('student');
    });

    it('lets the invitation govern the role when both are present', () => {
      // Allowed together on purpose: the invitation says what you are, the
      // course code says what you are enrolled in.
      const decision = evaluateRegistration(
        'teacher@example.com',
        policyWith({ mode: 'invite_only', defaultRole: 'student' }),
        { role: 'instructor' },
        sponsored
      );

      expect(decision.allowed).toBe(true);
      expect(decision.role).toBe('instructor');
    });

    it('leaves every existing three-argument call site unchanged', () => {
      // The fourth parameter defaults to false, so a call that predates course
      // codes still gets the strangers' rules.
      expect(
        evaluateRegistration('learner@example.com', policyWith({ mode: 'invite_only' }), null)
          .allowed
      ).toBe(false);
    });
  });

  // ===========================================================================
  // Defaults reproduce today's behaviour
  // ===========================================================================

  describe('defaults', () => {
    it('are open registration with emailed verification for a student', () => {
      expect(DEFAULT_REGISTRATION_POLICY).toEqual({
        mode: 'open',
        emailVerification: true,
        allowedEmailDomains: [],
        blockedEmailDomains: [],
        autoApproveDomains: [],
        defaultRole: 'student',
      });
    });

    it('let any address register with a verification code and no approval', () => {
      const decision = evaluateRegistration('anyone@anywhere.example');

      expect(decision).toEqual({
        allowed: true,
        requiresEmailVerification: true,
        requiresApproval: false,
        role: 'student',
      });
    });

    it('do not reinstate any hardcoded university domain', () => {
      expect(evaluateRegistration('someone@gmail.com').allowed).toBe(true);
      expect(evaluateRegistration('someone@uef.fi').allowed).toBe(true);
    });
  });

  // ===========================================================================
  // Storage
  // ===========================================================================

  describe('getPolicy', () => {
    let service: RegistrationPolicyService;

    beforeEach(() => {
      service = new RegistrationPolicyService();
    });

    it('falls back to the defaults when nothing is stored', async () => {
      storedSettings({});

      await expect(service.getPolicy()).resolves.toEqual(DEFAULT_REGISTRATION_POLICY);
    });

    it('reads every stored key', async () => {
      storedSettings({
        [REGISTRATION_SETTING_KEYS.mode]: 'approval',
        [REGISTRATION_SETTING_KEYS.emailVerification]: 'false',
        [REGISTRATION_SETTING_KEYS.allowedEmailDomains]: '["UEF.fi"," *.edu "]',
        [REGISTRATION_SETTING_KEYS.blockedEmailDomains]: '["throwaway.io"]',
        [REGISTRATION_SETTING_KEYS.autoApproveDomains]: '["uef.fi"]',
        [REGISTRATION_SETTING_KEYS.defaultRole]: 'instructor',
      });

      await expect(service.getPolicy()).resolves.toEqual({
        mode: 'approval',
        emailVerification: false,
        allowedEmailDomains: ['uef.fi', '*.edu'],
        blockedEmailDomains: ['throwaway.io'],
        autoApproveDomains: ['uef.fi'],
        defaultRole: 'instructor',
      });
    });

    it('ignores an unknown mode rather than locking everyone out', async () => {
      storedSettings({ [REGISTRATION_SETTING_KEYS.mode]: 'banana' });

      await expect(service.getPolicy()).resolves.toMatchObject({ mode: 'open' });
    });

    it('ignores a malformed domain list rather than throwing', async () => {
      storedSettings({ [REGISTRATION_SETTING_KEYS.allowedEmailDomains]: 'not json' });

      await expect(service.getPolicy()).resolves.toMatchObject({ allowedEmailDomains: [] });
    });

    it('ignores a JSON value that is not an array of strings', async () => {
      storedSettings({
        [REGISTRATION_SETTING_KEYS.blockedEmailDomains]: '{"uef.fi":true}',
        [REGISTRATION_SETTING_KEYS.autoApproveDomains]: '["uef.fi", 42, null]',
      });

      await expect(service.getPolicy()).resolves.toMatchObject({
        blockedEmailDomains: [],
        autoApproveDomains: ['uef.fi'],
      });
    });

    it('ignores an unknown default role', async () => {
      storedSettings({ [REGISTRATION_SETTING_KEYS.defaultRole]: 'admin' });

      await expect(service.getPolicy()).resolves.toMatchObject({ defaultRole: 'student' });
    });
  });

  describe('updatePolicy', () => {
    let service: RegistrationPolicyService;

    beforeEach(() => {
      service = new RegistrationPolicyService();
      vi.mocked(prisma.systemSetting.upsert).mockResolvedValue({} as any);
      storedSettings({});
    });

    it('writes only the supplied fields', async () => {
      await service.updatePolicy({ mode: 'closed' });

      expect(prisma.systemSetting.upsert).toHaveBeenCalledTimes(1);
      expect(vi.mocked(prisma.systemSetting.upsert).mock.calls[0][0]).toMatchObject({
        where: { settingKey: REGISTRATION_SETTING_KEYS.mode },
        update: { settingValue: 'closed' },
      });
    });

    it('stores domain lists as normalized JSON arrays', async () => {
      await service.updatePolicy({ allowedEmailDomains: [' UEF.FI ', 'Example.com', ''] });

      expect(vi.mocked(prisma.systemSetting.upsert).mock.calls[0][0]).toMatchObject({
        where: { settingKey: REGISTRATION_SETTING_KEYS.allowedEmailDomains },
        update: { settingValue: '["uef.fi","example.com"]' },
      });
    });

    it('stores booleans as strings the reader understands', async () => {
      await service.updatePolicy({ emailVerification: false });

      expect(vi.mocked(prisma.systemSetting.upsert).mock.calls[0][0]).toMatchObject({
        update: { settingValue: 'false' },
      });
    });

    it('returns the re-read policy', async () => {
      await expect(service.updatePolicy({})).resolves.toEqual(DEFAULT_REGISTRATION_POLICY);
      expect(prisma.systemSetting.upsert).not.toHaveBeenCalled();
    });
  });

  describe('evaluate', () => {
    it('decides against the stored policy', async () => {
      const service = new RegistrationPolicyService();
      storedSettings({
        [REGISTRATION_SETTING_KEYS.mode]: 'approval',
        [REGISTRATION_SETTING_KEYS.allowedEmailDomains]: '["*.edu"]',
      });

      await expect(service.evaluate('student@mit.edu')).resolves.toMatchObject({
        allowed: true,
        requiresApproval: true,
      });
      await expect(service.evaluate('student@gmail.com')).resolves.toMatchObject({ allowed: false });
    });
  });
});
