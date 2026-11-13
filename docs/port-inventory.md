# Port inventory: NestJS to Go

Kept until step 11 of `REQUIREMENTS.md`. One row per thing the NestJS app (`apps/backend-nest`) exposes, with the Go home and the step that ports it. `backend-e2e` stays TypeScript and is the parity oracle: a step is done for an operation when its spec passes against the Go backend.

## Step grouping

The grouping in `REQUIREMENTS.md` holds, with these corrections found while reading the code:

- `createNovelCoverUploadUrl` and `setNovelCover` need object storage, so they move from step 6 to step 8.
- `Novel.license` and `defaultLicense` cross the catalog/license boundary: the field resolver lands in step 7 with licenses, and step 6 leaves it out of the schema.
- `explain` (the LLM word explainer) needs Beatrice, so it is step 8, not step 7.
- `generateChapterAudio`, the `chapterNarrationUpdated` subscription and the Beatrice callbacks are one feature: step 8.
- `whoAmI` is step 5 (it needs the viewer); `health` is already ported (step 3).
- `modules/category` and `modules/writer-request` hold no source files; nothing to port.

## NestJS modules

| Module                                                           | Go package                                                            | Step                       |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------- |
| app (`AppResolver.health`, config, logger, OTel)                 | `cmd/server`, `internal/{config,server,platform/{logging,telemetry}}` | 3                          |
| auth (JWT guard, ZITADEL provider, roles/policies guards, CASL)  | `internal/auth`                                                       | 5 (done)                   |
| zitadel management client (project grants)                       | `internal/platform/zitadel`                                           | 7                          |
| prisma                                                           | `ent`, `ent/migrate`                                                  | 4                          |
| cursor (signed cursors, audience)                                | `internal/pagination`                                                 | 6 (done)                   |
| tag                                                              | `internal/tag`                                                        | 6 (done)                   |
| novel (novel, chapter, chapter content, read state, dataloaders) | `internal/novel`                                                      | 6 (cover: 8, narration: 8) |
| stats (content stats, snapshot cron)                             | `internal/stats`                                                      | 6 (cron: 8)                |
| license, license-assistant, fithara                              | `internal/license`, `internal/platform/fithara`                       | 7                          |
| platform-terms                                                   | `internal/platformterms`                                              | 7                          |
| writer                                                           | `internal/writer`                                                     | 7                          |
| redis                                                            | `internal/platform/redis`                                             | 8                          |
| object-storage                                                   | `internal/platform/objectstorage`                                     | 8                          |
| llm (word explainer)                                             | `internal/llm`                                                        | 8                          |
| tts-callbacks, Beatrice client (`shared/beatrice`)               | `internal/narration`, `internal/platform/beatrice`                    | 8                          |
| zitadel-events                                                   | `internal/zitadelevents`                                              | 8                          |
| background-runner                                                | `internal/platform/background`                                        | 8                          |

## GraphQL operations

`Query`:

| Operation                                                                         | Module            | Step     |
| --------------------------------------------------------------------------------- | ----------------- | -------- |
| `health`                                                                          | app               | 3 (done) |
| `whoAmI`                                                                          | auth              | 5 (done) |
| `tagsConnection` (now `tags`)                                                     | tag               | 6 (done) |
| `novel`, `novelsConnection` (now `novels`)                                        | novel             | 6 (done) |
| `contentStats`, `statsSnapshotsConnection` (now `statsSnapshots`)                 | stats             | 6 (done) |
| `defaultLicense`, `licensesConnection`, `licenseDraftsConnection`, `licenseDraft` | license           | 7        |
| `canonicalLicenses`, `canonicalLicense`                                           | license-assistant | 7        |
| `platformTerms`, `myPlatformTermsStatus`                                          | platform-terms    | 7        |
| `myWriter`, `writers`                                                             | writer            | 7        |

`Mutation`:

