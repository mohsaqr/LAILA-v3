import { settingsService } from './settings.service.js';

/**
 * The registration policy engine.
 *
 * A single admin-configured posture decides whether a self-service signup may
 * proceed, whether the new account must verify its email, whether it needs an
 * administrator's approval before it goes live, and which role it starts with.
 *
 * The policy lives in the `SystemSetting` key/value table (no schema columns,
 * no migration) under the `registration.*` keys below. The defaults reproduce
 * LAILA's historical behaviour exactly — anyone may register, and an emailed
 * one-time code confirms the address — so nothing changes until an admin flips
 * a setting.
 *
 * `evaluateRegistration()` is pure: it takes the policy plus an email and
 * returns a decision. Everything that needs to gate registration derives its
 * answer from that one function rather than re-checking modes ad hoc.
 */

export const REGISTRATION_MODES = ['open', 'approval', 'invite_only', 'closed'] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

// Self-service registration never grants `admin`. A privileged role is only
// ever conferred by an existing admin through user management.
export const REGISTRATION_ROLES = ['student', 'instructor'] as const;
export type RegistrationRole = (typeof REGISTRATION_ROLES)[number];

/**
 * Narrow a role that came out of the database (where it is a plain String
 * column) back to the closed set. Anything unrecognised — a hand-edited row, a
 * value written by an older build — degrades to the least privileged role
 * rather than being trusted or throwing at signup time.
 */
export function asRegistrationRole(value: string | null | undefined): RegistrationRole {
  return REGISTRATION_ROLES.includes(value as RegistrationRole) ? (value as RegistrationRole) : 'student';
}

export interface RegistrationPolicy {
  mode: RegistrationMode;
  /** Require the emailed one-time code before the account is usable. */
  emailVerification: boolean;
  /** Empty = any domain may register. Non-empty = only these domains. */
  allowedEmailDomains: string[];
  /** Always rejected, and checked before the allow-list. */
  blockedEmailDomains: string[];
  /** In `approval` mode, these domains skip the approval queue. */
  autoApproveDomains: string[];
  defaultRole: RegistrationRole;
}

/**
 * What the caller knows about an invitation backing this signup.
 *
 * Only the invitation's ROLE reaches the decision. Validity, expiry, use
 * budget and email binding were all settled by invitation.service before this
 * point, and this engine deliberately does not re-check them: two places
 * deciding whether an invitation is good is two places to get it wrong.
 * Passing a value here therefore MEANS "an administrator has already vouched
 * for this person" — never pass an unvalidated invitation.
 */
export interface RegistrationInvite {
  role: RegistrationRole;
}

/**
 * Whether a teacher's course code is backing this signup.
 *
 * Like RegistrationInvite, this MEANS "already validated" — courseCodeSignup
 * .service resolved the code to a real, published course before the caller got
 * here, and this engine does not re-check it. Never pass `true` for a code that
 * has not resolved.
 *
 * A course code is a WEAKER sponsorship than an invitation and the difference
 * is deliberate. An invitation comes from an administrator, so it outranks the
 * rules written for strangers entirely. A course code comes from a teacher, who
 * may decide who joins their course but may NOT decide who may hold an account
 * on the platform: a code therefore satisfies invite_only and stands in for the
 * approval, but it does not override the email domain allow/block lists and it
 * does not choose a role.
 */
export type RegistrationSponsorship = boolean;

export interface RegistrationDecision {
  allowed: boolean;
  /** Human-readable rejection message; only set when `allowed` is false. */
  reason?: string;
  requiresEmailVerification: boolean;
  requiresApproval: boolean;
  role: RegistrationRole;
}

export const REGISTRATION_SETTING_KEYS = {
  mode: 'registration.mode',
  emailVerification: 'registration.emailVerification',
  allowedEmailDomains: 'registration.allowedEmailDomains',
  blockedEmailDomains: 'registration.blockedEmailDomains',
  autoApproveDomains: 'registration.autoApproveDomains',
  defaultRole: 'registration.defaultRole',
} as const;

/** The stored defaults, and the fallback whenever a key is missing. */
export const DEFAULT_REGISTRATION_POLICY: RegistrationPolicy = {
  mode: 'open',
  emailVerification: true,
  allowedEmailDomains: [],
  blockedEmailDomains: [],
  autoApproveDomains: [],
  defaultRole: 'student',
};

