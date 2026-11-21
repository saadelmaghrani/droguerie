-- AlterEnum
ALTER TYPE "ai_generation_type" ADD VALUE 'IMAGE_SCENE';

-- AlterEnum
ALTER TYPE "image_source" ADD VALUE 'AI_GENERATED';

-- AlterTable
ALTER TABLE "ai_generations" ADD COLUMN     "draft_id" UUID;

-- CreateTable
CREATE TABLE "product_drafts" (
    "id" UUID NOT NULL,
    "original_key" TEXT NOT NULL,
    "original_width" INTEGER NOT NULL,
    "original_height" INTEGER NOT NULL,
    "admin_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "product_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_drafts_created_at_idx" ON "product_drafts"("created_at");

-- CreateIndex
CREATE INDEX "ai_generations_draft_id_idx" ON "ai_generations"("draft_id");
