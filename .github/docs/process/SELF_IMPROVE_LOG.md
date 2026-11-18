# Self-improvement log

## Load test, Step 1 (2026-11-18)

- REQUIREMENTS.md says not to commit before review, so the step is left uncommitted (overrides PROCESS.md step 7).
- A new Go module under `apps/backend` needs `go.work` (`use`), a `replace` to `../` and its own `go.sum` (`GOWORK=off go mod tidy`) for the Dockerfile, which sets `GOWORK=off`. `go build ./...` in a module with one `main` package fails with "output already exists" when a directory has the binary's name; use `-o /dev/null`.
- `task backend:test:e2e` took about 15 minutes in the background: 32 files, 358 tests passed.
- A request to delete seed markdown turned out to touch e2e assertions (IDs, chapter text); grep the e2e specs for a fixture before agreeing to remove it. Split into its own step (now Step 2).

## Load test, Steps 2 and 3 (2026-11-18)

- Same override as Step 1: no commit before review.
- A seeder change needs no cluster to check its rows: `docker run postgres:18.2-bookworm` on a spare port, `go run ./devdata` with `DATABASE_URL`, `SEEDED_WRITERS` and `ZITADEL_WRITER_USER_ID`, then `psql` counts. It showed idempotency, spread over writers and same-seed reproducibility in seconds; `task backend:test:e2e` (15 minutes) only proves the zero-count defaults.
- `task test` fails 36 frontend specs when `@testing-library/user-event` is missing from `node_modules`; that is the install, not the diff (`task backend:test` is the Go part).
- Option names were renamed three times after review; ask for the naming style of the user's env keys before adding a flag (flags mirror the env keys: `--novels-count`, `DEVDATA_NOVELS_COUNT`).

## Load test, Step 4 (2026-11-18)

- Same override: the user reviewed Steps 1 to 3 before each commit; Step 4 is committed on their word.
- Removing seed data breaks e2e specs by tag name as well as by ID (`fantasy`, `adventure`): grep both. Specs now build their own novels with `NovelFixture`, and browse-only specs find a generated novel by `coverURLNotNil`.
- Beatrice rejects text over 4000 characters, so the narration specs (backend and Cypress) create short chapters; generated chapters are 2000+ words and cannot be narrated. A creation-triggered narration must settle before a spec asserts its own.
- `vi.waitFor` defaults to a 1 s timeout; narration waits need an explicit one (120 s here).
- `task frontend:test:e2e` fails before Cypress with `EBADDEVENGINES` (`npx cypress run` against a `devEngines` that requires pnpm). Workaround: `sh infra/scripts/start-dev.sh e2e`, `node_modules/.bin/cypress run --project apps/frontend-e2e` with `.env` sourced, `sh infra/scripts/stop-dev.sh`.
- A new `.env.example` key does not reach the user's existing `.env`; the `DEVDATA_*` keys were appended by hand.
- A background run dies with the session when the context is compacted: after a resume, check `kind get clusters` and `docker ps` (`kind get clusters` listed nothing while the node container still held port 8080), run `stop-dev.sh`, and rerun.
- No process change: each lesson is from this step only.

## Load test, Step 5 (2026-11-18)

- Same override: left uncommitted for review.
- k6 is not installed on the host, so `run.sh` runs the pinned `grafana/k6` image with `--network host`; the Terraform outputs (bot key) reach it through a temporary mounted file, not `-e`. k6 reads `.ts` natively, and `open()` works only while the script loads (a first run died in `setup()` on it), so read files at module level.
- Verified the ACs by hand against `start-dev.sh e2e` (6 novels of 5 chapters): green run; `p(95)<100` on browse failed the run with exit 99; a required variable added to `GetNovel` failed `setup()` with `operation GetNovel rejected: ...`; the database had no `Stress` novel left afterwards.
- `pnpm add -D -w @types/k6` rewrote the whole lockfile (quote style); `pnpm exec prettier --write pnpm-lock.yaml` brought the diff back to 11 lines.
- A `sleep` longer than a few seconds in the foreground is blocked; wait with a background `until` loop and note that its "completed" notice can be the launcher (`nohup ... &`), not the job.
- No process change.

## Load test, Step 6 (2026-11-18)

- Same override: left uncommitted for review.
- A workflow cannot be run before it is pushed, so only its parts were checked: the YAML parses, prettier passes, the `sed` lines set the `DEVDATA_*` keys in a copy of `.env.example`, and the seed of 100 novels of 10 chapters took 7 s and 17 MB on a throwaway Postgres (writer JSON keys are `userId`, `name`, `email`, `penName`). The AC, a green `workflow_dispatch` run, waits for a push.
- The workflow builds the images itself (`start-dev.sh e2e`), unlike `e2e.yml`, which loads the ones `build.yml` made, because it runs alone at night.
- No process change.

## Load test, Step 7 (2026-11-18)

- Same override: left uncommitted for review.
- GitHub Actions runs cannot be started from here, so the thresholds were calibrated with three local runs on the 100 novels of 10 chapters seed (browse p95 581 to 612 ms, p99 764 to 793 ms; write p95 up to 409 ms, p99 up to 544 ms; 0 failures). The old browse `p(95)<500` was breached on that data, so the step 5 numbers (6 novels) were too optimistic: calibrate on the size the workflow seeds. Browse is now 1500/2500 ms, about 2.5 times the worst. The AC "3 to 5 workflow runs" is open until the workflow is pushed and run.
- Review feedback: a README that says "start the stack, run, stop" is a sign the task should do it. `test:stress` now runs `start-dev.sh e2e`, a `defer:` to `stop-dev.sh` and `run.sh`; `defer` is registered after the start, so an exit 3 (a stack already exists) never tears down the user's stack. The workflow lost its start, stop and log steps. Verified once from nothing: green, no cluster or container left.
- A calibration script that calls `task` must run before the task is changed: edit the Taskfile only after the loop ends.
- `task backend:test:e2e` and `task backend:test:stress` own their stack, so a task that needs a stack should own it too (compare with step 5, where it was left to the user).
