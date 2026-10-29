# Self-improvement log

## B1 - 2026-10-29

- `REQUIREMENTS.md` said not to commit each step; the user later asked for B1 to be committed explicitly, so it was committed on request.
- The repo has no `prisma/migrations` (it uses `db push`), and Prisma cannot express the partial unique index for `is_default`; B2 must enforce a single default in a transaction.
- `nx e2e backend-e2e` could not run: the frontend image build failed because `frontend:build` depends on `codegen`, which needs `apps/backend/schema.gql`, absent from the image. It failed independently of the B1 diff (introduced by `5edbd58`). B1 is verified by unit tests, lint and typecheck only.
- A Monitor waiting on `pgrep -f "nx e2e ..."` never fired because pgrep matched the monitor's own command line; the run had already finished.
