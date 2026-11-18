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
