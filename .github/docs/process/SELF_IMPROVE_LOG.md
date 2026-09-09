# Self-improvement log

## Step 1a — 2026-09-09

- Change: `PROCESS.md` step 7 now says to verify `.husky/_/*` hooks are executable before trusting a commit ran lint-staged. `.husky/_/` is gitignored/generated and wasn't executable in this environment, so `git commit` silently skipped `pre-commit`/`prepare-commit-msg`/`commit-msg`/`post-commit` (git only printed an informational hint, didn't fail). Fixed with `chmod +x .husky/_/*`.
- Change: `PROCESS.md` step 6 now says to grep the service's own logs for a positive confirmation line, not just trust `service_healthy`, for infra-only steps. Beatrice's healthcheck passing didn't by itself prove it connected to the newly-added RabbitMQ; only the `"worker ready"` log line did.
- No AC/scope surprises for this step — compose bump + RabbitMQ service was exactly as scoped, no code changes needed, matching the AC's "infra/compose only" note.

## Step 1b — 2026-09-09

- Change: added two reusable code gotchas to `.github/CONTRIBUTING.md` (not `PROCESS.md` — these are code patterns, not step-loop process): (1) the three global auth guards run on REST routes too and read the request via a `GqlExecutionContext` quirk that happens to work for Express but shouldn't be relied on blindly; new REST routes needing different token semantics should go `@Public()` + a dedicated guard using `switchToHttp().getRequest()`. (2) pin sibling `@aws-sdk/*` v3 packages to the same resolved release as `@aws-sdk/client-s3` to avoid `@smithy` structural type conflicts.
- Also surfaced, not fixed (out of this step's scope): `nx e2e backend-e2e` has 5 reproducible (not flaky — same failures across two full runs) pre-existing failures around `generateTtsFriendlyText`/chapter-narration, root-caused to Beatrice's `normalizeTextForTts` returning an empty completion for the local `llama3.2:3b` model, which Beatrice's own length-deviation safety check then rejects. This code is deleted wholesale in Step 2.0, so no fix is warranted here — flagging so it isn't mistaken for a regression introduced by a later step.
- AC-writing note (not promoted to `PROCESS.md`, only one data point so far): Step 1b's prose asked to set `GENERATE_AUDIO__CALLBACK__ALLOWED_HOSTS`, but that requirement wasn't mirrored as its own `### AC` bullet — only caught because `build-step` already reads the full step section, not just the AC list. Worth watching for a second occurrence before turning into a process rule.
- The presigned-URL TTL (5 minutes) and object-key prefix (`tts-audio/<jobId>.mp3`) were implementation choices, not spelled out numerically in the AC ("short-lived (minutes, not hours)") — recorded here in case a later step needs the exact values: `GenUploadUrlController.PRESIGNED_URL_TTL_SECONDS` / `OBJECT_KEY_PREFIX`.

## Step 1c — 2026-09-09

- Real bug caught only by the full e2e run (not by unit tests or `tsc`): `TtsStatusCallbackDto` referenced `TtsStatusCallbackErrorDto` (declared later in the same file) as a property type. `emitDecoratorMetadata`'s `design:type` reference isn't lazy like `@Type(() => X)`, so this crashed the production webpack bundle at boot with a TDZ `ReferenceError` — the `backend-e2e` container itself failed to start, before any test ran. Fixed by reordering; documented the rule in `CONTRIBUTING.md` since it's a silent trap (compiles, unit-tests, and `tsc` all pass fine).
- Also added to `CONTRIBUTING.md`: `reflect-metadata` must be imported in `vitest.setup.ts` for any spec that calls `class-validator`'s `validate()` on a decorated class directly — this was the first such spec, and it failed with `Reflect.getMetadata is not a function` without it.
- Added to `PROCESS.md`: when `docker compose up --wait` itself fails (not a test failure), the e2e global-teardown never runs and the stack is left up — `down -v` it manually before retrying, discovered after the TDZ crash above left `backend-e2e`'s failed-boot stack running.
- New capability introduced this step: `RedisService.publish()` (didn't exist before) and a `TTS_STATUS_CHANNEL` constant in `tts-callbacks/constants.ts` — Step 2.1/2.2 (persist audio URL, bridge to GraphQL subscription) will subscribe to that same channel.
