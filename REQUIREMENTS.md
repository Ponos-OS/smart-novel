# Refactoring -- Use Beatrice instead of piper-tts-rest-api

Follow these steps:

## Step 1a

Update the compose file so we are running Beatrice 3.0.0, and add RabbitMQ as a new compose service so Beatrice has a queue to connect to.

### AC

- `compose.yml` runs `smart-novel-beatrice` at image tag `3.0.0` (not `2.0.0`).
- A RabbitMQ service is added to `compose.yml` (none exists today) and Beatrice's `RABBITMQ__CONNECTION_STRING` points at it.
- No application code changes in this step — infra/compose only.

### Test

- `docker compose up --build -d` boots cleanly; Beatrice's and RabbitMQ's healthchecks (or `docker compose ps`) report healthy.
- No unit/e2e/graphql-api-tester run for this step — nothing in the codebase changed.

## Step 1b

Add a HTTP API so Beatrice can call it and get a presigned URL for `genUploadUrl`. You can see the shape of what Beatrice will send to this endpoint here: `/home/mjb/projects/smart-novel/smart-novel-beatrice/docs/schema.graphql`.

The presigned URL must be short-lived and since we are initiating the whole flow, assume there will be an `Authorization` header attached to the incoming request. This means this API must be protected, but the thing is that if Beatrice is under load it may take a while to pick the message off the RabbitMQ queue and start processing it. So the token might be expired by the time the request is made.

I do not wanna spend time on this right now, please just make sure we were the ones issuing the JWT token by optionally talking to the ZITADEL API or something like that. Please validate the token was issued by our ZITADEL, not tampered with and if all that is well and good we must return a valid presigned URL in the format Beatrice expects.

Also set `GENERATE_AUDIO__CALLBACK__ALLOWED_HOSTS` (introduced in Step 1a) to include the backend's in-network hostname so Beatrice is allowed to call this endpoint.

### AC

- A new REST endpoint implements `genUploadUrl`: requires an `Authorization: Bearer <jwt>` header, validates the JWT via the existing ZITADEL JWKS-based verification (reuse `ZitadelAuthProvider` / equivalent) for signature and issuer only. Expired tokens are still accepted as long as the signature and issuer check out — Beatrice may pick the job off the queue well after the token's `exp`. Tampered signatures or a wrong issuer are rejected with `401`.
- On success, `genUploadUrl` returns `{"url": "<presigned-url>"}` — a short-lived (minutes, not hours) presigned `PUT` URL for the object storage bucket, generated via the existing `S3Client` provider (e.g. `getSignedUrl` + `PutObjectCommand`, `Content-Type: audio/mpeg`). The object key is deterministic from the job's `Idempotency-Key` header (e.g. `tts-audio/<jobId>.mp3`) so Step 2.1 can reconstruct the final audio URL from the jobId alone.
- Not a GraphQL resolver, so `apps/backend/gen-graphql-schema.ts` is unchanged by this step.

### Test

- Unit tests for the JWT guard: valid unexpired token accepted, valid but expired token still accepted, tampered signature rejected, wrong issuer rejected.
- Unit test for the presigned-URL service: returns a URL scoped to the expected bucket/key/TTL, mocking the S3 client.
- e2e (`backend-e2e`, supertest against the Nest HTTP adapter — first REST endpoint in the app, no existing REST e2e pattern to copy): `genUploadUrl` end-to-end with a real ZITADEL-issued token (valid, expired, tampered) against a running dev stack.
- No GraphQL surface changes, so graphql-api-tester is not invoked for this step.

## Step 1c

