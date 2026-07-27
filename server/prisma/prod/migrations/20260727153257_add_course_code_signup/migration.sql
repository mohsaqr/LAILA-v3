-- Course activation codes become globally unique, so that signup can resolve a
-- typed-in code to a course.
--
-- WHY THIS IS NOT A PURE STRUCTURE CHANGE — READ BEFORE APPROVING.
-- courses.activation_code is a POPULATED column whose values were generated at
-- random (8 chars from a 32-symbol alphabet) and were NEVER constrained. Adding
-- a UNIQUE index to it can therefore fail on a real database. This migration
-- REWRITES DATA in courses.activation_code before it touches the index:
--
--   Step 1 normalises. Codes are compared case-insensitively everywhere in the
--          application (enrollment.service uppercases both sides), and
--          course.service already uppercases codes at creation. A legacy
--          lower/mixed-case row therefore MEANS the same code as its uppercase
--          twin, while a plain UNIQUE index would happily keep both. Uppercasing
--          first makes the index enforce the identity the app actually uses.
--          Blank strings become NULL for the same reason: '' is not a code, and
--          two of them would collide for no reason.
--
--   Step 2 resolves collisions, including any that step 1 just created. For
--          each set of rows sharing a code the LOWEST id keeps it — that is the
--          oldest course, the one whose code is most likely already printed on
--          a syllabus — and every other row is given a fresh code.
--          The replacement is DETERMINISTIC, not random: md5() over the row's
--          own id plus an attempt counter, mapped byte-by-byte onto the same
--          ambiguity-free alphabet course.service uses (no 0/O, no 1/I).
--          Re-running this migration on the same data therefore produces the
--          same codes. Each candidate is CHECKED against the whole column
--          before it is written and the attempt counter advances on a hit, so
--          the loop cannot install a code that collides with an existing one or
--          with another row it has already rewritten. It raises rather than
--          spins if it somehow cannot find a free code.
--
--   Step 3 finally creates the unique index. NULLs are unaffected: Postgres
--          permits any number of NULLs under a UNIQUE index, so courses with no
--          activation code stay as they are.
--
-- Teachers whose course lost a collision will see a NEW activation code in the
-- course settings and must reshare it. The alternative — failing the deploy —
-- is worse.
--
-- No separate plain index is created: the unique index on (activation_code) is
-- a btree and already serves the equality lookup signup performs.
--
-- BEFORE DEPLOYING, run this read-only check against production to see whether
-- any of the above will actually fire:
--
--   SELECT upper(btrim(activation_code)) AS code,
--          count(*) AS n,
--          array_agg(id ORDER BY id) AS course_ids
--   FROM courses
--   WHERE activation_code IS NOT NULL AND btrim(activation_code) <> ''
--   GROUP BY 1
--   HAVING count(*) > 1
--   ORDER BY n DESC;
--
-- An empty result means this migration only adds an index.
--
-- SCOPE NOTE: generate-prod-migration.sh diffs against git HEAD, and the
-- registration-policy / user-status / invitations work is still uncommitted, so
-- the generated diff re-emitted their DDL too. That DDL already ships in
-- 20260727141759_add_user_status and 20260727150027_add_invitations and has
-- been trimmed out of this file — the same treatment the invitations migration
-- received.

-- Step 1: normalise. Trim + uppercase every code, and turn blanks into NULL.
UPDATE "courses"
SET "activation_code" = NULLIF(upper(btrim("activation_code")), '')
WHERE "activation_code" IS NOT NULL
  AND "activation_code" IS DISTINCT FROM NULLIF(upper(btrim("activation_code")), '');

-- Step 2: deterministically re-code every duplicate except the lowest id.
DO $$
DECLARE
  -- Same alphabet as CourseService.generateActivationCode: 32 symbols with the
  -- look-alikes (0/O, 1/I) removed. Exactly 32 is what makes `% 32` uniform.
  alphabet CONSTANT text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code_length CONSTANT int := 8;
  max_attempts CONSTANT int := 10000;
  dup RECORD;
  digest bytea;
  candidate text;
  attempt int;
  i int;
BEGIN
  FOR dup IN
    SELECT c."id"
    FROM "courses" c
    WHERE c."activation_code" IS NOT NULL
      AND c."id" <> (
        SELECT min(k."id") FROM "courses" k WHERE k."activation_code" = c."activation_code"
      )
    ORDER BY c."id"
  LOOP
    attempt := 0;
    LOOP
      -- Deterministic seed: this row's id and how many candidates it has
      -- already burned. md5() is used purely as a fixed byte generator here,
      -- not as a security primitive.
      digest := decode(
        md5('laila-course-activation-code:v1:' || dup."id"::text || ':' || attempt::text),
        'hex'
      );
      candidate := '';
      FOR i IN 0..(code_length - 1) LOOP
        -- get_byte gives 0..255; 256 is a whole multiple of 32, so the fold is
        -- uniform across the alphabet. substr is 1-indexed.
        candidate := candidate || substr(alphabet, (get_byte(digest, i) % 32) + 1, 1);
      END LOOP;

      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM "courses" WHERE "activation_code" = candidate
      );

      attempt := attempt + 1;
      IF attempt >= max_attempts THEN
        RAISE EXCEPTION
          'Could not find a free activation code for course % after % attempts',
          dup."id", max_attempts;
      END IF;
    END LOOP;

    UPDATE "courses" SET "activation_code" = candidate WHERE "id" = dup."id";
    RAISE NOTICE 'courses.activation_code: course % was a duplicate and has been re-coded', dup."id";
  END LOOP;
END $$;

-- Step 3: the structure change itself.
-- CreateIndex
CREATE UNIQUE INDEX "courses_activation_code_key" ON "courses"("activation_code");
