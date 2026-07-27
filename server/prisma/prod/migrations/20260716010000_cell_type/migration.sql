-- Markdown cells: cell_type discriminator ("code" | "markdown"), additive with default.
ALTER TABLE "code_blocks" ADD COLUMN "cell_type" TEXT NOT NULL DEFAULT 'code';
ALTER TABLE "lab_templates" ADD COLUMN "cell_type" TEXT NOT NULL DEFAULT 'code';