Add a HTTP API implementing `statusCallbackUrl`. This is responsible for informing the client about progress and status of the TTS generation. Right now we have Redis. So use its pub/sub mechanism for this. But no need to connect it to a subscription GraphQL API right now (that's Step 2.2) — just publish the message.

### AC

- A new REST endpoint implements `statusCallbackUrl`: accepts the `queued` / `generating` / `uploading` / `completed` / `failed` payload shapes Beatrice sends (see Step 2.1 for the `completed` example), publishes the raw payload via `RedisService`'s pub/sub (not the GraphQL `PubSub` used by `PUBSUB_TOKEN` — no subscription wiring yet), and responds `200`/`204` with no body, matching Beatrice's "best-effort, no response expected" contract. Malformed bodies are rejected with `4xx` rather than silently dropped.
- Not a GraphQL resolver, so `apps/backend/gen-graphql-schema.ts` is unchanged by this step.

### Test

- Unit test for the status-callback handler: valid payloads are published to Redis with the expected channel/payload shape; malformed payloads are rejected without publishing.
- e2e (`backend-e2e`): `statusCallbackUrl` end-to-end asserting the message lands on the expected Redis channel.
- No GraphQL surface changes, so graphql-api-tester is not invoked for this step.

## Step 2.0a

I wanna get rid of the `ttsFriendlyContent` field in `smart-novel/apps/backend/prisma/schema.prisma`. Remove the API for generating and updating the content with the TTS-friendly content: `generateTtsFriendlyText` mutation.

This hasn't been deployed to production yet, so there's no need for a careful, backward-compatible migration — feel free to reset/squash migrations as convenient.

### AC

- `generateTtsFriendlyText` mutation is removed: resolver method, service method, schema entry, and any `apps/backend/gen-graphql-schema.ts` registration are all deleted, not just hidden.
- `ttsFriendlyContent` is removed from the `Content` model in `apps/backend/prisma/schema.prisma`. No production-safe migration constraints — reset/squash migrations freely.
- The field resolver for `ttsFriendlyContent` in `chapter.field-resolver.ts` is removed.
- Frontend GraphQL operation documents that referenced `generateTtsFriendlyText`/`ttsFriendlyContent` (`novel.graphql`, generated types) are updated so the frontend still builds and codegens cleanly — this is just enough to keep the build green. Full UI rework (single TTS button, no review page) happens in Step 3b.

### Test

- Update/remove existing specs that reference `generateTtsFriendlyText` or `ttsFriendlyContent` (`chapter.field-resolver.spec.ts` and any others surfaced by running the suite).
- Invoke graphql-api-tester to confirm `generateTtsFriendlyText` no longer exists in the schema and `updateContent`'s shape (see Step 2.0b) is as expected.
- `nx build frontend` succeeds (codegen + build stay green after the operation-doc updates).

## Step 2.0b

`updateContent` mutation needs to be updated: remove the `ttsFriendlyContent` field (done in 2.0a) and instead, inside the service layer, call Beatrice's `generateAudio` mutation to generate a new audio file. Make sure to make this modular so when I later add support for writing a chapter I can simply be sure by design we are not gonna miss generating the audio file. Document in GraphQL that I will add later the fact that the moment they save the chapter we will generate an audio file. Also document that if they want drafting they can simply use a VCS — we are not gonna support that here.

This step also introduces the job-id-to-chapter map: right after `generateAudio` returns a `jobId`, we need to remember which chapter it belongs to, so later steps (2.1: persist the audio URL, 2.2: route status updates to the right GraphQL subscriber) can look it up.

### AC

- After a content update, `updateContent`'s resolver calls a single, reusable audio-regeneration entry point (one method on a service, e.g. on `ChapterNarrationService`) rather than inlining the Beatrice `generateAudio` call — this is the hook a future "save chapter" mutation must call too, so audio generation can't be forgotten when that lands.
- That entry point calls Beatrice's `generateAudio` with this backend's `genUploadUrl`/`statusCallbackUrl` endpoints (Steps 1b/1c) and, immediately on receiving the `jobId` back, records `jobId → chapterId` in a job-id-to-chapter map.
- The map is defined behind an interface + DI token (NestJS provider), with today's implementation being an in-memory store — swapping it for a persistent-database-backed implementation later must not require touching callers. Losing the map on a process restart is an accepted, unhandled edge case — no persistence/recovery logic needed.
- The GraphQL schema documents (via a description on the relevant field/mutation) that saving a chapter will trigger audio regeneration once that feature ships, and that drafting isn't supported — authors should use a VCS for that. Doc-only, no enforcement.

### Test

- Unit tests for the updated `updateContent` resolver/service: content is persisted, the audio-regeneration entry point is called exactly once with the right chapter/content, `generateAudio` is called with the expected callback URLs, and the map is populated with the returned `jobId`.
- Unit test for the map provider (set/get/miss).
- Invoke graphql-api-tester for `updateContent` (now triggers a Beatrice call as a side effect).
- `nx e2e backend-e2e` covering `updateContent`, mocking Beatrice's `generateAudio`.

## Step 2.1

React to the "completed" status sent from Beatrice. Beatrice will send something like this:

```json
{
  "attempt": 1,
  "fileSizeBytes": 4,
  "jobId": "2bce49d6-6592-4ed3-b421-f913b9ecc3bd",
  "status": "completed"
}
```

So now is the time we have to add the URL to the audio file in the object storage, using the job-id-to-chapter map from Step 2.0b.

### AC

- On a `status: "completed"` callback (from Step 1c's Redis channel), the handler looks up the `chapterId` for the `jobId` via the map, builds the audio URL from the deterministic object key set up in Step 1b (`tts-audio/<jobId>.mp3`), and persists it on the chapter's content record.
- `status: "failed"` handling is out of scope for this step (only `completed` is required) — don't add speculative failure-state handling here.
- A `completed` callback for an unknown/expired jobId (map miss) is logged and dropped, not thrown.

### Test

- Unit test: a `completed` callback for a mapped jobId updates the chapter content with the expected audio URL.
- Unit test: a `completed` callback for an unknown jobId is logged and dropped, not thrown.
- e2e (`backend-e2e`): full flow — trigger generation (2.0b), simulate Beatrice's `completed` callback, query the chapter and assert the audio URL is set.
- Invoke graphql-api-tester if the chapter query exposing the audio URL changed shape as part of this step.

## Step 2.2

Add a new GraphQL subscription API which will be used by the UI, so the UI can show live progress rather than just the final result from Step 2.1. Listen to the messages we got from `statusCallbackUrl`.

### AC

- The existing `chapterNarrationUpdated` subscription (`chapter-narration.resolver.ts`) is extended rather than replaced: it now also carries `percent` (from `generating`/`uploading` events) alongside the existing `status`, `narrationUrl`, and `error` fields, and stays filtered by `chapterId`. `narrationUrl` is only populated once Step 2.1 has persisted it (i.e. on/after `completed`); Beatrice's `{code, message}` failure shape is flattened into the existing `error: String` field so the frontend subscription consumer doesn't need a breaking type change beyond adding `percent`.
- A small bridge service subscribes to the raw Redis channel from Step 1c, resolves `jobId → chapterId` via the map from Step 2.0b, and re-publishes onto the GraphQL `PubSub` (`PUBSUB_TOKEN`) so `chapterNarrationUpdated` fires. Messages for an unmapped jobId are logged and dropped, not thrown (same as Step 2.1).

### Test

- Unit test for the bridge: given a raw Redis message and a populated map, the correct `chapterId`-scoped event is published with the right shape (including `percent`); an unmapped jobId results in no publish.
- e2e (`backend-e2e`): open the `chapterNarrationUpdated` subscription, simulate a `statusCallbackUrl` POST for each status, assert the events arrive with the expected payloads in order.
- Invoke graphql-api-tester for `chapterNarrationUpdated` since its payload shape changed (added `percent`).

## Step 3a

We still need to keep the "Generate TTS" button to generate an audio file. As soon as the user updates the content we already regenerate the TTS audio file automatically (Step 2.0b). One thing worth having is that when we have a live generate-audio-file in progress, even if the UI calls the backend we must reject the request.

Do not worry about the edge case of what happens if TTS generation gets stuck and never completes. Ignore this.

What we need to do in the backend is to make sure `generateChapterAudio` does not have a `forceRegenerate` argument anymore.

### AC

- `generateChapterAudio` always calls Beatrice to synthesize a fresh audio file, regardless of whether the chapter already has one — this was previously conditional behavior gated by a `forceRegenerate` argument; that argument is removed from the schema, resolver, and service signature (`ChapterNarrationService`/equivalent), and "always regenerate" becomes the only behavior.
- The single remaining restriction is concurrency, not a force/normal distinction: while a generation job is already in flight for a chapter (existing `NarrationLockService` lock), a new `generateChapterAudio` call — whether from the button or from an `updateContent`-triggered regeneration — is rejected with a clear error instead of silently overwriting or queueing.
- The frontend's `generateChapterAudio` operation document (`novel.graphql`) drops `$forceRegenerate` so the frontend keeps building — this is the same "keep it green" fix as Step 2.0a; the actual UI rework is Step 3b.
- Stuck/never-completing generations are explicitly out of scope — no timeout/recovery logic needed.

### Test

- Unit tests for the lock rejection: a second `generateChapterAudio`/regeneration call while a lock is held is rejected; the lock is released on completion/failure so a later call succeeds.
- Unit test confirming `forceRegenerate` is gone from the resolver/service signature (compile-time via TypeScript, plus a schema snapshot/introspection check).
- Invoke graphql-api-tester for `generateChapterAudio` (signature changed) — assert the lock-rejection error surfaces correctly through GraphQL.
- `nx e2e backend-e2e` covering the lock-rejection behavior end-to-end.
- `nx build frontend` succeeds after the operation-doc update.

## Step 3b

Rework the chapter writer-tools UI now that TTS-friendly content and the two-stage flow are gone: no more `TtsReviewPage`/"Edit TTS Content" step, no more gating audio generation on `hasTtsFriendlyContent`. A single "Generate TTS" action should call `generateChapterAudio` directly.

### AC

- `GenerateTtsButton` no longer navigates anywhere — it calls `generateChapterAudio` directly and drops the `hasTtsFriendlyContent`/`returnUrl` props and the "Edit TTS Content" label branch.
- `ChapterContent.tsx`'s separate "🔊 Generate/Regenerate Audio" button and `GenerateTtsButton` collapse into a single button/action (no more two buttons for what's now one operation); the `disabled={!hasTtsFriendlyContent}` gating is removed since there's no more precondition.
- The existing "regenerate confirmation" modal (shown when a narration already exists) is kept as-is — it's an unrelated UX safeguard, not the `forceRegenerate` backend concept.
- `useChapterNarrationSubscription`/`chapter-narration.graphql` are updated to request/consume the new `percent` field from Step 2.2.
- `novel.graphql`'s chapter query no longer requests `ttsFriendlyContent` (leftover from Step 2.0a's minimal fix — fully cleaned up here).

