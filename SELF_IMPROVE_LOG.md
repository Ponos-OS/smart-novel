# Self-Improvement Log

## Step 1 (Create Chapter — backend repository + service) — 2026-09-16

Added `createChapter` to `IChapterRepository`/`PrismaChapterRepository` and
`ChapterService`. Hit a Prisma typing footgun creating `Chapter` +
`ChapterContent` together: passing the scalar `novelId` alongside a nested
`content: { create }` write fails to typecheck because Prisma picks the
`ChapterUncheckedCreateInput` variant. Fixed by using
`novel: { connect: { id: novelId } }` instead. Logged as a reusable gotcha in
`.github/docs/gotchas.md` (not a process change — nothing about the step loop
itself needed adjusting this pass).

## Step 2 (Create Chapter — GraphQL mutation) — 2026-09-16

Added `createChapter` mutation, `CreateChapterInput`, and wired
`@CheckPolicy('chapter', 'create')`. Discovered `RbacAuthorizationProvider`'s
`checkChapterPermission` had no `'create'` case at all — it would have
silently denied everyone (including admins) with just a `logger.warn`, no
compile error. Added the case, threading `resourceAttributes.novelId` through
since a create mutation has no chapter `id` yet for `PoliciesGuard` to resolve
as `resourceId`. Logged as a gotcha (check the provider's switch, not just the
decorator, whenever adding a new resource/action pair).

Hit two environment-class flakes unrelated to the diff, both already
documented in `gotchas.md`: a transient `npm ci` network failure downloading
Cypress during the `backend-e2e` image build (retried directly, succeeded),
and the memory-pressure monitor killing a `docker compose ... up --build`
invocation that was deliberately started with `run_in_background: true`
up front — switching to a plain foreground call (letting the tool
auto-background it past its own cap) let the retry finish cleanly. Both
match the existing gotchas.md entries; no new entry needed for either.

Per the user's explicit request, scoped Step 2's e2e run to only the new
`createChapter` tests via `vitest run <file> -t "create a chapter"`, and
skipped waiting on audio narration to actually complete (TTS is slow; the
permission-boundary AC only needs the mutation to succeed/fail correctly, not
for narration to finish) — worth remembering as the default scope for future
steps too: run/write only the tests for the code that changed, not the full
suite, unless a step's own AC needs broader regression coverage.

## Step 3 (Create Chapter — frontend create page) — 2026-09-16

Added `ChapterCreatePage`, the `CreateChapter` mutation/codegen, routing, and
the "New Chapter" button. Two things worth remembering:

1. REQUIREMENTS.md's own Step 3 prose specified route `/novels/:novelId/chapters/new`,
   but the app's real convention (checked `app.tsx`) is singular —
   `/novel/:id/...`. Followed the real router, not the doc's literal path.
   Logged as a gotcha: a requirements doc's URL scheme is a guess written
   before the step exists, not a source of truth to match literally.
2. No browser tool was available to visually verify the new Storybook
   interaction stories. Used the layered-proxy approach from an earlier
   gotcha (`nx build-storybook` succeeding + `index.json` listing the
   stories + a temporary `composeStories` Vitest spec), deleted after. Had
   to `vi.mock` `generated/graphql` in that temp spec pointing at the same
   mock module the story decorators mutate, since this repo's Storybook
   mocks are swapped in by a custom Vite plugin (importer-path-keyed) that
   only runs inside Storybook's own build, not under plain vitest — a
   naive composeStories run without that vi.mock would exercise the real
   (unmocked) hook instead of the story's intended mutation state.

No process change to `PROCESS.md` — both findings are code/tooling gotchas,
already logged in `.github/docs/gotchas.md` per `SELF_IMPROVE.md`'s routing
rule.

## Step 4 (Create Chapter — Cypress journey) — 2026-09-16

Added `create-chapter.cy.ts`: real ZITADEL login (`cy.login()`, existing
command) → create a chapter through the real UI → land on its edit page → see
it back in the chapter list. Per user request (consistent with Step 2),
dropped the "wait for narration READY" part of the original AC — updated
REQUIREMENTS.md Step 4 itself to match before implementing, since TTS
synthesis is slow and the user verifies it manually.

Procedural finding, added to `PROCESS.md` (this is the `frontend-e2e`
counterpart of the existing `backend-e2e` single-spec-run bullet, so it
belongs there, not just in the log): `npx cypress run --spec <path>`
resolves `<path>` relative to the **current working directory**, not
`--project`'s root — running from the repo root with a project-relative
spec path silently found "no spec files". Also confirmed `nx e2e
frontend-e2e` always runs every spec (same as `backend-e2e`), so scoping to
one new spec means bringing the compose stack up manually and calling
`cypress run --spec` directly, same shape as the existing backend-e2e
recipe.

This is Step 4 of 4 — the last step in `REQUIREMENTS.md`. Per
`AGENTS.md`'s Development Process, `REQUIREMENTS.md` and this log get
archived (e.g. to a GitHub issue) and removed once the feature ships; left
that to the user rather than doing it unprompted, since "ships" implies a
PR/merge decision outside this step loop.
