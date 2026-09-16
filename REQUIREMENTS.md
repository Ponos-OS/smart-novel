# Chapter Routing: Path Segments Instead of Query Params

Replace the current `/novel/:id?chapter=X` query-param-based chapter navigation with path segments, and give edit mode its own URL, so the browser back/forward buttons, refresh, and direct links all reflect what's actually shown, and clicking "Edit" in `ChapterList` goes straight to the editor instead of the read view.

- New URLs: `/novel/:id` (chapter list, unchanged), `/novel/:id/chapters/:chapterId` (read mode), `/novel/:id/chapters/:chapterId/edit` (edit mode).
- Restructure as nested routes with `Outlet`, not one `NovelPage` component branching on `useMatch`: a `NovelLayout` route element owns the single `useGetNovelQuery` call and shared chrome (theme toggle, breadcrumbs, novel loading/error states), and passes `novel`/`canEditContent`/`canManageTts` down via `<Outlet context={...}>` to three leaf routes (chapter list, chapter read, chapter edit).
- Chapter-fetching (`useGetChapterQuery`) stays in the leaf routes (read/edit), not in the layout — it depends on `:chapterId`, which only the leaf has, and keeping it there avoids re-rendering the layout on every chapter switch.
- Direct navigation to the `/edit` URL by someone without `EDIT_CONTENT` in `allowedActions` shows a 403/forbidden view instead of the editor or a redirect — this is the actual authorization boundary already enforced server-side by `updateContent`/`updateChapter`'s `@CheckPolicy`; the frontend check here is a UX convenience, not the security boundary.
- `ChapterList`'s Edit button navigates straight to the `/edit` URL — it must not reuse the existing "open chapter in read mode" click handler.

## Step 1 — Route restructuring: `NovelLayout` + three leaf routes

Split `NovelPage` (`apps/frontend/src/pages/novel/NovelPage.tsx`) into a `NovelLayout` and three leaf page components, wired into `app.tsx`'s nested routes as described above.

- `apps/frontend/src/app/app.tsx`: replace the single `<Route path="/novel/:id" element={<NovelPage />} />` with a parent `<Route path="/novel/:id" element={<NovelLayout />}>` containing `index` (chapter list), `chapters/:chapterId` (read), and `chapters/:chapterId/edit` (edit) child routes.
- `NovelLayout`: keeps `useGetNovelQuery`, the theme toggle, breadcrumbs, and novel-level loading/error states currently in `NovelPage.tsx:101-124` and `:145-160`; renders `<Outlet context={{ novel, canEditContent, canManageTts }} />` for the matched child.
- `ChapterListPage`: renders the novel header + `ChapterList` (currently `NovelPage.tsx:162-233`), reading `novel`/`canEditContent`/`canManageTts` via `useOutletContext`; its "Read First/Latest Chapter" and per-chapter click handlers `navigate()` to `chapters/:chapterId` (read) using relative paths off the current match.
- `ChapterReadPage`: owns `useGetChapterQuery` for `:chapterId` (from `useParams`), renders the "Back to Novel" button and `ChapterContent` in read mode (currently `NovelPage.tsx:234-269`); Prev/Next navigate to sibling chapter read URLs.
- `ChapterEditPage`: same chapter fetch as `ChapterReadPage` (duplicated `useGetChapterQuery` call is fine — leaf routes intentionally don't share it), but if `canEditContent` is false, renders a 403/forbidden view instead of `ChapterContentEditor`.
- `Breadcrumbs.tsx`: update its links to the new path structure (check current implementation for how it currently builds the chapter link).
- `mark chapter as read` effect (`NovelPage.tsx:62-71`) moves to `ChapterReadPage` (reading marks it read; editing does not, since that's existing behavior tied to viewing not editing).

### AC

- Visiting `/novel/:id` shows the chapter list (unchanged behavior).
- Clicking a chapter in the list navigates to `/novel/:id/chapters/:chapterId` and shows read-only content; refreshing that URL shows the same content directly (no round-trip through the list).
- Clicking "Edit" in `ChapterList` for a chapter the writer can edit navigates directly to `/novel/:id/chapters/:chapterId/edit` and shows the editor immediately — no intermediate click needed.
- Visiting `/novel/:id/chapters/:chapterId/edit` directly as a writer without `EDIT_CONTENT` shows a 403/forbidden view, not the editor and not a silent redirect.
- Prev/Next/Back navigation and "mark as read on view" behave exactly as before, just via path-based URLs.
- No behavior change to `NovelLayout`'s novel-level loading/error states compared to today's `NovelPage`.

### Test

- Unit: any relocated logic (e.g. mark-as-read effect, prev/next handlers) keeps its existing test coverage, moved to whichever component now owns it; add a small test for the new 403 branch in `ChapterEditPage` (canEditContent: false renders forbidden view, not the editor, and does not call `useUpdateContentMutation`/`useUpdateChapterMutation`).
- No GraphQL surface changes in this step (routing/UI structure only) — skip graphql-api-tester.
- e2e: this is exactly the kind of full-page-navigation/URL-shape change `frontend-e2e` (Cypress) is for, per `.github/CONTRIBUTING.md`'s Storybook-vs-Cypress guidance — add or update a Cypress spec covering: chapter list → chapter read URL, chapter read → edit URL back to a non-edit URL via cancel, direct `/edit` visit as a non-editing-capable writer showing 403, and browser back/forward moving between the three URL shapes correctly.