### Test

- Update/add component tests for `ChapterContent`/`GenerateTtsButton` covering: single button present, no navigation to a review path, disabled state removed, subscription-driven progress (`percent`) rendered.
- `nx e2e frontend-e2e` covering: no "Edit TTS Content"/review-page path exists, "Generate TTS" works end-to-end, editing content kicks off regeneration and the UI reflects live progress.

## Step 4

Cleanup:

- No need for the side by side `TtsReviewPage` anymore.
- No need to keep the piper-tts-rest-api in the compose file.
- Remove unnecessary env files.

### AC

- `TtsReviewPage.tsx` and its route are deleted, along with any now-unused imports/components that only existed to support it.
- The `tts` (piper-tts-rest-api) service is removed from `compose.yml`.
- `TTS_ENDPOINT` and any other piper-only variables are removed from `.env`/`.env.example` (and any devtools compose env files that reference them).
- No lingering references to `piper-tts-rest-api`, `ttsFriendlyContent`, `TtsReviewPage`, or `generateTtsFriendlyText` remain anywhere in the repo.

### Test

- `nx build frontend` and `nx build backend` succeed with the removed page/service.
- `nx e2e frontend-e2e` and `nx e2e backend-e2e` pass without referencing the removed page/endpoint.
- `grep -rn "piper-tts-rest-api\|ttsFriendlyContent\|TtsReviewPage\|generateTtsFriendlyText"` returns nothing outside this `REQUIREMENTS.md`/history.
- No GraphQL schema surface changes in this step, so graphql-api-tester is not invoked.