/** Seeded alongside the other system settings; see settings.service.ts. */
export const REGISTRATION_DEFAULT_SETTINGS = [
  {
    settingKey: REGISTRATION_SETTING_KEYS.mode,
    settingValue: DEFAULT_REGISTRATION_POLICY.mode,
    settingType: 'string',
    description: 'Registration mode: open, approval, invite_only or closed',
  },
  {
    settingKey: REGISTRATION_SETTING_KEYS.emailVerification,
    settingValue: String(DEFAULT_REGISTRATION_POLICY.emailVerification),
    settingType: 'boolean',
    description: 'Require an emailed verification code to activate a new account',
  },
  {
    settingKey: REGISTRATION_SETTING_KEYS.allowedEmailDomains,
    settingValue: '[]',
    settingType: 'json',
    description: 'Email domains allowed to register (empty means any domain)',
  },
  {
    settingKey: REGISTRATION_SETTING_KEYS.blockedEmailDomains,
    settingValue: '[]',
    settingType: 'json',
    description: 'Email domains that may never register',
  },
  {
    settingKey: REGISTRATION_SETTING_KEYS.autoApproveDomains,
    settingValue: '[]',
    settingType: 'json',
    description: 'Email domains that skip the approval queue in approval mode',
  },
  {
    settingKey: REGISTRATION_SETTING_KEYS.defaultRole,
    settingValue: DEFAULT_REGISTRATION_POLICY.defaultRole,
    settingType: 'string',
    description: 'Role granted to a self-registered account: student or instructor',
  },
];

/** Lower-case, trim and drop blanks so stored lists compare predictably. */
export function normalizeDomainList(patterns: string[]): string[] {
  return patterns
    .map(p => p.trim().toLowerCase())
    .filter(p => p.length > 0);
}

/** The domain part of an email, lower-cased. `null` when there is none. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

/**
 * Match an email against a pattern list. Patterns are either an exact domain
 * (`uef.fi`) or a wildcard (`*.edu`, which matches `mit.edu`, `cs.mit.edu` and
 * the bare apex `edu`). Matching is case-insensitive on both sides.
 */
export function domainMatches(email: string, patterns: string[]): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;

  return normalizeDomainList(patterns).some(pattern => {
    if (pattern.startsWith('*.')) {
      const apex = pattern.slice(2); // "*.edu" -> "edu"
      return domain === apex || domain.endsWith(`.${apex}`);
    }
    return domain === pattern;
  });
}

/**
 * Decide whether `email` may register under `policy`, optionally backed by an
 * already-validated `invite`.
 *
 * Order matters: a closed site says so before anything else, an unparseable
 * address is rejected before the domain lists are consulted, and the block-list
 * always wins over the allow-list.
 *
 * AN INVITATION IS AN ADMINISTRATOR'S EXPLICIT DECISION about one person, so it
 * outranks the rules written for strangers: it satisfies `invite_only`, skips
 * the domain allow/block lists, supplies the role, and IS the approval (nobody
 * needs to approve what an admin already chose). The one thing it cannot do is
 * reopen a `closed` platform — closed means the door is shut for everyone, and
 * an outstanding invitation issued last month must not quietly reopen it.
 *
 * A COURSE CODE IS A TEACHER'S SPONSORSHIP, which is a real but narrower
 * authority — see RegistrationSponsorship. It satisfies `invite_only` and IS
 * the approval, on the same reasoning: the teacher issuing the code has already
 * decided this person belongs here. It does NOT bypass the domain lists (those
 * are the administrator's call about who may hold an account at all) and it
 * does not name a role, so a code-sponsored account gets `policy.defaultRole`.
 * Like an invitation, it cannot reopen a `closed` platform.
 *
 * An invitation and a course code may be supplied TOGETHER: the invitation
 * governs the role, the course code governs enrolment. They agree about
 * everything this function decides, so the invitation branch simply wins and
 * `sponsored` never has to be consulted.
 */
export function evaluateRegistration(
  email: string,
  policy: RegistrationPolicy = DEFAULT_REGISTRATION_POLICY,
  invite: RegistrationInvite | null = null,
  sponsored: RegistrationSponsorship = false
): RegistrationDecision {
  const base: RegistrationDecision = {
    allowed: true,
    requiresEmailVerification: policy.emailVerification,
    requiresApproval: false,
    // The invitation names the role. Public signup can never name its own.
    role: invite?.role ?? policy.defaultRole,
  };

  const reject = (reason: string): RegistrationDecision => ({
    ...base,
    allowed: false,
    reason,
    requiresEmailVerification: false,
    requiresApproval: false,
  });

  if (policy.mode === 'closed') {
    return reject('Registration is currently closed. Contact an administrator for access.');
  }

  if (!emailDomain(email)) {
    return reject('A valid email address is required to register.');
  }

  // Everything below this line is the rules for a stranger. An invited person
  // is not a stranger — an admin already decided about them by name.
  if (invite) return base;

  // A teacher's course code is a door into invite_only, but not into the
  // domain lists below it — those stay the administrator's decision.
  if (policy.mode === 'invite_only' && !sponsored) {
    return reject('Registration is by invitation only. Ask an administrator for an invite.');
  }

  if (domainMatches(email, policy.blockedEmailDomains)) {
    return reject('This email domain is not permitted to register.');
  }

  if (policy.allowedEmailDomains.length > 0 && !domainMatches(email, policy.allowedEmailDomains)) {
    return reject('Registration is limited to approved email domains.');
  }

  const autoApproved = domainMatches(email, policy.autoApproveDomains);
  return {
    ...base,
    // Sponsorship IS the approval — the teacher already reviewed this person by
    // handing them the code, so queueing them for a second review adds nothing.
    requiresApproval: policy.mode === 'approval' && !autoApproved && !sponsored,
  };
}

