# Self-improvement log

## B1 - 2026-10-29

- `REQUIREMENTS.md` said not to commit each step; the user later asked for B1 to be committed explicitly, so it was committed on request.
- The repo has no `prisma/migrations` (it uses `db push`), and Prisma cannot express the partial unique index for `is_default`; B2 must enforce a single default in a transaction.
- `nx e2e backend-e2e` could not run: the frontend image build failed because `frontend:build` depends on `codegen`, which needs `apps/backend/schema.gql`, absent from the image. It failed independently of the B1 diff (introduced by `5edbd58`). B1 is verified by unit tests, lint and typecheck only.
- A Monitor waiting on `pgrep -f "nx e2e ..."` never fired because pgrep matched the monitor's own command line; the run had already finished.

## B2 - 2026-10-29

- Left uncommitted on request, for review.
- `nx e2e backend-e2e` still blocked by the frontend image build (see B1), so the new `license.e2e-spec.ts` is typechecked and linted but not run. Substitute used: a throwaway `postgres:17.11` container, `prisma db push`, the real seed, and a temporary script driving `LicenseService` (deleted afterwards). It caught a real race that the mocked unit tests could not: concurrent `upsert` of the same new text hit a `text_hash` unique violation.
- A step with raw SQL or concurrency behaviour needs a real-Postgres check even when e2e is available, mocks cannot show it.

## B3 - 2026-10-29

- Left uncommitted on request, for review. `backend-e2e` is still blocked by the frontend image build (see B1), so `platform-terms.e2e-spec.ts` and the fixture change are typechecked and linted but not run.
- Substitutes that paid off: `nx build backend --prod` to prove the `.md` asset lands next to `main.js` (a unit test cannot, `__dirname` differs when bundled), a throwaway real-Postgres script for concurrent accepts and the version-bump re-prompt, and a throwaway `NestFactory.createApplicationContext` to prove `@UseGuards(Class)` resolves its dependencies inside another module (`@nestjs/testing` is not installed).
- A new guard on existing mutations breaks every e2e spec that uses those users; the fixture now accepts the terms once per user, and one extra user (`writer3`) stays unaccepted so the gate itself stays testable regardless of spec order.

## F8 - 2026-10-29

- Left uncommitted on request, for review. Frontend unit tests only (`nx test frontend`, lint, tsc); no Cypress or Storybook story, since the permission check is already covered by `backend-e2e`.
- Running `npx vitest` directly in `apps/frontend` fails two specs with "VITE_SERVICE_URL is not defined"; `nx test frontend` loads `.env` and passes. Use the Nx target.
- jsdom's `querySelectorAll` with a selector list returns elements grouped per selector, not in document order, which broke the focus-trap test; sort by `compareDocumentPosition` instead of trusting it.
- A global error reaction (reopen on `PLATFORM_TERMS_NOT_ACCEPTED`) wired inline in `main.tsx` cannot be tested; keep the logic in a function under the feature folder and let `main.tsx` only call it.

## B4 - 2026-10-29

- Left uncommitted on request, for review. `license.e2e-spec.ts` gained a detail and list case but cannot run (see B1).
- lint-staged runs Prettier on `*.md` at commit time, so a hash-pinned markdown file (`platform-terms.md`) changed after its hash was computed and B3 landed with a failing `platform-terms.md.spec.ts`. The suite was last run before the commit. Re-pinned in this step. Rule for next time: after a commit whose hook may rewrite files, rerun the unit tests, and run Prettier on a hash-pinned file before computing its hash.
- A field resolver that injects a request-scoped dataloader goes in its own resolver class (`NovelLicenseFieldResolver`), not in `NovelResolver`, or every query on the large resolver becomes request-scoped.

## F9 - 2026-10-29

- Left uncommitted on request, for review. Unit tests only (`nx test frontend`, lint, tsc); no Cypress spec, no browser check.
- The step text assumed a license list and an `officialUrl` that the API does not have yet (the canonical registry arrives with B5). The form therefore offers the license in use (default on create, the novel's own on edit) with an editable text that becomes a FORKED or CUSTOM draft, and the novel page shows no canonical link. Check an AC's data needs against `schema.gql` before building on it.
- "Draft with assistant" is an optional prop on the form that renders only when given; the pages do not pass it until F1-F7 exist.

## F10 - 2026-10-29

- Left uncommitted on request, for review. Unit tests only (`nx test frontend`, lint, tsc, `nx build frontend` to confirm the lazy chunk); no Cypress or browser check, and the real `setDefaultLicense` call is only covered by the B2 e2e spec, which cannot run (see B1).
- Same gap as F9: there is no API to list stored licenses, so "pick another existing license" is not possible. The screen only takes text; typing a text that is already stored reuses that row (the server dedupes by text hash).
- `ConfirmDialog` hard-coded "Deleting..." on its confirm button; it now takes an optional `loadingLabel` with that default, so existing specs are untouched.
- Not done on purpose: a header link to the screen (F11 owns navigation); it is reachable at `/admin/licenses`.

## F11 - 2026-10-29

- Left uncommitted on request, for review. Unit tests only (frontend 190, backend 652, lint, tsc); no browser or Cypress check.
- The AC needs "accepted-on date", which `myPlatformTermsStatus` did not return. Added `acceptedAt` (ISO string, null unless the required version was accepted) to the backend status; a frontend step can need a small backend change, so read the operation's schema before building the UI on it.
- The terms modal links to `/licenses` and the gate steps aside on that route (writers can read it, the backend guard still blocks writing). That needed the gate inside the router, so `App` now wraps all routes in a root route that renders the gate beside the `Outlet`.
- Route is `/licenses` (resource path); the admin screen stays at `/admin/licenses`, linked from the default-license tab for admins.
- A spec that mocks the generated module with a bare factory breaks on any component importing an enum from it; spread `vi.importActual` first.
