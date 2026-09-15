# Chapter Edit Optimistic Concurrency

Prevent one writer's chapter edit from silently overwriting another writer's concurrent edit. Two writers editing the same chapter at nearly the same time is expected to be rare, so this is deliberately **not** a real-time locking/presence feature (no "user X is editing" indicator, no live notification to the other tab) and **not** a merge feature (no diff view, no field-level merge). It is optimistic concurrency control: the writer who saves second is rejected outright and must explicitly discard their local edits and reload before they can save.

- `Chapter.updatedAt` and `ChapterContent.updatedAt` already exist (`apps/backend/prisma/schema.prisma:53`, `:78`) and are bumped by Prisma automatically on every `chapter.update`/nested `content.upsert` call in `PrismaChapterContentRepository.upsertByChapterId` (`apps/backend/src/modules/novel/repositories/prisma-chapter-content.repository.ts:45-69`) — no schema migration needed.
- Use two independent version tokens, not one shared one: `updateContent` checks against the chapter's content version, `updateChapter` (title) checks against the chapter's own version. Otherwise an unrelated title edit by someone else would spuriously reject a concurrent content save (and vice versa), even though the two mutations already don't touch each other's data.
- On conflict, reject the write entirely — do not save partial data, do not auto-merge, do not silently override.
- The frontend's only recovery action is "reload latest" (discard local edits and refetch). No conflict-resolution UI.

## Step 1 — Backend: expose a content version token and reject stale `updateContent` writes

`ChapterContent.updatedAt` isn't currently exposed over GraphQL (only `Chapter.updatedAt` is, on the `Chapter` type at `apps/backend/src/modules/novel/types/chapter.type.ts:29-32`, which reflects the chapter row itself, not its content). Add a `contentUpdatedAt` field to `Chapter` sourced from the related `ChapterContent.updatedAt`, and require callers of `updateContent` to pass back the value they last saw.

- No custom `DateTime` scalar: this codebase has none anywhere (`Chapter.createdAt`/`updatedAt` are already plain `String!`, inferred from their TS `string` type at `chapter.type.ts:27-32`, with no explicit scalar). Stay consistent — every timestamp here, new or old, is an ISO 8601 string over the wire.
- Add `contentUpdatedAt: String!` to `Chapter` (`chapter.type.ts`), resolved from the joined `ChapterContent.updatedAt` (`.toISOString()`), the same way other content-derived fields are loaded today (check whether `content` is already joined/dataloaded for `Chapter` resolution, e.g. via `chapter.field-resolver.ts`, before adding a new query path). Document the field's `description` as an ISO 8601 timestamp, matching the description style already used on `createdAt`/`updatedAt`.
- Add a required `expectedContentUpdatedAt: String!` argument to `updateContent` (`apps/backend/src/modules/novel/resolvers/chapter.resolver.ts:16-51`), validated with a new `IsoDateTimePipe` (`apps/backend/src/shared/pipes/`, alongside `RequiredStringPipe`/`ParseUuidPipe`) using `class-validator`'s `isISO8601` functional API — same shape as `RequiredStringPipe`, throwing `BadRequestException` on a non-ISO-8601 value. Describe the arg's expected format (ISO 8601) in its `@Args` description.
- In `ChapterService.updateContent` (`apps/backend/src/modules/novel/services/chapter.service.ts:43-61`), before writing, compare the current `ChapterContent.updatedAt` for that chapter against `expectedContentUpdatedAt` (compare as `Date` values, not raw strings, to avoid false mismatches from formatting differences). On mismatch, throw a `ConflictException` (`@nestjs/common`) instead of writing — do this as a single read-compare inside the same call, and check what `extensions.code` this repo's default Nest/GraphQL error formatting actually produces for a thrown `ConflictException` (there's no existing precedent for a non-`ForbiddenException`/`BadRequestException` error type in this codebase — confirm the real shape via a manual GraphQL call before deciding how Step 3's frontend should detect it, rather than assuming a code name).
- On mismatch, do not call `chapterNarrationService.regenerateAudio` — the resolver should short-circuit before that side effect entirely, same as it already does implicitly (the mutation just throws).
- No behavior change when `expectedContentUpdatedAt` matches — existing success path is unchanged.

### AC

- `updateContent` succeeds and updates content when `expectedContentUpdatedAt` matches the chapter's current content version.
- `updateContent` throws a conflict error and makes **no** database write and **no** narration-regeneration call when `expectedContentUpdatedAt` does not match.
- `Chapter.contentUpdatedAt` is queryable and reflects `ChapterContent.updatedAt`, independent of `Chapter.updatedAt`.
- Existing permission behavior (`@CheckPolicy('chapter', 'update')`) is unchanged.