function parseBoolean(value: string | null | undefined, fallback: boolean): boolean {
  if (value === null || value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

function parseDomainList(value: string | null | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return fallback;
    return normalizeDomainList(parsed.filter((p): p is string => typeof p === 'string'));
  } catch {
    // A hand-edited setting row should not take registration down.
    return fallback;
  }
}

function parseMode(value: string | null | undefined, fallback: RegistrationMode): RegistrationMode {
  const candidate = value?.trim() as RegistrationMode | undefined;
  return candidate && REGISTRATION_MODES.includes(candidate) ? candidate : fallback;
}

function parseRole(value: string | null | undefined, fallback: RegistrationRole): RegistrationRole {
  const candidate = value?.trim() as RegistrationRole | undefined;
  return candidate && REGISTRATION_ROLES.includes(candidate) ? candidate : fallback;
}

export class RegistrationPolicyService {
  /** Read the stored policy, falling back to the defaults key by key. */
  async getPolicy(): Promise<RegistrationPolicy> {
    const [mode, emailVerification, allowed, blocked, autoApprove, defaultRole] = await Promise.all(
      Object.values(REGISTRATION_SETTING_KEYS).map(key => settingsService.getSystemSetting(key))
    );

    return {
      mode: parseMode(mode?.settingValue, DEFAULT_REGISTRATION_POLICY.mode),
      emailVerification: parseBoolean(
        emailVerification?.settingValue,
        DEFAULT_REGISTRATION_POLICY.emailVerification
      ),
      allowedEmailDomains: parseDomainList(
        allowed?.settingValue,
        DEFAULT_REGISTRATION_POLICY.allowedEmailDomains
      ),
      blockedEmailDomains: parseDomainList(
        blocked?.settingValue,
        DEFAULT_REGISTRATION_POLICY.blockedEmailDomains
      ),
      autoApproveDomains: parseDomainList(
        autoApprove?.settingValue,
        DEFAULT_REGISTRATION_POLICY.autoApproveDomains
      ),
      defaultRole: parseRole(defaultRole?.settingValue, DEFAULT_REGISTRATION_POLICY.defaultRole),
    };
  }

  /** Write the supplied fields; untouched fields keep their stored value. */
  async updatePolicy(patch: Partial<RegistrationPolicy>): Promise<RegistrationPolicy> {
    const writes: Array<Promise<unknown>> = [];
    const describedBy = new Map(
      REGISTRATION_DEFAULT_SETTINGS.map(s => [s.settingKey, s] as const)
    );

    type SettingKey = (typeof REGISTRATION_SETTING_KEYS)[keyof typeof REGISTRATION_SETTING_KEYS];

    const write = (key: SettingKey, value: string) => {
      const meta = describedBy.get(key);
      writes.push(
        settingsService.updateSystemSetting(key, value, {
          type: meta?.settingType,
          description: meta?.description,
        })
      );
    };

    if (patch.mode !== undefined) write(REGISTRATION_SETTING_KEYS.mode, patch.mode);
    if (patch.emailVerification !== undefined) {
      write(REGISTRATION_SETTING_KEYS.emailVerification, String(patch.emailVerification));
    }
    if (patch.allowedEmailDomains !== undefined) {
      write(
        REGISTRATION_SETTING_KEYS.allowedEmailDomains,
        JSON.stringify(normalizeDomainList(patch.allowedEmailDomains))
      );
    }
    if (patch.blockedEmailDomains !== undefined) {
      write(
        REGISTRATION_SETTING_KEYS.blockedEmailDomains,
        JSON.stringify(normalizeDomainList(patch.blockedEmailDomains))
      );
    }
    if (patch.autoApproveDomains !== undefined) {
      write(
        REGISTRATION_SETTING_KEYS.autoApproveDomains,
        JSON.stringify(normalizeDomainList(patch.autoApproveDomains))
      );
    }
    if (patch.defaultRole !== undefined) {
      write(REGISTRATION_SETTING_KEYS.defaultRole, patch.defaultRole);
    }

    await Promise.all(writes);
    return this.getPolicy();
  }

  /**
   * Load the policy and decide on one email. `invite` must already have been
   * validated by invitation.service — see RegistrationInvite — and `sponsored`
   * must already have been resolved by courseCodeSignup.service — see
   * RegistrationSponsorship.
   */
  async evaluate(
    email: string,
    invite: RegistrationInvite | null = null,
    sponsored: RegistrationSponsorship = false
  ): Promise<RegistrationDecision> {
    return evaluateRegistration(email, await this.getPolicy(), invite, sponsored);
  }
}

export const registrationPolicyService = new RegistrationPolicyService();
