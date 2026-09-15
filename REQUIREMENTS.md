# Edit Chapter Content -- Built in a separate branch called "feat/update-chapter"

Let a writer edit a chapter they own — its Markdown content and its title — from the chapter reading page. Owners/admins already see "Writer Tools" (TTS controls) on `ChapterContent`; this feature adds an edit control to that same area. Obviously we must see the same button in the `ChapterList`.

- Editor is a plain `<textarea>` bound to raw Markdown, with a separate "Preview" toggle that reuses the existing `MarkdownRenderer`, no live side-by-side preview, no syntax highlighting, no new editor library (e.g. no TipTap/CodeMirror). A plain text `<input>` above it edits the title.
- Content and title are two separate mutations, not one combined input: `updateContent` already regenerates the chapter's audio narration as a side effect and must stay scoped to content only; title has no such side effect. Saving the edit form fires both mutations (as two top-level fields in a single GraphQL request) when both changed, or just the one that changed. Do **not** add `title` as an optional arg on `updateContent`, and do **not** create a separate mutation per metadata field either — `updateChapter` is the home for chapter metadata generally, `title` is just its first field.
- `chapterNumber` (reordering) is explicitly out of scope here — it has its own side effect (renumbering siblings) and isn't a confirmed feature yet. Don't stub a mutation or UI for it.
- Storybook is not currently configured in this repo, so we will be adding it.
- No new Cypress e2e spec for this feature — coverage is unit tests (Vitest + Testing Library) plus a Storybook story.

## Step 1 -- Backend Exposes an `EDIT_CONTENT` Allowed Action

Chapter edit permission already exists server-side (`updateContent` mutation gated by `@CheckPolicy('chapter', 'update')` → `RbacAuthorizationProvider.checkChapterPermission`, requiring the caller to be the novel's owner or an admin). The frontend has no way to know it may show an edit control — `Novel.allowedActions` currently only ever returns `MANAGE_TTS` for an owner/admin (`novel.resolver.ts:90-110`, `novel-action.enum.ts`).

Add a new `NovelAction.EDIT_CONTENT` value and include it in `allowedActions` under the same `isOwner || isAdmin` condition already used for `MANAGE_TTS`, so the two conditions stay consistent (this mirrors the existing resolver logic; it does not introduce a new resolver, so `gen-graphql-schema.ts` regeneration is not required — only the enum changes).

### AC

- `NovelAction` enum (`apps/backend/src/modules/novel/enums/novel-action.enum.ts`) gains `EDIT_CONTENT`.
- `NovelResolver.allowedActions` (`apps/backend/src/modules/novel/resolvers/novel.resolver.ts:90-110`) returns `[NovelAction.MANAGE_TTS, NovelAction.EDIT_CONTENT]` when `isOwner || isAdmin`, `[]` otherwise — unchanged for every other case.
- No change to the `updateContent` mutation itself or to `RbacAuthorizationProvider` — this step only exposes existing permission state to the client.

### Test

- Unit: update/extend the existing spec for `NovelResolver.allowedActions` (or add one if none exists) covering owner, admin, and neither — assert `EDIT_CONTENT` is present/absent alongside `MANAGE_TTS`.
- GraphQL surface changed (`Novel.allowedActions` field now returns an additional enum member) — run graphql-api-tester against `GetNovel`/`allowedActions` for an owner and a non-owner writer to confirm the field reflects the new value.
- e2e: `apps/backend-e2e/src/backend/chapter.e2e-spec.ts` already covers `updateContent` for admin, writer (owner), and plain user (`chapter.e2e-spec.ts:94-179`), but has no case for a **writer who does not own the novel**. Add that case here (assert the same `"You do not have permission to update this chapter"` forbidden error as the plain-user case) — this is the actual ownership-boundary check, tested at the layer that owns the permission logic, and is why Step 3 doesn't need a Cypress e2e test for the same thing.
- No Storybook work in this step.

## Step 2 -- Backend `updateChapter` Mutation for Chapter Metadata (Title)

Add a new `updateChapter` mutation on `ChapterResolver` (`apps/backend/src/modules/novel/resolvers/chapter.resolver.ts`) scoped to chapter metadata only, taking an `input` object so future metadata fields don't grow the argument list — `title` is just the first field on it.

```graphql
input UpdateChapterInput {
  title: String
}

updateChapter(id: ID!, input: UpdateChapterInput!): Chapter!
```

- Repurpose the existing (currently dead/unused) `UpdateChapterInput` at `apps/backend/src/modules/novel/inputs/update-chapter.input.ts:6-8` rather than introducing a differently-named type. Today it's `extends PartialType(CreateChapterInput)`, which drags `content` and `chapterNumber` back in — exactly the coupling we're avoiding, since `content` has the narration side effect and `chapterNumber` has its own (unbuilt) renumbering side effect. Replace it with its own `@Field(() => String, { nullable: true }) title?: string` (validated the same way `CreateChapterInput.title` is: `@IsString()`, `@IsNotEmpty()`, trimmed), not inherited from `CreateChapterInput`.
- Delete the commented-out `updateChapter`/`createChapter` mutation stubs at the bottom of `chapter.resolver.ts` — they're built against the old bundled input shape and would mislead whoever reads them next to the new mutation. (`createChapter` has no bearing on this feature; remove it too since it references the same input file being reshaped here — if it's wanted later it can be reintroduced with its own dedicated input.)
- Gated by the same `@CheckPolicy('chapter', 'update')` as `updateContent` — it's the same ownership check, just a different field.
- `ChapterService` gets a sibling method to `updateContent`, e.g. `updateChapter(chapterId: string, input: UpdateChapterInput)`, doing a plain `Chapter.update({ ...input })` (only defined fields are set — `PartialType`/`class-transformer` semantics, not a full overwrite) — no narration side effect, no other side effect.
- `ChapterResolver` already appears in `gen-graphql-schema.ts`'s resolver list — adding a method to an already-registered resolver class doesn't require touching that file (the "register new resolver" rule is about new resolver _classes_, not new mutations on an existing one).

