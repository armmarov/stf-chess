-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('book', 'homework', 'app');

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "type" "ResourceType" NOT NULL,
    "description" TEXT,
    "image_path" TEXT,
    "file_path" TEXT,
    "file_name" VARCHAR(255),
    "file_mime" VARCHAR(100),
    "url" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resources_type_idx" ON "resources"("type");

-- CreateIndex
CREATE INDEX "resources_is_enabled_idx" ON "resources"("is_enabled");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
