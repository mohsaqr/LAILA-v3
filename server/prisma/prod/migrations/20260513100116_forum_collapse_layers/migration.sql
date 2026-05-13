-- =============================================================================
-- forum_collapse_layers
--
-- Collapses the Forum → ForumThread → ForumPost three-level hierarchy down
-- to a single ForumThread → ForumPost shape. Each existing ForumThread
-- inherits its parent Forum's courseId / moduleId / description /
-- isPublished / allowAnonymous / orderIndex so no data is lost when the
-- "forums" table is dropped.
--
-- IMPORTANT: this file was hand-edited after `prisma migrate dev` to add
-- the explicit data-backfill step (lines marked "manual backfill"). The
-- entire migration runs inside the implicit Postgres transaction Prisma
-- wraps it in — if anything fails, the whole thing rolls back.
-- =============================================================================

-- DropForeignKey
ALTER TABLE "forums" DROP CONSTRAINT "forums_module_id_fkey";

-- DropForeignKey
ALTER TABLE "forums" DROP CONSTRAINT "forums_course_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_threads" DROP CONSTRAINT "forum_threads_forum_id_fkey";

-- DropIndex
DROP INDEX "forum_threads_forum_id_idx";

-- AlterTable — add the new columns nullable so the existing rows survive
-- the schema change. course_id is tightened to NOT NULL after the
-- backfill below.
ALTER TABLE "forum_threads"
  ADD COLUMN "allow_anonymous" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "course_id"       INTEGER,
  ADD COLUMN "description"     TEXT,
  ADD COLUMN "is_published"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "module_id"       INTEGER,
  ADD COLUMN "order_index"     INTEGER NOT NULL DEFAULT 0;

-- Manual backfill — copy the parent Forum's metadata onto every thread.
UPDATE "forum_threads" ft
SET course_id       = f.course_id,
    module_id       = f.module_id,
    description     = f.description,
    is_published    = f.is_published,
    allow_anonymous = f.allow_anonymous,
    order_index     = f.order_index
FROM "forums" f
WHERE ft.forum_id = f.id;

-- Manual backfill — guard: every surviving thread must now have a course.
-- If any orphans existed the migration must fail loudly rather than try
-- to violate the NOT NULL constraint below silently.
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM "forum_threads" WHERE course_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'forum_collapse_layers: % thread(s) have no parent forum — aborting.', orphan_count;
  END IF;
END $$;

-- Now safe to tighten course_id.
ALTER TABLE "forum_threads"
  ALTER COLUMN "course_id" SET NOT NULL;

-- Drop the legacy forum_id column.
ALTER TABLE "forum_threads"
  DROP COLUMN "forum_id";

-- DropTable
DROP TABLE "forums";

-- CreateIndex
CREATE INDEX "forum_threads_course_id_idx" ON "forum_threads"("course_id");

-- CreateIndex
CREATE INDEX "forum_threads_module_id_idx" ON "forum_threads"("module_id");

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