### AC

- `updateChapter(id, { title })` updates only `Chapter.title`; `content`, `narrationStatus`, `narrationUrl`, `chapterNumber` are untouched by this mutation.
- Same permission behavior as `updateContent`: novel owner or admin succeeds; a non-owner writer or plain user gets the same `"You do not have permission to update this chapter"` forbidden error.
- No call to `ChapterNarrationService.regenerateAudio` (or any other side effect) happens as part of this mutation.
- The old bundled `UpdateChapterInput`/commented-out mutation stubs no longer exist in the resolver/input files.

### Test

- Unit: `ChapterResolver`/`ChapterService` specs covering the new mutation/method — success case, and that it does not call `chapterNarrationService.regenerateAudio`.
- e2e: extend `apps/backend-e2e/src/backend/chapter.e2e-spec.ts` with cases for admin, writer (owner), non-owner writer, and plain user — mirroring the existing `updateContent` coverage — plus a case asserting the chapter's `content`/`narrationStatus` are unchanged after a title-only update.
- GraphQL surface changed (new mutation field) — run graphql-api-tester against `updateChapter` for an owner and a non-owner writer.

## Step 3 -- Add Edit Functionality for Chapter Title and Content in the UI

Add an edit control to `ChapterContent` (`apps/frontend/src/pages/novel/ChapterContent.tsx`) and `ChapterList` (`apps/frontend/src/pages/novel/ChapterList.tsx`), visible when `novel.allowedActions` includes `EDIT_CONTENT` (same pattern as `canManageTts`, computed in `NovelPage.tsx:126-127`). Follow `GenerateTtsButton.tsx`'s conventions: `useUpdateContentMutation` (generated hook, already present unused at `graphql.ts:704-718`; mutation doc already exists at `novel.graphql:64-69`) plus a new `useUpdateChapterMutation` generated from Step 2's mutation, `queryClient.setQueryData` to patch the cached chapter's `title`/`content`/`updatedAt` on success (no `refetchQueries`), `showSuccess`/`showApiError` from `utils/notification.ts`.

Suggested shape (adjust naming to fit surrounding code, no need to over-engineer):