## Step 5

Upgrade to Beatrice `4.0.0`. That release adds an opaque `clientContextId` argument to
`generateAudio`: Beatrice stores it per-job and echoes it back verbatim, as
`clientContextId`, on every `statusCallbackUrl` body and on the `genUploadUrl` POST —
present from the very first (`queued`) callback, with no dependency on when the
`generateAudio` mutation response reaches us. It also removes the `percent` field from
every status callback entirely (breaking change) — it never carried real progress
(Beatrice always sent a fixed/fake value), so there's nothing to preserve.

This closes a real race we hit in production: `ChapterNarrationService` used to record
`jobId → chapterId` in a map (`JOB_TO_CHAPTER_MAP`) only _after_ `generateAudio`
resolved with a `jobId` — but Beatrice's queue worker could fire the `queued`/
`generating` webhook before that response even arrived, so the map lookup missed and
the update was dropped (logged as `unknown/expired job`, even though it wasn't actually
expired — just not registered yet). No storage backend for that map closes the window;
switching it to Redis (done earlier) didn't fix it, because the race is inherent to
"caller only learns the correlation key after the callback can already fire." Passing
our own `chapterId` as `clientContextId` up front removes the race, and removes the
need for the map entirely — we get the correlation for free on every callback body.

### AC

- `compose.yml` runs `smart-novel-beatrice` at image tag `4.0.0` (not `3.1.0`).
- `apps/backend/src/shared/beatrice/schema.graphql` is refreshed from Beatrice
  `4.0.0`'s `docs/schema.graphql` (adds `clientContextId`, drops `percent` from the
  `statusCallbackUrl`/`genUploadUrl` doc text).
