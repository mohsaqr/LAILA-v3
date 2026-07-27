// Seed (or repair) a real admin account that works with the normal login form.
//
// LAILA's login is email + password — there is no username field — so the
// "username" for an admin is simply their email address.
//
// Usage (run from the server/ directory so @prisma/client and DATABASE_URL
// resolve against this package):
//
//   node --env-file=.env scripts/seed-admin.mjs
//   SEED_ADMIN_EMAIL=you@example.com node --env-file=.env scripts/seed-admin.mjs
//   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='S3cret!Pass1' \
//     node --env-file=.env scripts/seed-admin.mjs
//
// LIST MODE — show the existing admins without changing anything:
//   node --env-file=.env scripts/seed-admin.mjs --list
//
// SAFE RE-RUN: for an account that already exists this only ensures it is an
// active, confirmed, approved, unlocked admin. It does NOT touch the password
// unless you explicitly pass SEED_ADMIN_PASSWORD or SEED_ADMIN_RESET=1, so a
// bare re-run can never clobber a password someone set later.
//
// Passwords are bcrypt-hashed with the same cost factor as auth.service.ts, and
// are one-way: an existing password cannot be recovered, only replaced.

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Mirrors registerSchema in utils/validation.ts, so a seeded password is one the login form would also accept. */
function passwordComplaint(pw) {
  if (pw.length < 8) return 'must be at least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'must contain an uppercase letter';
  if (!/[a-z]/.test(pw)) return 'must contain a lowercase letter';
  if (!/[0-9]/.test(pw)) return 'must contain a number';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw)) return 'must contain a special character';
  return null;
}

try {
  if (process.argv.includes('--list')) {
    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: {
        id: true, email: true, fullname: true, isActive: true,
        isConfirmed: true, status: true, lockedUntil: true, lastLogin: true,
      },
      orderBy: { id: 'asc' },
    });
    if (admins.length === 0) {
      console.log('No admin accounts exist. Run without --list to create one.');
    } else {
      console.log(`${admins.length} admin account(s) — sign in with the email as the username:\n`);
      for (const a of admins) {
        const blocked = [
          !a.isConfirmed && 'UNVERIFIED',
          a.status !== 'active' && a.status.toUpperCase(),
          !a.isActive && 'DEACTIVATED',
          a.lockedUntil && a.lockedUntil > new Date() && 'LOCKED',
        ].filter(Boolean);
        console.log(`  ${a.email}  (${a.fullname})`);
        console.log(
          `    id=${a.id}  last login: ${a.lastLogin?.toISOString().slice(0, 16) ?? 'never'}` +
          (blocked.length ? `  ⚠ cannot sign in: ${blocked.join(', ')}` : '  ✔ can sign in')
        );
      }
      console.log('\nPasswords are bcrypt-hashed and cannot be read back. To set a new one:');
      console.log("  SEED_ADMIN_EMAIL=<email> SEED_ADMIN_PASSWORD='<new>' node --env-file=.env scripts/seed-admin.mjs");
    }
    process.exit(0);
  }

  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@laila.local').trim().toLowerCase();
  const explicitPassword = process.env.SEED_ADMIN_PASSWORD;
  const forceReset = process.env.SEED_ADMIN_RESET === '1' || Boolean(explicitPassword);
  const password = explicitPassword || 'Admin123!';

  const complaint = passwordComplaint(password);
  if (complaint) {
    console.error(`✖ password ${complaint} — the login form enforces the same rules.`);
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const user = await prisma.user.create({
      data: {
        email,
        fullname: 'Administrator',
        passwordHash: await bcrypt.hash(password, 10),
        isAdmin: true,
        isActive: true,
        isConfirmed: true,
        status: 'active',
      },
    });
    console.log(`✔ created admin ${user.email}`);
    console.log(`  password: ${password}`);
    if (!explicitPassword) console.log('  ⚠ this is the default password — change it after signing in.');
  } else {
    // Always repair the gates that block sign-in; touch the password only on request.
    const user = await prisma.user.update({
      where: { email },
      data: {
        isAdmin: true,
        isActive: true,
        isConfirmed: true,
        status: 'active',
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(forceReset
          ? { passwordHash: await bcrypt.hash(password, 10), tokenVersion: { increment: 1 } }
          : {}),
      },
    });
    console.log(`✔ ${user.email} is an active, confirmed, approved, unlocked admin`);
    if (forceReset) {
      console.log(`  password reset to: ${password}`);
      console.log('  existing sessions for this account were invalidated (tokenVersion bumped)');
    } else {
      console.log('  password left unchanged — pass SEED_ADMIN_PASSWORD=... to reset it');
    }
  }
} finally {
  await prisma.$disconnect();
}
