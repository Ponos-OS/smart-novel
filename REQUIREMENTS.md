**IMPORTANT**: Do **NOT** commit any step before I review them first.

I want to have nightly k6 load test of the GraphQL operations the UI sends, with thresholds that fail the run when response time or error rate degrades.

Out of scope: Beatrice & Fithara operations, load against real providers.

Decisions:

- Tool: k6. Scripts in `apps/backend-stress`. Load operations by their name from `apps/frontend/src/**/*.graphql` (k6 `open()` in the init stage, sent with `operationName`), so the stress test follows what the UI sends. The scripts only hold variables and flow logic.
- Output: the k6 end-of-test summary is printed to stdout and appended to `$GITHUB_STEP_SUMMARY`. No artifacts, no HTML report, nothing committed.
- Thresholds start generous. I might later tighten it later myself.
- The seeder moves to its own Go module, `apps/backend/tools` (listed in `go.work`), and `cmd/devdata` is removed in favour of `apps/backend/tools/devdata`. Bulk data comes from `gofakeit` with a fixed seed, so `gofakeit` is in `apps/backend/tools/go.mod` and never in `apps/backend/go.mod`. The module sits inside `apps/backend`, so it may import `apps/backend/internal/...` (the ent client, `internal/devdata`, which stays where it is).
- The binary keeps the name `devdata`, so the image target, the `backend-init` Job command and `task seed` in the hot-reload container are unchanged.
- Fixtures the e2e tests rely on (`writer@test.com`, the example novel with its IDs, name, tags, state, license and chapter titles and content) stay identical. They stop living as markdown and JSON files and become Go data in the tools module; the only file kept in `apps/backend/data/example-novel` is the cover image `71a3fcd8-937d-4e3d-94de-a643ff515f82.png`, which every seeded novel, example or generated, reuses.

## Step 1: Move the Seeder Into `apps/backend/tools`

Behaviour unchanged; no `gofakeit` yet.

- New module `apps/backend/tools` (module path `github.com/Ponos-OS/smart-novel/apps/backend/tools`), added to `go.work`, with `replace github.com/Ponos-OS/smart-novel/apps/backend => ../` so it also resolves with `GOWORK=off` (the `apps/backend/Dockerfile` sets it).
- `apps/backend/tools/devdata/main.go` replaces `apps/backend/cmd/devdata/main.go` (same environment variables, production guard and `devdata.Run` call); delete `cmd/devdata`.
- `apps/backend/Dockerfile`: a `devdata-build` stage (from `build`) builds `bin/devdata` from the tools module, so the `build` stage and the server image never fetch its dependencies; the `devdata` stage copies from it.
- `apps/backend/Taskfile.yml`: `build` and `seed` use the tools module; `test` also runs the tools module's tests.
- Update `.github/README.md` and the demo-data line of `.github/CONTRIBUTING.md` that name `cmd/devdata`.

AC:

- `task backend:build`, `task test` and the e2e image build pass, `task backend:seed` seeds the same rows as before, and `backend-init` still seeds the e2e stack.
- `apps/backend/go.mod` is unchanged and `cmd/devdata` no longer exists.

Test: `task test`, then `task backend:test:e2e` (it runs `backend-init`).

## Step 2: Example Novel as Go Data

Behavior unchanged: the same rows as after Step 1.

- The example novel (`c1d31ec2-f478-4648-b90b-d1e53de2a829`) and its five chapters (IDs, titles, numbers, content, tags, state, license, cover URL) are Go values in a package of the tools module, copied verbatim from `apps/backend/data/example-novel/details.json` and `chapter*.md`; `apps/backend-e2e` asserts on them (`node`, `chapter`, `novel`, `novels`, `tags` specs).
- Delete `details.json` and `chapter*.md`; keep `71a3fcd8-937d-4e3d-94de-a643ff515f82.png` (cover upload still reads it from `DATA_PATH`).
- `internal/devdata` loses the markdown and JSON loaders (`content.go` and its test, `LoadChapters`, `NovelDetails`) and takes the novels to seed as input; writers, license and cover upload stay there. The seeder is idempotent as before.
- `.github/CONTRIBUTING.md` and `.github/README.md` stop mentioning the markdown data if they do.

AC:

- `apps/backend/data/example-novel` holds only the cover image.
- A database seeded before and after the step has identical novel, chapter, tag and license rows (compare a dump of both).
- `task test` and `task backend:test:e2e` pass without editing any e2e spec.

Test: unit test in the tools module that the Go data has five chapters, unique IDs and consecutive numbers; then `task backend:test:e2e`.

## Step 3: Bulk Demo Data

Add `gofakeit` generation to `apps/backend/tools/devdata`.

