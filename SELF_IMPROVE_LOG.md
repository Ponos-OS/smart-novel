# Self-improvement log

## Backend refactor, Step 1 (Taskfile replaces Nx), 2026-11-11

- `REQUIREMENTS.md` overrides the loop: the step is left uncommitted until the user approves it.
- Went well: Taskfile `includes` with `dir` and `optional: true` mapped Nx targets one to one; frontend lint (0 errors), 726 frontend tests, build, Storybook build, shared tests and 1058 backend tests pass through `task`.
- Went wrong: ran `npm run start:dev` before checking host ports. 8080 and 3000 belong to another project's containers, so the stack could not start; the full-stack check was not done. The production backend and frontend images were built under throwaway tags instead and the backend container reached its env validation (rule 2d now says to check ports first). A first backend build failed on a transient Cypress download in `npm ci`; the other failure was the Dockerfile calling the root Taskfile, whose includes need directories the image does not have, so the image calls `apps/backend/Taskfile.yml` directly. Also ran `git stash` for a baseline typecheck, which is useless after `node_modules` changed; it was restored with `git stash pop --index`.
- Footguns found: `vite-tsconfig-paths` only maps files a tsconfig includes, so the backend `prisma/` files lost `@smart-novel/shared` until the config pointed at `tsconfig.base.json` (`projects: [...]`). `@swc-node/register` cannot resolve `./x.js` to `x.ts`.
- Pre-existing, not caused by this step: `tsc -p apps/frontend/tsconfig.spec.json` and `apps/backend-e2e/tsconfig.spec.json` report type errors in specs (stale fixtures, jest-extended matchers). Nx never type-checked them.
- Timing: frontend tests ~75 s, backend tests ~35 s, `frontend:generate` ~40 s, image builds over 5 minutes.
- Follow-up in the same step: husky and lint-staged replaced by lefthook. The first rewrite of `pre-push` dropped its `lint:check` line; check a hook's old content before rewriting it. `core.hooksPath` was set by husky to `.husky/_` and had to be unset.
- Second follow-up: I had added `@go-task/cli` to npm and called `npx task` in CI, Dockerfiles and terraform, which contradicted the user's setup (task installed as a system tool). Replaced with `go-task/setup-task@v2` in CI and the pinned install script in the images. Before picking an install route for a tool, ask or check how the user already has it installed.
- `NODE_ENV` renamed to `APP_ENV` in the backend config, instrumentation, `.env.example`, the local `.env` and the backend Dockerfile; the frontend Dockerfile keeps `NODE_ENV` for Vite and npm.
- Security review (post-commit) caught that dropping `NODE_ENV=production` from the NestJS production image would leave Apollo introspection and stack traces on. Restored it next to `APP_ENV`. When renaming an env var, grep dependencies' behavior (not only our code) before removing the old one.

## Backend refactor, Step 2 (shared spec and generator), 2026-11-11

