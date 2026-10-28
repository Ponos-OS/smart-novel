## Step 1 (deleteChapter), 2026-10-28

- REQUIREMENTS.md says not to commit each step, so nothing was committed; the working tree is left for review.
- The requirements claimed Prisma cascades cover deleting a chapter; `Chapter.content` cascades content-to-chapter only, so the transaction deletes the `ChapterContent` row itself. Step 4 has the same gap. Added a "verify schema claims" note to PROCESS.md.
- A prepend via `open(p,'w').write(x + open(p).read())` truncated `object-storage/services/index.ts`; unit tests still passed (vitest does not typecheck), `tsc --noEmit` caught it. Added a tsc note to PROCESS.md.
- `nx e2e backend-e2e` took over 10 minutes and was moved to the background. New spec passed 9/9; 5 other tests failed (3 narration timeouts and 1 LLM explain, known environment class; `novel.e2e-spec` `lastPublishedChapter` raced with chapters created by `chapter.e2e-spec`, not by the new spec; not re-run on main to confirm).
- graphql-api-tester: all AC pass; unknown id has message "not found" but `extensions.code` INTERNAL_SERVER_ERROR (existing formatter only maps 409).

## Step 2 (delete chapter in the UI), 2026-10-28

- Built on request, left uncommitted for review (REQUIREMENTS.md: do not commit each step).
- `eslint --fix` run from a sub-directory with repo-relative paths silently matched nothing; the prettier errors only showed on the next root-level lint. Run eslint from the repo root.
- Existing `frontend-e2e` suite not run: the step's Test section skips Cypress (permission boundary covered by `backend-e2e`).
- `ChapterList` is only rendered by `ChapterListPage`, so the "deleted chapter is the one being read" branch has no host today and was not implemented.

## Step 3 (createNovel and updateNovel), 2026-10-28

- Built on request, left uncommitted for review (REQUIREMENTS.md: do not commit each step).
- Running a single `backend-e2e` spec with plain `vitest run` also starts/tears down its own cluster (exit 3 against an existing one); PROCESS.md now says how to reuse a cluster with a throwaway config.
- New e2e novels cannot be deleted until Step 4 and existing specs filter on `fantasy`/`adventure` and read `edges[0]`, so the new spec only uses unique `e2e-*` category names. The sibling novel specs passed alongside it.
- An invalid enum value is rejected by GraphQL with HTTP 400 before any resolver runs; e2e helpers need `validateStatus: () => true` for that case.
- graphql-api-tester: all AC pass; unknown id has message "not found" but code INTERNAL_SERVER_ERROR (existing formatter, same as Step 1).

## Step 4 (deleteNovel), 2026-10-28

- Built on request, left uncommitted for review (REQUIREMENTS.md: do not commit each step).
- Same orphan gap as Step 1 (chapter content cascades content-to-chapter only), so the transaction deletes the contents explicitly. GraphQL cannot show orphaned rows, so `ClusterFixture.queryDatabase` (psql via `kubectl exec deploy/postgres`) was added to assert the cascade in `backend-e2e`.
- The throwaway single-spec vitest config (globalSetup disabled) from Step 3 worked again, with the cluster started via `start-dev.sh e2e`; it let me run the new spec, the Step 3 spec and the graphql-api-tester against one cluster.
- Cover and narration objects both go through `ChapterNarrationService.deleteAudio` so the one alert message covers both; the cover is only set from Step 6 on, so the cover path is unit-tested only.
- graphql-api-tester: all AC pass; not-found has code INTERNAL_SERVER_ERROR (existing formatter).

## Step 5 (Grafana alert for failed audio removals), 2026-10-28

- Built on request, left uncommitted for review (REQUIREMENTS.md: do not commit each step).
- The step assumed the backend's logs are in Loki, but the collector has only a traces pipeline and nothing ships pod logs, so the rule is valid but has no data until a log shipper exists. Checking that the signal an alert queries is actually produced (here: grep the collector pipelines and log exporters) belongs before writing the rule.
- Verified live: the rule loads, is healthy with no data, and goes straight to firing (severity warning) once a matching line is pushed to Loki by hand (`for: 0s`, so no pending phase). `terraform test` passes for `observability` and `app`.
- `start:dev`/`stop:dev` ran once, not twice, for the idempotence check in PROCESS.md; the user is asked to repeat it.