- A new `ChapterContentEditor` component (or similar) rendered inside `ChapterContent` next to/below the existing content block, gated by a new `canEditContent` prop threaded from `NovelPage` the same way `canManageTts` is.
- Idle state: an "Edit" button next to the chapter content; clicking it swaps the rendered title/Markdown for a text `<input>` (pre-filled with `chapter.title`) above a `<textarea>` (pre-filled with `chapter.content`), plus "Preview", "Save", and "Cancel" controls.
- "Preview" toggles the textarea for a read-only `MarkdownRenderer` render of the textarea's current (unsaved) value, so the writer can check formatting before saving — not a live side-by-side view. The title input stays as a plain input in both preview and edit state.
- "Save" calls whichever of `useUpdateContentMutation`/`useUpdateChapterMutation` corresponds to what actually changed (title only, content only, or both — as two top-level mutation fields in one GraphQL request when both changed); on success, patch the cache for whatever changed, show a success toast, and return to the read-only view. On error, show `showApiError()` and stay in edit mode with the writer's unsaved title/text intact.
- "Cancel" discards both the title and textarea changes and returns to the read-only view without calling any mutation.
- Disable Save while a mutation is in flight; disable Save if the title is empty, or if neither title nor content differs from the chapter's current values.

### AC

- A writer who owns the novel (or an admin) sees an edit control on the chapter page; a writer who does not own the novel, or a plain reader, does not.
- Editing and saving title and/or content updates the displayed chapter without a full page reload/refetch (cache patched directly, matching `GenerateTtsButton`'s pattern).
- Saving only the title does not trigger a content mutation (and vice versa); saving both fires both mutations in one request.
- Save/Cancel/Preview behave as described above, including disabled/error states.
- No new dependency is introduced (plain `<textarea>`/`<input>`, existing `MarkdownRenderer`).

### Test

- Unit: a co-located `*.spec.tsx` (pattern: `GenerateTtsButton.spec.tsx`) mocking `../generated/graphql`'s `useUpdateContentMutation`/`useUpdateChapterMutation`/`useGetChapterQuery`, covering: control hidden without `canEditContent`; edit → change title only → save (only `updateChapter` called); edit → change content only → save (only `updateContent` called); edit → change both → save (both called); save error path for either mutation (toast + edit mode retained, unsaved values intact); cancel discards both changes; preview toggles rendering without calling either mutation.
- GraphQL surface changed in this step for `updateChapter` (new generated hook) — covered by Step 2's graphql-api-tester run; no additional run needed here.
- No Cypress e2e for this step (per scope decision above).

## Step 4 -- Introduce Storybook for `frontend`

Add Storybook to `apps/frontend` (no Storybook config exists anywhere in the repo today). Use the Nx generator for the project's stack (Vite + React) so it's wired into Nx targets rather than a hand-rolled config, per this repo's "use Nx targets" convention.

### AC

- `apps/frontend/.storybook` exists with a working Vite-based config.
- An `nx storybook frontend` (or equivalent generated target) target starts Storybook locally and serves at least the default example story without errors.
- A `nx build-storybook frontend` (or equivalent) target produces a static build without errors, so it can run in CI later if desired — wiring it into actual CI is out of scope for this step.
- No existing app behavior changes; this step only adds dev tooling.

### Test

- Manual verification: run the generated storybook target and confirm it boots and the example story renders.
- No unit/e2e tests apply to this step (tooling setup only).

## Step 5 -- Storybook story for the chapter editor

Add a `.stories.tsx` for the component built in Step 3 (e.g. `ChapterContentEditor.stories.tsx`, co-located with the component), covering its key visual states.

### AC

- Stories for: read-only/idle state (title + content), edit state (title input plus textarea with sample Markdown content), preview state, and a saving/disabled state.
- Stories use static props/args only — no live network calls (mock or stub the mutation hook the same way the unit tests do, or accept callback props if that's simpler to story than the hook-bound component directly).

### Test

- Manual verification: `nx storybook frontend`, confirm all four stories render without errors or console warnings.
- No unit/e2e tests apply to this step.
