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
