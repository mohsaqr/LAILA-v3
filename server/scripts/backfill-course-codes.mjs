// Give an activation code to every course that has none.
//
// courseService.createCourse generates a code for each new course, but courses
// created before that existed have activation_code = NULL. Signing up with a
// course code, and the code chip on the course page, are both dead for those
// courses until they have one — which is not obvious from the UI, it simply
// looks broken.
//
// Usage (from server/):
//   node --env-file=.env scripts/backfill-course-codes.mjs --dry-run
//   node --env-file=.env scripts/backfill-course-codes.mjs
//
// Codes use the same 32-symbol ambiguity-free alphabet as
// CourseService.generateActivationCode (no 0/O, no 1/I), and each candidate is
// checked against the live column before it is written — activation_code is
// UNIQUE, so a collision would otherwise abort the run.

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

const generate = () =>
  Array.from(crypto.randomBytes(CODE_LENGTH), b => ALPHABET[b % ALPHABET.length]).join('');

try {
  const missing = await prisma.course.findMany({
    where: { OR: [{ activationCode: null }, { activationCode: '' }] },
    select: { id: true, title: true },
    orderBy: { id: 'asc' },
  });

  if (missing.length === 0) {
    console.log('Every course already has an activation code — nothing to do.');
    process.exit(0);
  }

  console.log(`${missing.length} course(s) without a code${DRY_RUN ? ' (dry run)' : ''}:\n`);

  // Hold the codes we assign in this run too: they are not yet visible to the
  // uniqueness query for rows written later in the same loop on some engines,
  // and it costs nothing to be certain.
  const assigned = new Set();

  for (const course of missing) {
    let code;
    for (let attempt = 0; ; attempt++) {
      if (attempt >= 100) throw new Error(`could not find a free code for course ${course.id}`);
      code = generate();
      if (assigned.has(code)) continue;
      const clash = await prisma.course.findFirst({
        where: { activationCode: code },
        select: { id: true },
      });
      if (!clash) break;
    }
    assigned.add(code);

    if (!DRY_RUN) {
      await prisma.course.update({ where: { id: course.id }, data: { activationCode: code } });
    }
    console.log(`  ${code}  ${course.title}  (id ${course.id})`);
  }

  console.log(
    DRY_RUN
      ? '\nDry run — nothing was written. Re-run without --dry-run to apply.'
      : `\n✔ assigned ${missing.length} code(s). They are visible to instructors on each course page.`
  );
} finally {
  await prisma.$disconnect();
}