| Operation                                                                               | Module            | Step     |
| --------------------------------------------------------------------------------------- | ----------------- | -------- |
| `requestTag`, `createTag`, `approveTag`, `updateTag`, `deleteTag`                       | tag               | 6 (done) |
| `createNovel`, `updateNovel`, `deleteNovel`                                             | novel             | 6 (done) |
| `createChapter`, `updateChapter`, `updateContent`, `deleteChapter`                      | novel             | 6 (done) |
| `markChaptersRead`, `deleteReadHistory`                                                 | novel             | 6 (done) |
| `createNovelCoverUploadUrl`, `setNovelCover`                                            | novel             | 8        |
| `generateChapterAudio`                                                                  | novel             | 8        |
| `explain`                                                                               | llm               | 8        |
| `createLicense`, `setDefaultLicense`                                                    | license           | 7        |
| `createLicenseDraft`, `saveLicenseDraft`, `finalizeLicenseDraft`, `discardLicenseDraft` | license           | 7        |
| `draftLicense`                                                                          | license-assistant | 7        |
| `acceptPlatformTerms`                                                                   | platform-terms    | 7        |
| `requestWriterAccess`, `approveWriter`, `rejectWriter`                                  | writer            | 7        |

`Subscription`: `chapterNarrationUpdated` (graphql-ws over an in-memory `PubSub`, so one backend replica) | novel | 8. gqlgen needs its websocket transport, which step 3 leaves out.

Fields NestJS resolves separately from the entity (the ones that are not plain columns); each is a gqlgen resolver or an entgql computed field:

| Field                                                                                                                                                                  | Step                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `Novel.allowedActions`, `Novel.chapter`, `Novel.chaptersConnection`, `Novel.firstChapter`, `Novel.lastPublishedChapter`, `Novel.estimatedChapterCount`, `Novel.writer` | 6 (done)              |
| `Novel.coverUrl` (needs the object storage public URL)                                                                                                                 | 8                     |
| `Novel.license`                                                                                                                                                        | 7                     |
| `Chapter.next`, `Chapter.previous`, `Chapter.content`, `Chapter.narrationUrl`, `Chapter.viewerState`                                                                   | 6 (`narrationUrl`: 8) |
| `ChapterConnection.totalCount`                                                                                                                                         | 6 (done)              |
| `Tag.approximateNovelCount`, `Tag.requesterUserId`                                                                                                                     | 6 (done)              |
| `License.officialUrl`, `License.scope`                                                                                                                                 | 7                     |

Treat this list as a hypothesis: step 6 and 7 read the NestJS resolvers again and the frontend `.graphql` documents, which are the real contract.

## REST and webhook endpoints

| Endpoint                                                                     | Caller             | Step     |
| ---------------------------------------------------------------------------- | ------------------ | -------- |
| `POST /graphql`                                                              | frontend, e2e      | 3 (done) |
| `POST /beatrice-callbacks/gen-upload-url`, `POST /beatrice-callbacks/status` | Beatrice           | 8        |
| `POST /zitadel-events/user-added` (HMAC `ZITADEL-Signature`, raw body)       | ZITADEL Actions v2 | 8        |

## Background work

| Job                                                                              | How it runs today                                                                                                    | Step |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---- |
| Stats snapshot                                                                   | cron from `STATS_SNAPSHOT_CRON`, plus a catch-up at startup when today's row is missing; at most one row per UTC day | 8    |
| Fire-and-forget side effects (Beatrice audio after `updateContent`, and similar) | `BackgroundRunnerService`: keeps the OTel context, logs and swallows errors                                          | 8    |
| Queue consumers or producers                                                     | none in this app: RabbitMQ belongs to Beatrice                                                                       | none |

## Environment keys the backend reads

Keys in `apps/backend-nest/src/app/configs/app.config.ts`, from `.env.example` and what `infra/terraform` adds. `internal/config` grows with each step; it fails at startup, listing every mistake at once.

