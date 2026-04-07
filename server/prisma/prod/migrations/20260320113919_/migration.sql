/*
  Warnings:

  - A unique constraint covering the columns `[assignment_id]` on the table `lab_assignments` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "lab_assignments_lab_id_course_id_key";

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "weight" DOUBLE PRECISION DEFAULT 1.0;

-- AlterTable
ALTER TABLE "lab_assignments" ADD COLUMN     "assignment_id" INTEGER;

-- AlterTable
ALTER TABLE "lab_templates" ADD COLUMN     "content" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "lab_assignments_assignment_id_key" ON "lab_assignments"("assignment_id");

-- AddForeignKey
ALTER TABLE "lab_assignments" ADD CONSTRAINT "lab_assignments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
