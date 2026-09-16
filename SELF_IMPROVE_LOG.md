# Self-Improvement Log

## Step 1 (Create Chapter — backend repository + service) — 2026-09-16

Added `createChapter` to `IChapterRepository`/`PrismaChapterRepository` and
`ChapterService`. Hit a Prisma typing footgun creating `Chapter` +
`ChapterContent` together: passing the scalar `novelId` alongside a nested
`content: { create }` write fails to typecheck because Prisma picks the
`ChapterUncheckedCreateInput` variant. Fixed by using
`novel: { connect: { id: novelId } }` instead. Logged as a reusable gotcha in
`.github/docs/gotchas.md` (not a process change — nothing about the step loop
itself needed adjusting this pass).
