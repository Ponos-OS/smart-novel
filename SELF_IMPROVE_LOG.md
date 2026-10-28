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

## Step 6 (cover upload backend), 2026-10-28

- Built on request, left uncommitted for review (REQUIREMENTS.md: do not commit each step).
- First e2e run failed on `ECONNREFUSED 127.0.0.1:9000`: the gitignored `.env` still had the pre-Traefik `OBJECT_STORAGE_PUBLIC_URL=http://localhost:9000` while `.env.example` had `http://s3.localhost:8080`. A stale `.env` is an environment fault that looks like a code bug; before debugging a failing e2e that talks to the cluster, diff `.env` against `.env.example`. The one line was changed in `.env` to match.
- RustFS supports `PutBucketCors`, so CORS lives in the bucket init Job (origins derived from `CORS_ALLOWED_ORIGINS`). The bucket enforces the signed content type and, once `content-length` is added to `signableHeaders`, the signed size (both 403 in e2e).
- `signableHeaders` is only widened when a length is given, so the existing Beatrice upload path is unchanged; `beatrice-callbacks.e2e-spec.ts` still passes (10/10).
- Guards run before pipes: a non-UUID id from a non-admin reaches `NovelPolicy`'s `findUnique` and leaks a Prisma error as INTERNAL_SERVER_ERROR (graphql-api-tester). Pre-existing for every policy-guarded mutation with a non-admin caller; not fixed in this step.
- graphql-api-tester: all AC pass; its unknown-novel/bad-key ordering finding was fixed (novel looked up before the key check).

## Step 6 follow-up: merged the object-storage services, 2026-10-28

- `PresignedUploadUrlService`, `ObjectDeleterService` and `ObjectInspectorService` became one `ObjectStorageService` (`generateUploadUrl`, `generateBrowserUploadUrl`, `head`, `delete`) after the user pointed out that each one-method class over the same S3 client was needless. Lesson for the loop: when a step needs a new method on an existing area (Step 1 delete, Step 6 head), add it to the existing class first and split only when there is a reason, instead of a new class per method.
- Unit tests do not cover Nest DI wiring (the `PUBLIC_S3_CLIENT` token and the module exports), so the cover, delete and Beatrice callback e2e specs were rerun after the merge: 30/30.

## Step 6 follow-up: cover validation moved into pipes, 2026-10-28

- The content type and length checks moved from `NovelCoverService` into `CoverContentTypePipe` and `CoverContentLengthPipe` (`novel/pipes`), matching `ParseUuidPipe`/`IsoDateTimePipe`; the service keeps only business checks (novel exists, key belongs to it, object exists and is acceptable).
- Moving the code exposed a bug in my original check: `COVER_CONTENT_TYPE_EXTENSIONS[contentType]` and `contentType in ...` accept `constructor`/`toString` (prototype keys). Both now use `Object.hasOwn`, and the pipe spec covers those values. Lookups into a plain-object map keyed by user input need `Object.hasOwn`.
- Cover e2e rerun after the move: 14/14 (guards run before pipes, so an unauthorized caller still sees forbidden, not the validation message).

## Step 7 (create and edit novel in the UI), 2026-10-28

- Built on request, left uncommitted for review (REQUIREMENTS.md: do not commit each step).
- Followed the routes as written in REQUIREMENTS.md (`/novels/new`, `/novels/:novelId/edit`) even though the existing novel pages live under `/novel/:id`; the mixed singular/plural is flagged to the user, not silently normalised.
- Verified with unit specs (form, both pages, the two entry points), the Storybook build and the type-check; not exercised in a real browser against the stack (the Cypress journey is Step 10).
- Role gating in the UI reads the ZITADEL role keys from the ID token (`writer`/`admin`) in a small `useCanCreateNovel` hook; the backend remains the actual authority.

## Step 8 (delete novel in the UI), 2026-10-28

- Built on request, left uncommitted for review (REQUIREMENTS.md: do not commit each step).
- The type-the-name guard went into `ConfirmDialog` as an optional `confirmationText` prop (additive, existing callers and specs unchanged) instead of building a second dialog.
- "No longer shows on the home or search page" is implemented by removing the novel's query and invalidating the `GetNovels` and `SearchNovels` keys; the specs assert the delete call and navigation but not the cache effect, which the Step 10 Cypress journey covers.
- `nx build-storybook` printed nothing on the first chained run; rerun on its own to see the real result (Nx may also answer from cache, so a successful line there only proves the previous run).

## Step 9 (cover upload in the UI), 2026-10-28

- Built on request, left uncommitted for review (REQUIREMENTS.md: do not commit each step).
- Split into a presentational `NovelCoverConfirmForm` (props only, so Storybook can show picked/uploading/error without the mock-plugin machinery) and a `NovelCoverUpload` container that owns the file, the three calls and the cache refresh.
- The preview object URL is created and revoked inside one `useEffect` keyed on the file; creating it in `useMemo` and revoking in an effect cleanup would revoke a URL still in use under React StrictMode's double effect run.
- Unit specs mock `fetch` and the two mutations, so the real browser `PUT`, CORS and the cover showing on the novel page and the cards are only covered by the Step 10 Cypress journey; nothing here was run in a browser.
