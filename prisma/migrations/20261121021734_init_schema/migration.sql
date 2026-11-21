-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "image_source" AS ENUM ('ORIGINAL', 'ENHANCED', 'AI_STUDIO');

-- CreateEnum
CREATE TYPE "ai_generation_type" AS ENUM ('TEXT', 'IMAGE_ENHANCE', 'IMAGE_STUDIO');

-- CreateEnum
CREATE TYPE "ai_generation_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "analytics_event_type" AS ENUM ('PAGE_VIEW', 'PRODUCT_VIEW', 'CATEGORY_VIEW', 'WHATSAPP_CLICK');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "store_name" TEXT NOT NULL,
    "logo_key" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#334155',
    "hero_title" TEXT,
    "hero_subtitle" TEXT,
    "hero_image_key" TEXT,
    "hero_cta_label" TEXT,
    "about_text" TEXT,
    "address" TEXT,
    "opening_hours" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "maps_embed_url" TEXT,
    "social_links" JSONB,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "show_featured" BOOLEAN NOT NULL DEFAULT true,
    "show_new_arrivals" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_numbers" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp_number_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "brand" TEXT,
    "status" "product_status" NOT NULL DEFAULT 'DRAFT',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "featured_order" INTEGER,
    "category_id" UUID NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_storage_key" TEXT,
    "source" "image_source" NOT NULL DEFAULT 'ORIGINAL',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generations" (
    "id" UUID NOT NULL,
    "type" "ai_generation_type" NOT NULL,
    "status" "ai_generation_status" NOT NULL DEFAULT 'PENDING',
    "product_id" UUID,
    "admin_user_id" UUID,
    "input_image_key" TEXT NOT NULL,
    "output" JSONB,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "images_count" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "type" "analytics_event_type" NOT NULL,
    "product_id" UUID,
    "category_id" UUID,
    "visitor_hash" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "device_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_numbers_phone_key" ON "whatsapp_numbers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_active_sort_order_idx" ON "categories"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_reference_key" ON "products"("reference");

-- CreateIndex
CREATE INDEX "products_status_category_id_idx" ON "products"("status", "category_id");

-- CreateIndex
CREATE INDEX "products_status_published_at_idx" ON "products"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "products_is_featured_featured_order_idx" ON "products"("is_featured", "featured_order");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_id_position_key" ON "product_images"("product_id", "position");

-- CreateIndex
CREATE INDEX "ai_generations_created_at_idx" ON "ai_generations"("created_at");

-- CreateIndex
CREATE INDEX "ai_generations_product_id_idx" ON "ai_generations"("product_id");

-- CreateIndex
CREATE INDEX "analytics_events_type_created_at_idx" ON "analytics_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_product_id_type_created_at_idx" ON "analytics_events"("product_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_category_id_type_created_at_idx" ON "analytics_events"("category_id", "type", "created_at");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_whatsapp_number_id_fkey" FOREIGN KEY ("whatsapp_number_id") REFERENCES "whatsapp_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═════════════════════════════════════════════════════════════════════════════
-- Règles métier écrites à la main (Prisma ne sait pas les exprimer dans le schéma).
-- ═════════════════════════════════════════════════════════════════════════════

-- Un seul numéro WhatsApp peut être « par défaut » (index unique PARTIEL :
-- ne porte que sur les lignes où is_default = true).
CREATE UNIQUE INDEX "whatsapp_numbers_single_default_key"
  ON "whatsapp_numbers" ("is_default") WHERE "is_default" = true;

-- Numéro au format international, chiffres uniquement, sans « + » ni « 00 » (E.164).
ALTER TABLE "whatsapp_numbers" ADD CONSTRAINT "whatsapp_numbers_phone_format_check"
  CHECK ("phone" ~ '^[1-9][0-9]{7,14}$');

-- 3 photos maximum par produit : positions 0 (principale), 1 et 2.
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_position_check"
  CHECK ("position" BETWEEN 0 AND 2);

-- store_settings ne contient qu'une seule ligne.
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_singleton_check"
  CHECK ("id" = 1);

-- Couleur principale au format #RRGGBB.
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_primary_color_check"
  CHECK ("primary_color" ~ '^#[0-9A-Fa-f]{6}$');

-- ─────────────────────────────── Recherche ───────────────────────────────────
-- unaccent() n'est pas déclarée IMMUTABLE par PostgreSQL, ce qui interdit de
-- l'utiliser dans un index. On l'enveloppe dans une fonction IMMUTABLE en fixant
-- explicitement le dictionnaire utilisé.
--
-- Tous les noms sont qualifiés (public., pg_catalog.) : depuis PostgreSQL 17, la
-- création d'un index s'exécute avec un search_path restreint, et les fonctions
-- non qualifiées ne seraient pas trouvées.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- Document de recherche d'un produit, pondéré :
--   A = nom (le plus important), B = marque + référence, C = description.
-- 'french' applique la racinisation (peintures → peintur) ; 'simple' laisse
-- les références et marques intactes.
CREATE OR REPLACE FUNCTION public.product_search_document(
  p_name text, p_brand text, p_reference text, p_description text
)
  RETURNS tsvector
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT
    setweight(to_tsvector('pg_catalog.french'::regconfig, public.immutable_unaccent(coalesce(p_name, ''))), 'A') ||
    setweight(to_tsvector('pg_catalog.simple'::regconfig, public.immutable_unaccent(coalesce(p_brand, '') || ' ' || coalesce(p_reference, ''))), 'B') ||
    setweight(to_tsvector('pg_catalog.french'::regconfig, public.immutable_unaccent(coalesce(p_description, ''))), 'C')
$$;

-- Index plein texte (recherche par mots).
CREATE INDEX "products_search_fts_idx" ON "products"
  USING GIN (public.product_search_document("name", "brand", "reference", "description"));

-- Index trigrammes sur le nom (tolérance aux fautes de frappe, recherche partielle).
CREATE INDEX "products_name_trgm_idx" ON "products"
  USING GIN (public.immutable_unaccent(lower("name")) public.gin_trgm_ops);