- Flags (with `.env` fallbacks): `--novels-count`, `--chapters-count-per-novel`, `--randomizer-seed-number` (fixed default). Nothing is generated at zero, so local and e2e data is unchanged.
- Novels, chapters (a few thousand words each) and tags come from `gofakeit` with the fixed seed, so two runs on an empty database give the same rows. The generation lives in a package of the tools module.
- Every generated novel reuses `apps/backend/data/example-novel/71a3fcd8-937d-4e3d-94de-a643ff515f82.png` as its cover (the same image for all; this is development and e2e data only).
- Novels belong to the seeded writers, spread across them.
- Running it twice does not duplicate rows.
- No new task: `task backend:seed` stays the one seed task and takes the flags (`task backend:seed -- --novels-count 100`) or the `.env` keys. Whatever of `internal/devdata` it needs (writers, cover upload) is reused, refactored only as far as that requires.

AC:

- `gofakeit` is absent from `apps/backend/go.mod`, `go.sum` and the `server` image.
- `task backend:build` and the `apps/backend/Dockerfile` build still pass.
- Defaults (zero counts) produce the same rows as before.

Test: unit tests in the tools module (same seed gives the same output, counts are honored). Add the `.env.example` keys if any.

## Step 4: Drop the Static Example Novel

- Remove the example novel `c1d31ec2-f478-4648-b90b-d1e53de2a829` and its five chapters from the seeder (the Go data of Step 2 and whatever loads it). The seeder then creates novels and chapters only through the bulk generation of Step 3.
- `apps/backend/data/example-novel/71a3fcd8-937d-4e3d-94de-a643ff515f82.png` is NOT removed: it stays where it is and is the cover of every generated novel.
- Local, e2e and the `backend-init` Job run the bulk seed with non-zero defaults (small counts in `.env.example`, which CI copies to `.env`), so the stacks still start with data. The fixed seed keeps the generated rows, including their IDs, the same on every run.
- The e2e specs that used the example novel (`node`, `chapter`, `chapter-delete`, `novel`, `novels`, `tags`, the Cypress specs) stop depending on its ID, name and chapter text: they use a generated novel and chapter found by query, or one the spec creates itself.
- `.github/CONTRIBUTING.md` and `.github/README.md` describe the demo data as generated.

AC:

- `git grep c1d31ec2-f478-4648-b90b-d1e53de2a829` finds nothing in `apps/backend`, `apps/backend-e2e`, `apps/frontend-e2e` and `infra`, and `apps/backend/data/example-novel` holds only the cover image. The frontend unit specs and stories keep the ID as the value of their mocks; they never read the seeder.
- Every seeded novel has that cover.
- `task test`, `task backend:test:e2e` and `task frontend:test:e2e` pass.

Test: run the three tasks; seed twice and check the row counts do not change.

## Step 5: k6 scripts

`apps/backend-stress`, run by `task backend:test:stress`.

- Auth: tokens for the seeded users obtained once in `setup()`, the same way the `backend-e2e` authorization helper does it.
- `browse` scenario (ramping VUs): home list, search with filters and tags, novel page, chapter list, chapter read as `writer@test.com` and a plain user.
- `write` scenario (constant arrival rate, small): create a novel and a chapter as a writer, update the content, delete both so the run leaves the data clean.
- Operations come from the frontend documents (`home`, `search`, `novel`, `novel-form`, `tags`, `chapter-user-state`). Beatrice and Fithara operations (`GenerateChapterAudio`, `ExplainWord`, license drafting) are not used.
- `setup()` sends each operation once with sample variables and aborts with a message naming the operation and the backend's error (for example `operation GetNovel rejected: ...`) before any load starts. A threshold breach then means a performance regression, and a UI change that breaks an operation is reported as that, not as slowness.
- A GraphQL `errors` array counts as a failure (custom `Rate` metric), since the HTTP status is 200.
- Thresholds per scenario via tags: failure rate, `p(95)` and `p(99)` of `http_req_duration`, `checks`.

AC: the task passes against a seeded e2e stack, fails when a threshold is lowered below the measured value, and fails in `setup()` with the operation's name when a frontend document is made invalid (for example a required variable added).

Test: manual run against `infra/scripts/start-dev.sh e2e` with a bulk seed; record the measured numbers in the step's commit message.

## Step 6: Nightly workflow

`.github/workflows/stress.yml`.

- `schedule` (`0 2 * * *`) and `workflow_dispatch`; `concurrency` group so runs never overlap; `timeout-minutes`.
- Starts the e2e stack with the production images and the bulk seed, runs `task backend:test:stress`, always tears the cluster down.
- The summary goes to stdout and `$GITHUB_STEP_SUMMARY`; a breached threshold fails the job.

AC: a manual `workflow_dispatch` run is green and shows the summary.

## Step 7: Calibrate and document

Run the workflow 3 to 5 times, set thresholds with headroom over the observed worst case, add a short README to `apps/backend-stress` (how to run locally, how to read the summary, how to change a threshold), and mention the task in `.github/CONTRIBUTING.md`.