### Test

- Unit: `IsoDateTimePipe` spec (pattern: `RequiredStringPipe.spec.ts`) — valid ISO 8601 string passes through, non-ISO string throws `BadRequestException`. `ChapterService.updateContent` spec — stale version throws and skips the repository write; matching version proceeds; `ChapterResolver.updateContent` spec — stale version doesn't call `regenerateAudio`.
- e2e: extend `apps/backend-e2e/src/backend/chapter.e2e-spec.ts` with a case that saves content twice concurrently with the same original `expectedContentUpdatedAt` — first succeeds, second gets the conflict error and the chapter's content reflects only the first save.
- GraphQL surface changed (new field, new required arg) — run graphql-api-tester against `updateContent` (success + conflict) and against `contentUpdatedAt` on `GetChapter`.

## Step 2 — Backend: reject stale `updateChapter` (title) writes

Mirror Step 1 for the metadata mutation, using the chapter's own `updatedAt` (already exposed) rather than a new field.

- Add a required `expectedUpdatedAt: String!` argument to `updateChapter` (`chapter.resolver.ts:53-74`), validated with the same `IsoDateTimePipe` from Step 1.
- In `ChapterService.updateChapter`, compare against the chapter's current `updatedAt` (as `Date` values) before writing; throw the same `ConflictException` on mismatch, no write.

### AC

- `updateChapter` succeeds when `expectedUpdatedAt` matches; throws a conflict error and makes no write when it doesn't.
- A content conflict and a title conflict are independent: saving content after someone else changed only the title (or vice versa) does not spuriously conflict.

### Test

- Unit: `ChapterService.updateChapter` spec — stale vs. matching version.
- e2e: extend `chapter.e2e-spec.ts` — concurrent title saves (second rejected); a title save after a content-only change to the same chapter (should still succeed, proving independence from Step 1's token).
- GraphQL surface changed (new required arg) — run graphql-api-tester against `updateChapter` (success + conflict).

## Step 3 — Frontend: detect the conflict and offer "reload latest"

`ChapterContentEditor` (`apps/frontend/src/pages/novel/ChapterContentEditor.tsx`) currently calls `useUpdateContentMutation`/`useUpdateChapterMutation` without any version argument. Thread the version tokens through and handle the conflict response distinctly from a generic error.

- When entering edit mode, capture `chapter.contentUpdatedAt` and `chapter.updatedAt` from the currently-loaded chapter (already fetched by `useGetChapterQuery`) as the "expected" values for this edit session.
- Pass `expectedContentUpdatedAt`/`expectedUpdatedAt` on save, per Step 1/2's new mutation args.
- On a conflict error specifically (using whatever detectable shape Step 1 confirmed), show a distinct message from the generic `showApiError()` path — e.g. "This chapter was updated by someone else. Reload to see the latest version." — with a single "Reload latest" action that refetches the chapter (`queryClient.invalidateQueries`/refetch, not a cache patch) and discards the writer's unsaved title/content, returning to read-only view. Do not attempt to keep the writer's draft around for a later re-apply.
- Any other (non-conflict) mutation error keeps existing behavior: `showApiError()`, stay in edit mode, unsaved values intact.

### AC

- Saving with a stale version shows the specific conflict message and a "Reload latest" control, not the generic error toast.
- Clicking "Reload latest" discards local edits, shows the chapter's current (server) title/content in read-only view, and does not call any mutation.
- Saving with a current version behaves exactly as before this feature (no regression to Step 3 of "Edit Chapter Content").
- A non-conflict error (e.g. network failure) still shows the generic error and preserves the writer's unsaved edits.

### Test

- Unit: extend `ChapterContentEditor.spec.tsx` — save with matching version (existing coverage, now passing the new args); save returning a conflict error (asserts conflict UI shown, no cache patch, mutation not retried automatically); "Reload latest" click (asserts refetch triggered, editor exits edit mode, unsaved text is gone); save returning a non-conflict error (asserts existing generic-error behavior unchanged).
- GraphQL surface changed only by new args on existing mutations/fields, already covered by Steps 1-2's graphql-api-tester runs — no additional run needed here.
- No new Cypress e2e for this feature (same scope decision as "Edit Chapter Content" — this is unit-testable business logic, not a cross-page journey or ZITADEL-auth-dependent flow).
