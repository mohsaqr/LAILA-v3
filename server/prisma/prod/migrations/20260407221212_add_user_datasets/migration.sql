-- CreateTable
CREATE TABLE "user_datasets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "agent_config_id" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "file_type" TEXT,
    "row_count" INTEGER,
    "ai_model" TEXT,
    "ai_provider" TEXT,
    "agent_prompt" TEXT,
    "generation_config" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_datasets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_datasets_user_id_idx" ON "user_datasets"("user_id");

-- CreateIndex
CREATE INDEX "user_datasets_agent_config_id_idx" ON "user_datasets"("agent_config_id");

-- AddForeignKey
ALTER TABLE "user_datasets" ADD CONSTRAINT "user_datasets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_datasets" ADD CONSTRAINT "user_datasets_agent_config_id_fkey" FOREIGN KEY ("agent_config_id") REFERENCES "student_agent_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
