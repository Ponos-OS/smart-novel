-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "NarrationStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "NovelState" AS ENUM ('ONGOING', 'FINISHED');

-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('APPROVED', 'PENDING');

-- CreateEnum
CREATE TYPE "LicenseSourceType" AS ENUM ('CANONICAL', 'FORKED', 'CUSTOM');

-- CreateTable
CREATE TABLE "licenses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "text_hash" TEXT,
    "source_type" "LicenseSourceType" NOT NULL,
    "canonical_id" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" TEXT NOT NULL DEFAULT 'system',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novels" (
    "id" UUID NOT NULL,
    "owner_id" TEXT NOT NULL,
    "license_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "state" "NovelState" NOT NULL DEFAULT 'ONGOING',
    "cover_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "novels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" UUID NOT NULL,
    "novel_id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "narration_status" "NarrationStatus",
    "narration_url" TEXT,
    "chapter_number" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_contents" (
    "id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "content_tsv" tsvector,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chapter_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CategoryStatus" NOT NULL DEFAULT 'APPROVED',
    "requester_user_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_categories" (
    "novel_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "novel_categories_pkey" PRIMARY KEY ("novel_id","category_id")
);

-- CreateTable
CREATE TABLE "chapter_user_states" (
    "user_id" TEXT NOT NULL,
    "novel_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "first_read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_user_states_pkey" PRIMARY KEY ("user_id","chapter_id")
);

-- CreateTable
CREATE TABLE "platform_terms_acceptances" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "terms_version" INTEGER NOT NULL,
    "accepted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_terms_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "licenses_owner_id_text_hash_key" ON "licenses"("owner_id", "text_hash");

-- CreateIndex
CREATE INDEX "IDX_novels_owner" ON "novels"("owner_id");

-- CreateIndex
CREATE INDEX "IDX_novels_license" ON "novels"("license_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_content_id_key" ON "chapters"("content_id");

-- CreateIndex
CREATE INDEX "IDX_chapters_novel" ON "chapters"("novel_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_id_novel_id_key" ON "chapters"("id", "novel_id");

-- CreateIndex
CREATE INDEX "chapter_contents_content_tsv_idx" ON "chapter_contents" USING GIN ("content_tsv");

-- CreateIndex
CREATE INDEX "chapter_contents_content_hash_idx" ON "chapter_contents"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "IDX_categories_status_name" ON "categories"("status", "name");

-- CreateIndex
CREATE INDEX "IDX_novel_categories_novel" ON "novel_categories"("novel_id");

-- CreateIndex
CREATE INDEX "IDX_novel_categories_category" ON "novel_categories"("category_id");

-- CreateIndex
CREATE INDEX "IDX_chapter_user_states_novel" ON "chapter_user_states"("novel_id");

-- CreateIndex
CREATE INDEX "IDX_chapter_user_states_user_novel" ON "chapter_user_states"("user_id", "novel_id");

-- CreateIndex
CREATE INDEX "IDX_chapter_user_states_novel_chapter" ON "chapter_user_states"("novel_id", "chapter_id");

-- CreateIndex
CREATE INDEX "IDX_platform_terms_acceptances_user" ON "platform_terms_acceptances"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_terms_acceptances_user_id_terms_version_key" ON "platform_terms_acceptances"("user_id", "terms_version");

-- AddForeignKey
ALTER TABLE "novels" ADD CONSTRAINT "novels_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "chapter_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_categories" ADD CONSTRAINT "novel_categories_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_categories" ADD CONSTRAINT "novel_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_user_states" ADD CONSTRAINT "chapter_user_states_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_user_states" ADD CONSTRAINT "chapter_user_states_chapter_id_novel_id_fkey" FOREIGN KEY ("chapter_id", "novel_id") REFERENCES "chapters"("id", "novel_id") ON DELETE CASCADE ON UPDATE CASCADE;
