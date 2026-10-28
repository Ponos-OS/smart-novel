# Manage novels and chapters from the UI

DO NOT COMMIT EACH STEP. PLEASE LET ME REVIEW IT FIRST.

Today a writer can only create and edit chapters in the UI. Add chapter deletion, novel create, edit and delete, and cover image upload, backend and UI.

## Decisions

- Permissions follow the existing model, no new roles. `NovelPolicy` already handles `create`, `update` and `delete` (admin, or a writer who owns the novel) and the CASL rules exist; no resolver uses them yet. `ChapterPolicy` gets a `delete` case with the same rule as `update`.
- No admin approval workflow. Deleting is limited to the owner or an admin, and the UI asks for an explicit confirmation. An approval queue needs a requests table, an admin inbox and notifications; that is a feature of its own and is out of scope.
- Hard delete. The Prisma relations already cascade (chapters, chapter content, read history, categories link), so the database needs nothing beyond the one delete.
- Deleting a chapter renumbers the chapters after it. The chapter navigation dataloader finds the previous and next chapter as `chapterNumber` minus and plus one, so a gap would break it. Deleting the last chapter shifts nothing. The delete and the shift are one transaction: `delete` followed by a single `UPDATE chapters SET chapter_number = chapter_number - 1 WHERE novel_id = ? AND chapter_number > ?`. No stored procedure, so the logic stays in the repository and under Prisma. There is no unique index on `(novel_id, chapter_number)`, so the shift cannot conflict with itself. Only that novel's later chapters are locked, for milliseconds. Narration audio is keyed by Beatrice's job id and read progress by chapter id, so neither is affected by the renumbering.
- `createChapter` computes max plus one without a lock today. To keep it consistent with the delete transaction, both take a row lock on the novel (`SELECT id FROM novels WHERE id = ? FOR UPDATE`) first.
- Editing a novel covers `name`, `author`, `description`, `state`, its categories and its cover.
- Cover upload goes straight from the browser to the bucket with a presigned `PUT` URL, reusing `PresignedUploadUrlService` (today only used for Beatrice). The backend chooses the object key (`covers/<novelId>/<uuid>.<ext>`), never the client. Upload is two calls: ask for the URL, then, after the browser upload, confirm so the backend sets `coverUrl`. The confirm call checks with `HeadObject` that the object exists under that novel's prefix, and has an allowed type and size, before saving it; a client cannot make `coverUrl` point anywhere else.
- Narration audio and replaced or orphaned covers are removed from object storage on a best effort basis: a failure is logged with one fixed message and does not fail the mutation (see CONTRIBUTING, side-effect rule). A Grafana alert on that message keeps the failures from going unnoticed (Step 5).
- The frontend uses one shared confirmation dialog component for both deletes.

## Steps

### Step 1: `deleteChapter` mutation

`ChapterPolicy` `delete` case, `@CheckPolicy('chapter', 'delete')` on a new `deleteChapter(id)` mutation, service and repository method (transaction as in Decisions), and the novel row lock in `createChapter`. Returns the deleted chapter's id and its `novelId`. Best-effort removal of its narration audio.

AC:

- A writer who owns the novel and an admin can delete a chapter; another writer and a plain user get a forbidden error; an unknown id is a not-found error.
- The chapter, its content and its read-history rows are gone; the chapters after it have their number reduced by one; earlier chapters are untouched; deleting the last chapter changes no other row.
- Previous/next navigation and `createChapter` (next number) are correct afterwards.
- Two concurrent deletes in the same novel end with consecutive numbers.
- A failed audio removal does not fail the mutation and logs `Failed to delete narration audio` with the object key.

Test: unit for policy, service, resolver and repository; `backend-e2e` for the permission matrix, the renumbering and the concurrent case. graphql-api-tester: `deleteChapter`.

### Step 2: Delete chapter in the UI

A delete button next to the edit button in `ChapterList` (shown under the same condition as `canEditContent`), a shared `ConfirmDialog` component, `novel.graphql` operation, and a refetch of the chapter list afterwards. When the deleted chapter is the one being read, navigate to the chapter list.

AC:

- Cancel in the dialog changes nothing; confirm deletes and the chapter disappears from the list.
- A failed mutation shows the error in the dialog and keeps it open.
- Users who cannot edit do not see the button.

Test: unit for the dialog and list; Storybook stories for the dialog (open, loading, error). No Cypress here, the permission boundary is covered by `backend-e2e`.

### Step 3: `createNovel` and `updateNovel` mutations

`@CheckPolicy('novel', 'create')` and `@CheckPolicy('novel', 'update')` mutations in `NovelResolver`, inputs with validation (trimmed, non-empty name and author; description; state; optional category names, created when missing), service and repository methods. `ownerId` is the caller. `updateNovel` changes only the fields that are passed.

AC:

- A writer creates a novel and owns it; a plain user is forbidden.
- Only the owner or an admin can update; categories passed to `updateNovel` replace the current set, omitting them keeps it.
- Invalid input returns the usual validation error.

Test: unit; `backend-e2e` for the permission matrix. graphql-api-tester: both mutations.

