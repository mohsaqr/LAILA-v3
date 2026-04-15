-- AlterTable
ALTER TABLE "learning_activity_logs" ADD COLUMN     "action_subtype" TEXT,
ADD COLUMN     "event_uuid" TEXT,
ADD COLUMN     "route" TEXT;

-- CreateIndex
CREATE INDEX "learning_activity_logs_action_subtype_idx" ON "learning_activity_logs"("action_subtype");

-- CreateIndex
CREATE INDEX "learning_activity_logs_timestamp_desc_idx" ON "learning_activity_logs"("timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "learning_activity_logs_user_id_event_uuid_key" ON "learning_activity_logs"("user_id", "event_uuid");
