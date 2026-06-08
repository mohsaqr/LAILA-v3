-- AlterTable: availability window (available_from / available_until)
ALTER TABLE "lectures"       ADD COLUMN "available_from" TIMESTAMP(3), ADD COLUMN "available_until" TIMESTAMP(3);
ALTER TABLE "code_labs"      ADD COLUMN "available_from" TIMESTAMP(3), ADD COLUMN "available_until" TIMESTAMP(3);
ALTER TABLE "forum_threads"  ADD COLUMN "available_from" TIMESTAMP(3), ADD COLUMN "available_until" TIMESTAMP(3);
ALTER TABLE "course_modules" ADD COLUMN "available_from" TIMESTAMP(3), ADD COLUMN "available_until" TIMESTAMP(3);
ALTER TABLE "assignments"    ADD COLUMN "available_from" TIMESTAMP(3), ADD COLUMN "available_until" TIMESTAMP(3);
ALTER TABLE "quizzes"        ADD COLUMN "available_until" TIMESTAMP(3);