### Step 4: `deleteNovel` mutation

`@CheckPolicy('novel', 'delete')`, service and repository method, best-effort removal of the narration audio of all its chapters and of its cover.

AC:

- Owner and admin can delete; others are forbidden; an unknown id is not-found.
- Its chapters, contents, read history and category links are gone; other novels are untouched.
- A failed audio or cover removal does not fail the mutation and logs `Failed to delete narration audio` with the object key.

Test: unit; `backend-e2e` for the permission matrix and the cascade. graphql-api-tester: `deleteNovel`.

### Step 5: Grafana alert for failed audio removals

A rule in `infra/observability/grafana/provisioning/alerting/alert-rules.yaml`, in the same style and comments as the existing ones, querying Loki for the `Failed to delete narration audio` message from the backend. The backend does not expose Prometheus metrics (Prometheus only scrapes RabbitMQ), so this is a log-based rule. Update the README section that lists what is published to Grafana.

AC:

- The rule fires when at least one such line was logged in the last 24 hours, with severity `warning` and a description that says the object keys are in the logs and the files must be removed from the bucket by hand.
- Missing data counts as healthy.

Test: `promtool`/Grafana provisioning loads the file (start the dev cluster and check the rule in Grafana); log the message once from the backend and confirm the alert goes pending then firing.

### Step 6: Cover upload backend

- `createNovelCoverUploadUrl(novelId, contentType, contentLength)` mutation, guarded by `novel:update`. Allows `image/jpeg`, `image/png` and `image/webp` and a maximum size (a constant, 5 MB), signs the `PUT` with that content type and length so the bucket rejects anything else, TTL a few minutes. Returns `{ uploadUrl, objectKey }`.
- `setNovelCover(novelId, objectKey)` mutation, guarded by `novel:update`. Verifies the key starts with `covers/<novelId>/`, `HeadObject` confirms it, then stores the public URL in `coverUrl` and removes the previous cover (best effort, same log message and alert as Step 5).
- `PresignedUploadUrlService.generate` takes the optional content length; add a `HeadObject` and a `DeleteObject` helper to the object-storage module.

AC:

- Presigned URLs are generated for the browser-reachable endpoint (`OBJECT_STORAGE_PUBLIC_URL`), not the cluster-internal one, or the signature does not match when the browser calls it.
- The bucket accepts the browser `PUT` from the frontend origin (CORS set in the bucket's Terraform/config).
- A wrong content type, an oversized declared length, a key of another novel and a key that was never uploaded are all rejected.
- Only the owner or an admin can request a URL or set the cover.

Test: unit; `backend-e2e` doing the whole flow against the real bucket (request URL, `PUT` with `fetch`, confirm, read `coverUrl`) plus the rejection cases. graphql-api-tester: both mutations.

### Step 7: Create and edit novel in the UI

`NovelCreatePage` and `NovelEditPage` sharing one form component, routes `novels/new` and `novels/:novelId/edit`, a "New novel" entry on the home page for writers and admins, an "Edit" entry on the novel page for the owner and admins. Operations in a `.graphql` file next to the page, no barrel files.

AC:

- Submitting a valid form creates or updates the novel and lands on its page; a server error is shown and the form keeps its values.
- Entry points are hidden for users who cannot use them.

Test: unit for the form and pages; Storybook stories for the form states.

### Step 8: Delete novel in the UI

Delete action on the novel edit page using the `ConfirmDialog`, where the user must type the novel's name to enable the confirm button. Navigate to the home page afterwards.

AC:

- The confirm button stays disabled until the typed name matches exactly.
- After deleting, the novel no longer shows on the home or search page.

Test: unit; Storybook story.

### Step 9: Cover upload in the UI

On the novel edit page (the novel must exist, so not on the create page), a "Change cover" button opens a file picker. After a file is picked, a separate confirmation form shows a preview, the file name and size, and "Use this cover" and "Cancel". Confirm requests the URL, uploads with `PUT` and the file's content type, calls `setNovelCover`, and refreshes the cover. The type and size are checked in the browser first with the same limits as the backend.

AC:

- Cancel uploads nothing and calls no mutation.
- A rejected type or size shows an error before any request is made.
- A failed upload or confirm shows the error in the form and keeps the selection so the user can retry.
- After success the new cover shows on the edit page, the novel page and the novel cards.

Test: unit with a mocked `fetch` and mutations; Storybook stories for picked, uploading, error. The real browser upload and CORS are covered by the Cypress journey.

### Step 10: Cypress user journey

One `frontend-e2e` spec as the writer: create a novel, edit it, upload a cover, add two chapters, delete the first and check the second is now chapter 1, delete the novel.

AC:

- The journey passes against the real stack, including the browser `PUT` to the bucket.

Test: `nx e2e frontend-e2e`.

## Open questions

- Does Beatrice expose a way to delete a narration, or do we delete the object directly from the bucket? Step 1 needs this answered.
- Soft delete (a `deletedAt` column and a restore window) is the cheaper safety net than an approval flow, if recovering from a mistaken delete matters. Not included; say so if you want it as a step.
