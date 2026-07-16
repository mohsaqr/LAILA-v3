-- Lab notebook: locked cells + per-lab AI assistant.
-- All columns are additive with safe defaults; existing rows are unaffected.

ALTER TABLE "code_blocks" ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "lab_templates" ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "code_labs" ADD COLUMN "ai_chatbot_id" INTEGER;
ALTER TABLE "custom_labs" ADD COLUMN "ai_chatbot_id" INTEGER;

ALTER TABLE "code_labs" ADD CONSTRAINT "code_labs_ai_chatbot_id_fkey"
  FOREIGN KEY ("ai_chatbot_id") REFERENCES "chatbots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "custom_labs" ADD CONSTRAINT "custom_labs_ai_chatbot_id_fkey"
  FOREIGN KEY ("ai_chatbot_id") REFERENCES "chatbots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
