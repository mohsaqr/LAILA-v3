-- AlterTable
ALTER TABLE "course_modules" ADD COLUMN     "parent_id" INTEGER;

-- CreateIndex
CREATE INDEX "course_modules_parent_id_idx" ON "course_modules"("parent_id");

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
