# Self-improvement log

## Load test, Step 1 (2026-11-18)

- REQUIREMENTS.md says not to commit before review, so the step is left uncommitted (overrides PROCESS.md step 7).
- A new Go module under `apps/backend` needs `go.work` (`use`), a `replace` to `../` and its own `go.sum` (`GOWORK=off go mod tidy`) for the Dockerfile, which sets `GOWORK=off`. `go build ./...` in a module with one `main` package fails with "output already exists" when a directory has the binary's name; use `-o /dev/null`.
- `task backend:test:e2e` took about 15 minutes in the background: 32 files, 358 tests passed.
- A request to delete seed markdown turned out to touch e2e assertions (IDs, chapter text); grep the e2e specs for a fixture before agreeing to remove it. Split into its own step (now Step 2).
