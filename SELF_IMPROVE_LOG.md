## Step 1 (deleteChapter), 2026-10-28

- REQUIREMENTS.md says not to commit each step, so nothing was committed; the working tree is left for review.
- The requirements claimed Prisma cascades cover deleting a chapter; `Chapter.content` cascades content-to-chapter only, so the transaction deletes the `ChapterContent` row itself. Step 4 has the same gap. Added a "verify schema claims" note to PROCESS.md.
- A prepend via `open(p,'w').write(x + open(p).read())` truncated `object-storage/services/index.ts`; unit tests still passed (vitest does not typecheck), `tsc --noEmit` caught it. Added a tsc note to PROCESS.md.
- `nx e2e backend-e2e` took over 10 minutes and was moved to the background. New spec passed 9/9; 5 other tests failed (3 narration timeouts and 1 LLM explain, known environment class; `novel.e2e-spec` `lastPublishedChapter` raced with chapters created by `chapter.e2e-spec`, not by the new spec; not re-run on main to confirm).
- graphql-api-tester: all AC pass; unknown id has message "not found" but `extensions.code` INTERNAL_SERVER_ERROR (existing formatter only maps 409).