- `LlmClient.generateAudio` accepts and forwards a `clientContextId` argument.
- `ChapterNarrationService.queueBeatriceJob` passes the chapter's id as
  `clientContextId` on the `generateAudio` call, and no longer writes to any
  jobId-to-chapter map.
- `ChapterNarrationService.handleStatusUpdate` reads the chapter id directly from the
  callback's `clientContextId` instead of looking anything up. A callback arriving
  without a `clientContextId` (e.g. a job queued by a pre-upgrade backend, still
  in-flight during the deploy) is logged and dropped, not thrown — same "best-effort,
  unmapped updates are a miss not an error" posture as before, just keyed on a missing
  field instead of a missing map entry.
- `JOB_TO_CHAPTER_MAP`, `IJobToChapterMap`, `RedisJobToChapterMap` (interface,
  provider, DI wiring in `novel.module.ts`) are deleted outright — not deprecated or
  left unused.
- `TtsStatusCallbackDto` drops `percent` and gains an optional `clientContextId`
  string field.
- `percent` is removed end-to-end: `ChapterNarrationEvent` (GraphQL type),
  `chapterNarrationUpdated`'s resolver/service payload, the frontend's
  `chapter-narration.graphql` subscription document, and generated frontend types.
- `useChapterNarrationSubscription` tracks the live `status` (`queued` /
  `generating` / `uploading`, i.e. `NarrationStatus.PROCESSING` doesn't distinguish
  these sub-states today — extend the GraphQL enum, or expose the raw stage on
  `ChapterNarrationEvent`, whichever keeps `NarrationStatus`'s existing READY/FAILED
  meaning intact) instead of a `percent` number.
- `ChapterContent.tsx` replaces the `N%` progress text with a real progress bar (a
  determinate-looking bar with a small number of discrete steps — queued → generating
  → uploading — rather than a numeric percentage, since Beatrice no longer reports
  one), labeled with the current stage name so the user sees _what's_ happening, not a
  fake percentage.
- No lingering references to the removed map types or to `percent` in the TTS
  narration flow remain anywhere in the repo (outside this file/history).

### Test

- Unit tests: `LlmClient.generateAudio` is called with `clientContextId`;
  `queueBeatriceJob` no longer touches a map; `handleStatusUpdate` routes on
  `update.clientContextId` and drops/logs when it's missing (replacing the old
  "unknown/expired job" test cases).
- Delete the now-obsolete `RedisJobToChapterMap` and `IJobToChapterMap` unit tests.
- Update `ChapterContent`/subscription-hook frontend tests to drop `percent`
  expectations and instead cover the stage-driven progress bar (renders the right
  step/label for `queued`/`generating`/`uploading`, and disappears on `READY`/`FAILED`).
- Invoke graphql-api-tester for `chapterNarrationUpdated` and `generateChapterAudio`
  since their payload/argument shapes changed (removed `percent`, and `clientContextId`
  now flows through, even though it isn't itself a GraphQL-facing field).
- `nx e2e backend-e2e` and `nx e2e frontend-e2e` covering the narration flow end-to-end
  against real Beatrice `4.0.0`.
- `nx build frontend` and `nx build backend` succeed.
