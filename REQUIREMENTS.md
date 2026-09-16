# Feature: Create Chapter

Authors can create a new chapter (title + content) for a novel they own. Chapter number is auto-assigned, and audio narration is generated automatically on creation.

## Step 1 — Backend: repository + service

Add `createChapter` to `IChapterRepository` / `PrismaChapterRepository`: computes `chapterNumber` as `MAX(chapterNumber) + 1` for the novel (1 if none exist), creates `ChapterContent` and `Chapter` in a single transaction.

Add `ChapterService.createChapter(novelId, { title, content })`:

- Calls the repository method above.
- After the chapter is persisted, calls `chapterNarrationService.regenerateAudio(...)` (same call used by `updateContent`). Wrap it so a failure is logged and does not fail chapter creation, per the side-effect rule in `.github/CONTRIBUTING.md`.

### AC

- New chapter gets `chapterNumber = previous max + 1` for that novel.
- `ChapterContent` and `Chapter` rows are created atomically (transaction failure leaves neither row behind).
- Audio narration is triggered after creation; a narration failure does not throw out of `createChapter`.

### Test

- Unit tests only (no GraphQL surface yet): `chapter.service.spec.ts` covering chapter-number calculation (empty novel, existing chapters), transactional create, and narration failure being swallowed/logged.

## Step 2 — Backend: GraphQL mutation

Add to the existing `ChapterResolver` (no new resolver class):

```graphql
input CreateChapterInput {
  title: String!
  content: String!
}

createChapter(novelId: ID!, input: CreateChapterInput!): Chapter!
```

- `CreateChapterInput` fields trimmed, non-empty (class-validator), same style as `UpdateChapterInput`.
- Guard with `@CheckPolicy('chapter', 'create')`, ownership resolved the same way as `updateChapter`.
- Regenerate `schema.gql` via `apps/backend/gen-graphql-schema.ts`.

### AC

- Owner (or admin) can create a chapter on their novel; a non-owner is rejected by the policy guard.
- `schema.gql` reflects the new mutation and input type.

### Test

- Resolver unit test (mock service, assert delegation + args).
- Invoke `graphql-api-tester` with `createChapter` and this step's AC.
- Backend-e2e: permission-boundary spec — owner/admin can call `createChapter`, other users get a policy rejection.

## Step 3 — Frontend: create chapter page

- Add `CreateChapter` mutation to `apps/frontend/src/pages/novel/novel.graphql`, regenerate codegen (`useCreateChapterMutation`).
- New route `/novels/:novelId/chapters/new` → `ChapterCreatePage.tsx`, styled like `ChapterContentEditor` (plain `useState`, no form library): title + content fields, submit button.
- "New Chapter" button on `ChapterListPage`, visible only when `canEditContent` (from `useNovelOutletContext()`).
- On success, navigate to the new chapter's edit page; on error, show `showApiError` toast.

### AC

- Author with edit rights sees "New Chapter" on the chapter list and can submit a title + content to create a chapter.
- On success, they land on the new chapter's edit page.
- Button is hidden for users without `canEditContent`.

### Test

- Component spec for `ChapterCreatePage` (mock `useCreateChapterMutation`): submit success navigates, submit error shows toast, validation blocks empty title/content.
- Story for `ChapterCreatePage` covering empty/filled/error states, plus an interaction story (`play` function, mocked mutation) driving fill-in → submit → navigate, so the create flow's UI logic is covered without a browser.

Relies on the `.github/CONTRIBUTING.md` carve-out: Step 2's backend-e2e spec already covers the owner/non-owner permission boundary against the real API, so that part does not need Cypress too. What Storybook and backend-e2e together still can't cover — real ZITADEL login/redirect and the chapter actually going through creation against the real backend — is left to Step 4. Narration reaching `READY` is not asserted anywhere in this feature's automated tests (real TTS synthesis is slow; verify it manually).

## Step 4 — Frontend-e2e: create-chapter journey

New Cypress spec for the parts nothing else exercises: real ZITADEL
login/redirect as the novel owner, then create a chapter through the real UI
and real backend, and confirm the chapter appears in the chapter list. Keep
this spec minimal — it exists only for the real-auth-and-real-backend
guarantee, not to re-check UI states or permission logic already covered in
Steps 2–3. Does not wait for narration to reach `READY` (real TTS synthesis
is slow; verify manually).

### AC

- An authenticated owner can log in, create a chapter through the real app,
  and see it listed.

### Test

- `nx e2e frontend-e2e`, new spec only (keep the GraphQL queries/mutations
  used by the spec inline in the spec file per test conventions).
