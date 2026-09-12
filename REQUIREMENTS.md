# Ordered TTS Status Callbacks

This has been already implemented in Beatrice v4.1.0. So you just need to switch to that version. You also should bring the new GraphQL schema here:

```
cp /home/mjb/projects/smart-novel/smart-novel-beatrice/docs/schema.graphql /home/mjb/projects/smart-novel/smart-novel/apps/backend/src/shared/beatrice
```

## Problem

`GenerateTtsButton` gets stuck showing "Queued..." and never advances. Root cause: Beatrice's `queued` callback (sent synchronously from its `generateAudio` resolver, after publishing to RabbitMQ) and its `generating` callback (sent independently by its worker, the instant it dequeues the job) race each other over the network with no ordering guarantee. `ChapterNarrationService.handleStatusUpdate` currently applies whichever arrives last, unconditionally — if that's `queued`, the UI is stuck, since Beatrice never resends `generating` afterward.

## Decisions (don't relitigate these mid-implementation)

- Fix lives entirely in how we interpret Beatrice's callbacks, not in restructuring Beatrice's process topology. Beatrice's own `REQUIREMENTS.md` adds an optional numeric `progress` field to its callback body (present on `queued`/`generating`/`uploading`, absent on `completed`/`failed`) — bigger number is later, full stop. We never learn or hardcode what the numbers mean beyond that.
- `status` stays a plain string smart-novel does not validate against a fixed set of values — no `IsIn`, no enum, no codegen dependency on Beatrice's stage vocabulary. Only `completed`/`failed` are special-cased, because narration-URL persistence and lock release already depend on them today.
- Ordering state (`progress` last seen, whether a job already reached a terminal status) is tracked per `jobId`, in-memory, the same durability tradeoff `ChapterNarrationService.jobLockTokens` already accepts (lost on backend restart — not new to this change).

## Step 1: Relax `TtsStatusCallbackDto`, add `progress`

In `apps/backend/src/modules/tts-callbacks/dtos/tts-status-callback.dto.ts`:

- Replace `@IsIn(['queued', 'generating', 'uploading', 'completed', 'failed'])` on `status` with `@IsString()`. Keep the TS union type as documentation of what Beatrice currently sends, but stop rejecting a value smart-novel doesn't recognize.
- Add `progress?: number` (`@IsOptional() @IsInt() @Min(1)`) — present on in-progress callbacks, absent on terminal ones. Document in the field's docstring that a bigger number means later, nothing else, and its value/presence follows Beatrice's own `REQUIREMENTS.md`.

### AC

- A callback with an unrecognized `status` string (e.g. a new stage Beatrice ships tomorrow) is no longer rejected as a 400 — it's forwarded as-is.
- A callback with a `progress` field validates as long as it's a positive integer; a non-numeric `progress` still fails validation as today's malformed-body cases do.

### Test

- Update `tts-status-callback.dto.spec.ts`: add a case asserting an arbitrary/unrecognized `status` string now passes; add cases for valid/invalid `progress`.
- No GraphQL surface changed — skip graphql-api-tester.

## Step 2: Ordering guard in `ChapterNarrationService.handleStatusUpdate`

In `apps/backend/src/modules/novel/services/chapter-narration.service.ts`, track per-job progress state (a sibling map to `jobLockTokens`, e.g. `jobProgressState: Map<jobId, { lastSeen: number; terminal: boolean }>`), and gate the existing `pubSub.publish` behind it:

- If the job is already marked `terminal`, drop the callback (log at `.debug()`, return) — nothing after `completed`/`failed` should ever reach the frontend, whatever caused it to arrive late.
- If the incoming `status` is `completed` or `failed`, apply unconditionally (as today), mark the job `terminal`, and delete its `jobProgressState` entry (mirrors how `releaseJobLock` already cleans up `jobLockTokens` on the same transition).
- Otherwise, if `progress` is present and `progress <= lastSeen` (default `0` for a job seen for the first time), drop it (log at `.debug()`, return) — this is the case that fixes the reported bug: a late-arriving `queued` (progress 1) after `generating` (progress 2) is now recognized as stale.
- Otherwise apply and update `lastSeen = progress`.

A callback with no `progress` at all (shouldn't happen per Beatrice's contract for non-terminal statuses, but don't crash on it) applies unconditionally without touching `lastSeen` — treat it the same as before this change, rather than adding a validation error path for something that's Beatrice's contract to uphold, not ours to enforce.

### AC

- Given `generating` (progress 2) arrives before `queued` (progress 1) for the same job, the chapter's `chapterNarrationUpdated` subscription only ever reflects `generating` — `queued` is dropped, logged, never published.
- Given the normal order (`queued` then `generating` then `uploading` then `completed`), behavior is unchanged from today.
- A callback arriving after `completed`/`failed` for the same job is dropped, logged, never published.

### Test

- Unit (`chapter-narration.service.spec.ts`): out-of-order arrival (generating-then-queued) is deduped correctly; duplicate `progress` (same stage reported twice, e.g. from a Beatrice retry) is dropped; a callback after terminal is dropped; normal in-order flow is unaffected; `jobProgressState` entry is cleaned up on terminal, matching existing `jobLockTokens` cleanup.
- Integration (`apps/backend-e2e`): POST `generating` then `queued` (in that order) to `/beatrice-callbacks/status` for the same `jobId`/`clientContextId`, then assert (via the `chapterNarrationUpdated` subscription or the persisted chapter state) that the chapter never regresses to a `queued`-equivalent display state — this is the regression test for the actual bug report, per `.github/CONTRIBUTING.md`'s "add an integration test when a bug regressed the request/response contract."
- This step doesn't add/change a GraphQL operation's signature (only what a subscription emits, driven by REST callback ordering) — graphql-api-tester isn't the right tool here; the integration test above covers it directly.
