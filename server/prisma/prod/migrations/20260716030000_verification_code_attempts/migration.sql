-- Add a per-code failed-attempt counter so 6-digit reset/verify codes can't be
-- brute-forced within their validity window (P2-4). The code is invalidated
-- once attempts exceed the allowed maximum.
ALTER TABLE "verification_codes" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
