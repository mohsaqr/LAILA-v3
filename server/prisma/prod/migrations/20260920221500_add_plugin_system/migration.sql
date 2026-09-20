-- CreateTable
CREATE TABLE "plugins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "api_version" INTEGER NOT NULL,
    "description" TEXT,
    "author_name" TEXT,
    "homepage" TEXT,
    "manifest" TEXT NOT NULL,
    "capabilities" TEXT NOT NULL DEFAULT '[]',
    "settings" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'disabled',
    "last_error" TEXT,
    "last_error_at" TIMESTAMP(3),
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "bundle_hash" TEXT NOT NULL,
    "installed_by_id" INTEGER,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_migrations" (
    "id" SERIAL NOT NULL,
    "plugin_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_migrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_store" (
    "id" SERIAL NOT NULL,
    "plugin_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "scope_id" INTEGER NOT NULL DEFAULT 0,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_data" (
    "id" SERIAL NOT NULL,
    "plugin_id" TEXT NOT NULL,
    "extension_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "course_id" INTEGER,
    "instance_key" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "score" DOUBLE PRECISION,
    "max_score" DOUBLE PRECISION,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plugins_enabled_idx" ON "plugins"("enabled");

-- CreateIndex
CREATE INDEX "plugins_status_idx" ON "plugins"("status");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_migrations_plugin_id_name_key" ON "plugin_migrations"("plugin_id", "name");

-- CreateIndex
CREATE INDEX "plugin_store_plugin_id_scope_scope_id_idx" ON "plugin_store"("plugin_id", "scope", "scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_store_plugin_id_scope_scope_id_key_key" ON "plugin_store"("plugin_id", "scope", "scope_id", "key");

-- CreateIndex
CREATE INDEX "plugin_data_plugin_id_course_id_idx" ON "plugin_data"("plugin_id", "course_id");

-- CreateIndex
CREATE INDEX "plugin_data_user_id_idx" ON "plugin_data"("user_id");

-- CreateIndex
CREATE INDEX "plugin_data_course_id_extension_id_idx" ON "plugin_data"("course_id", "extension_id");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_data_plugin_id_user_id_instance_key_key" ON "plugin_data"("plugin_id", "user_id", "instance_key");

-- AddForeignKey
ALTER TABLE "plugins" ADD CONSTRAINT "plugins_installed_by_id_fkey" FOREIGN KEY ("installed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_migrations" ADD CONSTRAINT "plugin_migrations_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_store" ADD CONSTRAINT "plugin_store_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_data" ADD CONSTRAINT "plugin_data_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_data" ADD CONSTRAINT "plugin_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_data" ADD CONSTRAINT "plugin_data_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

