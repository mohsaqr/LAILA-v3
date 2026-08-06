-- CreateTable
CREATE TABLE "llm_usage" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "course_id" INTEGER,
    "provider_id" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'llm_service',
    "module" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "cost_usd" DOUBLE PRECISION,
    "usage_missing" BOOLEAN NOT NULL DEFAULT false,
    "clamped" BOOLEAN NOT NULL DEFAULT false,
    "requested_max_tokens" INTEGER,
    "granted_max_tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_usage_user_id_created_at_idx" ON "llm_usage"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "llm_usage_course_id_created_at_idx" ON "llm_usage"("course_id", "created_at");

-- CreateIndex
CREATE INDEX "llm_usage_created_at_idx" ON "llm_usage"("created_at");
