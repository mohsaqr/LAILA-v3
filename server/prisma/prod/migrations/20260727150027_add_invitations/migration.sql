-- Admin-issued invitations: permission for one named person (or, when email is
-- NULL, whoever holds the link) to register while the platform is not open to
-- the public.
--
-- code_digest holds an HMAC-SHA256 of the short human-readable code, never the
-- code itself; the plaintext is returned exactly once at creation. code_hint
-- keeps the last four characters so an admin can identify a code in a list
-- without that list becoming redeemable. The UNIQUE index on code_digest is
-- what makes redeem-by-code a single indexed lookup.
--
-- use_count/max_uses bound reuse and are advanced by a single conditional
-- UPDATE (WHERE use_count < max_uses), so two simultaneous redemptions of a
-- single-use invitation cannot both succeed.
--
-- revoked_at is deliberately separate from expires_at: "an admin withdrew this"
-- and "this aged out" are different answers to give the holder, and the admin
-- list renders them as distinct statuses.
--
-- Pure addition: one new table plus two foreign keys. No existing table is
-- altered, so this is safe to apply to a populated database.

-- CreateTable
CREATE TABLE "invitations" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'student',
    "course_id" INTEGER,
    "token" TEXT NOT NULL,
    "code_digest" TEXT,
    "code_hint" TEXT,
    "invited_by_id" INTEGER NOT NULL,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_code_digest_key" ON "invitations"("code_digest");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_invited_by_id_idx" ON "invitations"("invited_by_id");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
