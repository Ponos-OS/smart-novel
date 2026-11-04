-- Rename categories to tags, keeping rows, and add the tag description.
ALTER TYPE "CategoryStatus" RENAME TO "TagStatus";

ALTER TABLE "categories" RENAME TO "tags";
ALTER TABLE "novel_categories" RENAME TO "novel_tags";
ALTER TABLE "novel_tags" RENAME COLUMN "category_id" TO "tag_id";

ALTER TABLE "tags" RENAME CONSTRAINT "categories_pkey" TO "tags_pkey";
ALTER TABLE "novel_tags" RENAME CONSTRAINT "novel_categories_pkey" TO "novel_tags_pkey";
ALTER TABLE "novel_tags" RENAME CONSTRAINT "novel_categories_novel_id_fkey" TO "novel_tags_novel_id_fkey";
ALTER TABLE "novel_tags" RENAME CONSTRAINT "novel_categories_category_id_fkey" TO "novel_tags_tag_id_fkey";

ALTER INDEX "categories_name_key" RENAME TO "tags_name_key";
ALTER INDEX "IDX_categories_status_name" RENAME TO "IDX_tags_status_name";
ALTER INDEX "IDX_novel_categories_novel" RENAME TO "IDX_novel_tags_novel";
ALTER INDEX "IDX_novel_categories_category" RENAME TO "IDX_novel_tags_tag";

ALTER TABLE "tags" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
