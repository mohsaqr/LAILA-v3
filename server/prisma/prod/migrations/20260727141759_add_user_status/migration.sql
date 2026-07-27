-- Registration lifecycle for a user account: 'active' | 'pending_approval' |
-- 'rejected'. Backs the admin approval queue (registration mode = approval).
--
-- Deliberately NOT the existing is_active boolean: is_active=false means "an
-- admin switched this account off", status='pending_approval' means "this
-- applicant has never been let in yet". They are orthogonal gates and produce
-- different login errors.
--
-- DEFAULT 'active' means every existing row is unaffected — the column is a
-- pure addition and the migration is safe to replay on a populated database.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");
