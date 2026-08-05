-- AlterTable
ALTER TABLE "lab_assignments" ADD COLUMN     "is_published" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "order_index" INTEGER NOT NULL DEFAULT 0;
