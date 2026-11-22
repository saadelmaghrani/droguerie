-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "meta_pixel_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "meta_pixel_id" TEXT;