| Keys                                                                                                                                                                                                                                                                                   | Go home                           | Step                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`, `APP_ENV`, `CORS_ALLOWED_ORIGINS`, `LOG_FORMAT`, `LOG_LEVEL`, `SERVICE_NAME`, `OTEL_*` (`ENABLED`, `EXPORTER_OTLP_ENDPOINT`, `TRACES_SAMPLER`, `TRACES_SAMPLER_ARG`, `BATCH_*`, `LOGS_EXPORTER`)                                                                               | `internal/config`                 | 3 (done)                                                                                                                                                                                                                                                       |
| `DATABASE_URL`                                                                                                                                                                                                                                                                         | `internal/config`, ent client     | 4                                                                                                                                                                                                                                                              |
| `ZITADEL_ISSUER_URL`, `ZITADEL_INTERNAL_URL`, `ZITADEL_DOMAIN`, `ZITADEL_PROJECT_ID`, `ZITADEL_CLIENT_ID`(`_FILE`), `ZITADEL_CLIENT_SECRET`, `ZITADEL_PAT`(`_FILE`), `ZITADEL_CALLBACK_URL`, `ZITADEL_POST_LOGIN_URL`, `ZITADEL_POST_LOGOUT_URL`, `SESSION_SECRET`, `SESSION_DURATION` | `internal/auth`                   | 5 (done for `ZITADEL_ISSUER_URL`, `ZITADEL_INTERNAL_URL` and the new `ZITADEL_INTROSPECTION_CLIENT_ID` and `_SECRET`; the PATs are for step 7; check which of the session and callback keys the Go backend still needs: they exist for the NestJS cookie flow) |
| `CURSOR_SIGNING_SECRET` (dropped: ent cursors are not signed)                                                                                                                                                                                                                          | `internal/pagination`             | 6 (done)                                                                                                                                                                                                                                                       |
| `ZITADEL_MANAGEMENT_PAT`                                                                                                                                                                                                                                                               | `internal/platform/zitadel`       | 7                                                                                                                                                                                                                                                              |
| `FITHARA_URL`, `FITHARA_TIMEOUT` (and the build-time `FITHARA_VERSION`)                                                                                                                                                                                                                | `internal/platform/fithara`       | 7                                                                                                                                                                                                                                                              |
| `REDIS_URL`, `REDIS_PASSWORD`                                                                                                                                                                                                                                                          | `internal/platform/redis`         | 8                                                                                                                                                                                                                                                              |
| `OBJECT_STORAGE_REGION`, `_ENDPOINT`, `_ACCESS_KEY`, `_SECRET_KEY`, `_BUCKET`, `_PUBLIC_URL`                                                                                                                                                                                           | `internal/platform/objectstorage` | 8                                                                                                                                                                                                                                                              |
| `BEATRICE_URL`, `BEATRICE_TIMEOUT`, `BEATRICE_DEFAULT_VOICE` (and `BEATRICE_VERSION`), `BACKEND_INTERNAL_URL`                                                                                                                                                                          | `internal/platform/beatrice`      | 8                                                                                                                                                                                                                                                              |
| `LLM_CACHE_TTL`, `EXPLAIN_CONTEXT_CHAR_SIZE`                                                                                                                                                                                                                                           | `internal/llm`                    | 8                                                                                                                                                                                                                                                              |
| `ZITADEL_WEBHOOK_SIGNING_KEY`                                                                                                                                                                                                                                                          | `internal/zitadelevents`          | 8                                                                                                                                                                                                                                                              |
| `STATS_SNAPSHOT_CRON`                                                                                                                                                                                                                                                                  | `internal/stats`                  | 8                                                                                                                                                                                                                                                              |
| `NODE_ENV` (replaced by `APP_ENV`)                                                                                                                                                                                                                                                     | none                              | done in step 1                                                                                                                                                                                                                                                 |

`BEATRICE_LLM_*`, `BEATRICE_TTS_*`, `FITHARA_LLM_*` and the `POSTGRES_*`, `REDIS_*`, `ZITADEL_MASTERKEY` keys are read by other containers (Beatrice, Fithara, Postgres, Redis, ZITADEL), not by this app.

## Cross-cutting behaviour to carry over

| NestJS                                                                                           | Go                                                                                                                   | Step                                   |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `x-trace-id` response header (`TraceIdInterceptor`)                                              | `traceIDHeader` middleware                                                                                           | 3 (done)                               |
| CORS with credentials, origins from `CORS_ALLOWED_ORIGINS`                                       | `rs/cors` in `internal/server`                                                                                       | 3 (done)                               |
| Apollo introspection and landing page off in production                                          | `extension.Introspection` and the GET playground only outside production                                             | 3 (done)                               |
| `formatError`: log every error, hide internals, `INTERNAL_SERVER_ERROR` code, `CONFLICT` for 409 | `errorPresenter` and the `ClientError` interface (code and message a client may see)                                 | 3 (done); typed domain errors per step |
| Span renamed after the GraphQL operation (`graphqlSpanRenamePlugin`)                             | a gqlgen `OperationContextMutator` (`internal/server/tracing.go`)                                                    | 3 (done)                               |
| Query depth limit 7 (`graphql-depth-limit`)                                                      | `depthLimit` in `internal/server/depth.go`                                                                           | 5 (done)                               |
| `ValidationPipe` (whitelist, forbid unknown fields, transform)                                   | gqlgen rejects unknown input fields; ent validators and domain checks replace `class-validator`                      | 6 and 7                                |
| 1 MB JSON body limit (license assistant carries the conversation)                                | `http.MaxBytesReader` on `/graphql`                                                                                  | 7                                      |
| JWT guard, `@Public`, `@Roles`, `@Policies`, CASL abilities                                      | `auth.Middleware`, `auth.Guard` with the `@public` and `@hasRole` markers, the functions in `internal/auth/authz.go` | 5 (done)                               |
| Raw body kept for the ZITADEL signature                                                          | read the body before decoding in that handler                                                                        | 8                                      |

## Infrastructure tied to the backend image

| Today                                                                                                                                                              | Change                                                                                                                                                                                                     | Step     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `backend-init` Job in `local/1-app` (`prisma db push`, `generate`, `seed` (now `devdata`) with the example novel in `apps/backend-nest/data` and `SEEDED_WRITERS`) | Removed in step 3: the Go backend has no schema yet. Migrations arrive in step 4; the seed (example novel, seeded writers, the `/data` volume) comes back as a Go command once the entities it needs exist | 4 to 7   |
| `frontend-codegen` Job (ran in the NestJS dev image)                                                                                                               | Removed in step 3: `build-images.sh` runs `task frontend:generate` on the host in both modes                                                                                                               | 3 (done) |
| Hetzner `backend-migrate` Job (`var.migrate_image`, `prisma migrate deploy`)                                                                                       | Atlas migrations in the `migrate` target of `apps/backend/Dockerfile`                                                                                                                                      | 4 (done) |
| `smart-novel-backend` image                                                                                                                                        | Go (`apps/backend/Dockerfile`, targets `development` and `production`); the NestJS Dockerfile stays for reference                                                                                          | 3 (done) |
| Health probe `POST /graphql { health }`                                                                                                                            | Unchanged: the Go image has `curl` and answers the same query                                                                                                                                              | 3 (done) |

## Parity oracle

`apps/backend-e2e/src/backend/*.e2e-spec.ts`, mapped to steps:

| Specs                                                                                                                                                                                                                                  | Step                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `app`                                                                                                                                                                                                                                  | 3                                                |
| `auth`                                                                                                                                                                                                                                 | 5                                                |
| `tags`, `cursor-validation`, `novels`, `novel-list`, `novel-first-chapter-created-at`, `novel/*` except cover, `chapter`, `chapter-delete`, `chapter-user-state`, `content-stats`, `stats-snapshot` (the cron part: 8), `novel-writer` | 6 (done)                                         |
| `license`, `license-drafts`, `licenses-connection`, `platform-terms`, `writer`, `writer-review`                                                                                                                                        | 7                                                |
| `novel/novel-cover`, `chapter-narration/*`, `beatrice-callbacks`, `llm`                                                                                                                                                                | 8                                                |
| `ingress-routing`                                                                                                                                                                                                                      | 10 (it tests ZITADEL's ingress, not the backend) |
