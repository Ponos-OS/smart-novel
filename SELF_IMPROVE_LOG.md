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