- `REQUIREMENTS.md` overrides the loop: the step is left uncommitted until the user approves it.
- Moved `apps/backend` to `apps/backend-nest` in this step instead of step 3, because the Go module needs `apps/backend` for the helpers. A scripted rename with a path regex that excludes `apps/backend-e2e` (`apps/backend(?![-\w])`) and a separate regex for Task namespaces worked; `backend:` inside `backend-e2e:` needs a `(?<![\w-])` lookbehind. Image names, k8s names and URLs were deliberately left alone.
- `go test` caches on files opened inside the module only, so a changed `spec/cases/*.json` outside it still printed `(cached)` and passed. `backend:test` now runs with `-count=1`. Check that a deliberately broken case fails every suite that reads shared files.
- The generator needs Go, which the Node dev containers lack: it runs on the host (`task generate:shared`, called by `build-images.sh`), and tasks that run inside containers must not depend on it. The NestJS backend keeps its `@smart-novel/shared` import path through `apps/backend-nest/src/legacy-shared`, fed by a second generated file, so it can still produce the schema the frontend codegen needs. Step 11 removes it.
- Not verified: `npm run start:dev` and the e2e suites (host port 8080 is taken by another project's container).

### Step 2 follow-up: errors section

- Split wire error codes out of `strings` into an `errors` array (`code`, optional `message`, `description`); `INVALID_CURSOR_MESSAGE` stays a generated name (`<CODE>_MESSAGE`) so no importer changed. `penNameProblems` stays separate (validation outcomes, not wire errors).
- Messages go away with i18n in step 9; the spec only keeps a message where the frontend still matches on text.
- `vitest --root apps/frontend` ran 740 tests, `task frontend:test` runs 758: use the task, not a hand-built vitest command.

### Step 2 follow-up: zitadel-go

- Decided to use `zitadel-go` for token verification (step 5) and the management client (step 7); `role.go` stays because the library has no role hierarchy. Open questions (gRPC through the ingress, introspection vs local verification) are a spike at the start of step 5.

### Step 2 follow-up: pen name validated only by the backend

- Decision: the pen-name rule is not shared. The backend validates and answers an error code; the frontend translates it (step 9). Removed the unused Go `pen_name.go` and its test now; the spec, the frontend helper and the Nest bridge keep theirs until the consumers change (step 7 adds the codes, step 9 removes the frontend side).

## Backend refactor, Step 3 (inventory and Go skeleton), 2026-11-11

- `REQUIREMENTS.md` overrides the loop: the step is left uncommitted until the user approves it.
- Plan corrections made while building: ent refuses to generate with no entity (a `Placeholder` schema, skipped by entgql, stands in until step 4); entgql emits its own `type Query`, so hand-written files must `extend` it; gqlgen fails validation when its `model/` directory is missing, so a committed `doc.go` keeps it in a fresh checkout; `WithConfigPath` and `WithSchemaPath` are relative to where `go generate` runs (the module root), not to the file with `main`; `entgo.io/contrib` pulls a 2022 `genproto` that makes every gRPC import ambiguous, fixed by a `replace` to a current one (look for "ambiguous import" after adding OTel exporters).
- The frontend codegen cannot move to the Go schema in this step: the schema has no operations, so every frontend document would fail validation and `start:dev` would not come up. It stays on the NestJS schema until step 9; `build-images.sh` now runs `task frontend:generate` on the host in both modes, which removed the `frontend-codegen` Job and the NestJS tooling image. The `backend-init` Job (Prisma) is gone too, since the Go backend has no schema yet.
- A dev container that runs the generators writes root-owned files into the mounted sources. The Go generators run on the host and `air` builds into `/tmp/air`, so the container writes nothing back. Check file owners (`find apps ! -user $USER`) after any container that mounts the sources.
- `task` uses the Taskfile in the working directory first: in the dev image `WORKDIR` is `apps/backend`, so the command is `task serve`, not `task backend:serve`.
- gqlgen's "introspection disabled" is a plain `errors.New`; without a special case the error presenter hid it as an internal error and logged it at error level.
- Checks: `go test` (config, logging, telemetry against a fake collector, server, errors), `golangci-lint` 0 issues, `task backend:generate` idempotent and working from a clean checkout (`git clean -fdX apps/backend`), production image 59 MB running as a non-root user, development image reloads on save (verified by editing a resolver), `terraform validate` on `local/1-app` and the `backend` and `job` module tests. The `app` module test has two failures (ingress path count, shared Grafana dashboard) in code this step does not touch (`git diff` of `infra/terraform/modules` is empty); not investigated.
- Timing: the production image build took about 3 minutes cold, `start:dev` rebuilds the frontend image with `npm ci` for more than 10 minutes.
- Found only by running the real stack: (1) `modules/app` passed `OTEL_LOGS_EXPORTER=none`, a value the Go config rejected, and the backend pod exited at startup; the module now passes `stdout` (the documented alternative to `otlp`) and the Go default is `stdout`. (2) The frontend pod crash-looped because its container mounts only `apps/frontend` and the root Taskfile's `backend` include was not optional; the include is optional now. (3) The frontend dev image still ran `npx task` (missed in step 1); it runs `task`. Unit tests and image smoke tests passed before all three: a deployment-level run is the only check for env contracts between terraform and the app.
- A `pkill -f <pattern>` whose pattern appears in my own command line kills my own shell (exit 144) and, once, the `start:dev` run I wanted to keep. Kill by PID.
