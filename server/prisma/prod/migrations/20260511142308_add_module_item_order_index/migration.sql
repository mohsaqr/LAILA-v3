-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "order_index" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "module_surveys" ADD COLUMN     "order_index" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "order_index" INTEGER NOT NULL DEFAULT 0;
