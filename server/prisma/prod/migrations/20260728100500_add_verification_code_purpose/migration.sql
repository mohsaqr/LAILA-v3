-- AlterTable
ALTER TABLE "verification_codes" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'signup';
