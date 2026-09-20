-- CreateTable
CREATE TABLE "lti_tools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "client_id" TEXT NOT NULL,
    "deployment_id" TEXT NOT NULL,
    "login_url" TEXT NOT NULL,
    "target_link_uri" TEXT NOT NULL,
    "redirect_uris" TEXT NOT NULL,
    "jwks_url" TEXT,
    "public_key_pem" TEXT,
    "deep_linking_url" TEXT,
    "send_pii" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lti_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lti_launches" (
    "id" TEXT NOT NULL,
    "tool_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "course_id" INTEGER,
    "section_id" INTEGER,
    "message_type" TEXT NOT NULL,
    "nonce" TEXT,
    "consumed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lti_launches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lti_tools_client_id_key" ON "lti_tools"("client_id");

-- CreateIndex
CREATE INDEX "lti_tools_is_active_idx" ON "lti_tools"("is_active");

-- CreateIndex
CREATE INDEX "lti_launches_expires_at_idx" ON "lti_launches"("expires_at");

-- CreateIndex
CREATE INDEX "lti_launches_tool_id_idx" ON "lti_launches"("tool_id");

-- CreateIndex
CREATE INDEX "lti_launches_user_id_idx" ON "lti_launches"("user_id");

-- AddForeignKey
ALTER TABLE "lti_tools" ADD CONSTRAINT "lti_tools_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lti_launches" ADD CONSTRAINT "lti_launches_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "lti_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lti_launches" ADD CONSTRAINT "lti_launches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

