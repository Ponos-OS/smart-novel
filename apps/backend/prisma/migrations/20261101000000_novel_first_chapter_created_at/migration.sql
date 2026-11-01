-- AlterTable
ALTER TABLE "novels" ADD COLUMN "first_chapter_created_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "IDX_novels_first_chapter_created_at" ON "novels"("first_chapter_created_at", "id");
