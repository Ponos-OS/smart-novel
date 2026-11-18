## 🚀 Quick Start

Prerequisites are Docker, Terraform, Go, [Task](https://taskfile.dev/installation) and the [`kind` CLI](https://kind.sigs.k8s.io/docs/user/quick-start). Learn more about kind cluster here [`infra/README.md`](../infra/README.md). If you need DevTools such as RedisInsight or pgAdmin, put this in `infra/terraform/local/1-app/terraform.tfvars` (git-ignored) and run `task dev:start` again:

```hcl
enable_devtools = true
```

Beatrice talks to an OpenAI-compatible LLM and an OpenAI-compatible speech endpoint; Fithara (the license assistant) talks to the same kind of LLM endpoint with its own model, one that the `llmcapa` model catalog knows.

- `task dev:start` sends the requests to the real provider you set in `.env`. Every call costs money.
- `task backend:test:e2e` and `task frontend:test:e2e` deploy WireMock (`infra/terraform/local/1-app/mocks/openai`) and point Beatrice and Fithara at it, whatever `.env` says, so the tests are free, fast and deterministic. To change an answer, edit the stub there.

```bash
BEATRICE_LLM_BASE_URL=https://api.openai.com/v1
BEATRICE_LLM_MODEL=gpt-4o-mini
FITHARA_LLM_MODEL=gpt-4.1-mini
BEATRICE_TTS_MODEL=gpt-4o-mini-tts
BEATRICE_DEFAULT_VOICE=alloy
BEATRICE_LLM_API_KEY=sk-...
BEATRICE_TTS_BASE_URL=https://api.openai.com/v1
BEATRICE_TTS_API_KEY=sk-...
BEATRICE_TTS_VOICES=alloy,nova
FITHARA_LLM_API_KEY=sk-...
```

`BEATRICE_DEFAULT_VOICE` must be one of `BEATRICE_TTS_VOICES`. Without `BEATRICE_LLM_BASE_URL` and `BEATRICE_TTS_BASE_URL`, `task dev:start` skips Beatrice and RabbitMQ.

```bash
pnpm install --frozen-lockfile
task dev:start
```

## Where to Change Things (Infrastructure)

- A new component (a database, a worker, a tool): add `infra/terraform/modules/<component>` with only the inputs it needs and a `.tftest.hcl`, then call it from `infra/terraform/modules/app`. A module that serves HTTP contributes its ingress routes (`name`, `path`, `service_name`, `service_port`) through a `routes` output, and `modules/app` puts them in its `Ingress`. What a shared cluster would provide (ingress controller, ZITADEL server, observability) is called only from `local/1-app`.
- A new variable in a module: give it a default that suits local development, and set it in an environment only if that one differs.
- A change to ZITADEL itself (a role, an application, a user, a policy): `infra/terraform/modules/zitadel_config`, with the local values in `infra/terraform/local/2-zitadel-config/main.tf`. `task dev:start` applies it between the cluster and the workloads. What the workloads need from it (client ID, PAT) reaches them as environment settings from `local/1-app`.
- A new application setting (`.env` key): add it to `.env.example`. `local/1-app` hands the whole `.env` to the backend, the `VITE_` keys to the frontend, and keys that look like secrets (`PASSWORD`, `SECRET`, `MASTERKEY`, `ACCESS_KEY`) go to a Secret. Values that depend on a deployed component are filled in by `modules/app`.
- Anything specific to one environment (hot reload, host ports, devtools, which images run): `infra/terraform/<environment>`, passed to `module "app"` as generic inputs. Modules must be identical in every environment, so they never mention `dev`, `local` or `kind`.
- An external service instead of an in-cluster one: set the matching `*_url` input of `module "app"`.
- Personal overrides: `infra/terraform/local/1-app/terraform.tfvars`.

## Dependency Injection (Fx)

The backend is wired with [Fx](https://github.com/uber-go/fx) in `apps/backend/cmd/server/main.go`; there is no global state to reach for. Each package exposes `var Module = fx.Module(...)` with its constructors (an adapter when a constructor takes an interface or a config value). Whatever runs for the life of the process (a listener, a loop) is started and stopped in a lifecycle hook (`background.Keep` for a loop), never with a bare `go` in a constructor. An endpoint other services call is contributed with `route.Provide` and a GraphQL extension with `server.AsExtension`, so the server does not import its contributors. `TestOptionsWireEveryDependency` fails when a dependency is missing.

## Database Migration Guide (ent and Atlas)

The schema lives in `apps/backend/ent/schema`. Two paths build the same tables:

- The local stack and the e2e tests set `DEV_SYNC_DATABASE_SCHEMA=true`, and the backend brings the tables up to date at startup (`client.Schema.Create`). It keeps no history.
- Production applies the versioned SQL files in `apps/backend/ent/migrate/migrations` with [Atlas](https://atlasgo.io), in the `migrate` target of `apps/backend/Dockerfile` (the `backend-migrate` Job). `DEV_SYNC_DATABASE_SCHEMA` is never set there.

So every schema change needs its migration, or production drifts from what dev and the tests run on. A feature gets exactly one migration, written at its very last step, never one per step: while the feature is being built, change `ent/schema` and let the startup path apply it. Do not create a migration file during the feature. At the end:

```bash
task backend:migrate:diff -- <feature_name>
```

`migrate:diff` starts a throwaway PostgreSQL in Docker, replays the existing migrations on it and writes the difference to the ent schema as `<timestamp>_<feature_name>.sql` plus the new `atlas.sum`. Read the SQL before keeping it.

Never edit a migration that was merged. SQL ent cannot express (an extension, for example) goes in its own hand-written file, with `atlas.sum` rewritten by `cmd/migrategen` or `atlas migrate hash`. `20260101000000_extensions.sql` is the one so far.

There are no Go integration tests that need Docker: what needs a real PostgreSQL is covered by `backend-e2e`.

## Design & Code Philosophy

All contributors (including AI-assisted tools) should follow the project's coding philosophy:

- When you use an LLM model to developer a feature use another model to code review it with this message:
  - Be critical.
  - Look for corner cases and potential performance issues.
  - Look at the code and tests, do they make sense.
  - Do we have a better write the same code in a more readable and maintainable manner.
- Add the prompt you fed into LLM and the follow up discussions with it in the GitHub issue (for this you can create a markdown file when we finished working on a feature). This way we know what we have done.
- Write code at a senior engineer level.
- Prefer early returns over nested conditionals.
- Optimize for readability and maintainability.
- Avoid unnecessary abstractions.
- Use descriptive variable, function, and class names.
- Follow linting, formatting, and test conventions.
- Go error handling: return errors, do not log and return them. Wrap with `fmt.Errorf("doing x: %w", err)` only when the wrapper adds what the caller cannot know; compare with `errors.Is`/`errors.As`, never by message. A domain package returns an `apperr` error for what a client may read; everything else reaches the client as a generic internal error. Do not `recover` or ignore an error (`_ =`) except where a comment says why it is harmless.
- Do **NOT** add a barrel `index.ts` in the "frontend" app, for a Vite-powered SPA you should **NOT** because:
  - Tree-shaking happens still for the production builds, but it **hurts dev server startup and HMR performance** because Vite eagerly transforms every module the barrel re-exports, even if you only need one.
  - When you do `import { getInitials } from '../../utils'`, Vite (and Rollup under the hood) has to parse the entire barrel to figure out what's exported.
- Nothing is shared through a spec file. The backend owns its error codes (`apps/backend/internal/apperr`) and sends a readable English `message`, which the UI shows; the UI branches only on the `extensions.code` values listed in `apps/frontend/src/lib/api-error-codes.ts`, each also named in the description of the schema field that can return it. The limits of the input rules live in the schema (`@maxLength`, `@minLength`, `@maxSize` in `apps/backend/api`); `task frontend:generate` runs `tools/gensdl`, which turns them into `apps/frontend/src/generated/limits.ts` (git-ignored). The constant is named after where the rule sits: `RequestWriterAccess.note` with `@maxLength(max: 1000)` is `REQUEST_WRITER_ACCESS_NOTE_MAX_LENGTH`, an input type field is `<INPUT_TYPE>_<FIELD>_...` and the suffixes are `MAX_LENGTH`, `MIN_LENGTH` and `MAX_SIZE`. Roles are written once in each app (`apps/backend/internal/auth/role.go`, `apps/frontend/src/lib/role.ts`).
- The Go backend (`apps/backend`) derives its GraphQL schema from `ent/schema`; `api/*.graphql` only `extend`s it with what is not entity CRUD. After changing either, run `task backend:generate` (ent, gqlgen and the Fithara client; it downloads Fithara's `openapi.json` for the `FITHARA_VERSION` of `.env` first; everything it writes is git-ignored except the resolvers). `task backend:serve` reloads on save. The generators run on the host, never in a container that mounts the sources.
- GraphQL names follow Go names, initialisms capitalized (`novelID`, `userIDs`, `coverURL`), because entgql derives its names from the ent fields and cannot rename them. ESLint enforces it on `apps/backend/api/*.graphql` (`@graphql-eslint/naming-convention`, `task backend:lint:check` and the pre-commit hook); `ent.graphql` is generated and skipped.
- Every root field of the Go GraphQL schema needs an authenticated viewer by default (`auth.Guard`). Mark a field `@public` to open it, or `@hasRole(role: writer)` to ask for a role. Ownership rules (who may change a novel or a chapter) are the rules of `auth.Can(viewer, action, resource)` in `apps/backend/internal/auth/authz.go`; the service that has the owner's user ID calls it. Authentication failures answer with the codes `UNAUTHENTICATED` and `FORBIDDEN`.
- Where code lives in a domain package of `apps/backend/internal` (`novel`, `chapter`, `tag`): `service.go` is the use cases (authorization with `auth.DenyUnlessCan`, business rules, transaction boundaries, mapping database errors to `apperr`); `repository.go` is an unexported `repository` struct that is the only place that builds ent queries or raw SQL, decides nothing and returns the database's own errors. No interface: add one only when a second implementation or a test double needs it. Inside `entx.WithTx` make it from the transaction's client, `newRepository(tx.Client())`. Raw SQL goes only in a repository, with a comment saying why ent cannot do it. Two things query ent outside a repository, on purpose: entgql's `Paginate` in the resolvers of the list fields, and the dataloaders in `internal/graph/loaders.go`; `novel/filter.go` and `novel/page.go` are list-query builders for those resolvers. A package that only reads the planner's estimates (`stats`) has no repository.
- The Go structs of the GraphQL input types are generated by gqlgen into `apps/backend/internal/graph/model` and used by the services as they are; do not write a twin and bind it in `gqlgen.yml`. Bind a type only to ent (enums) or when it carries behavior of its own.
- Lists, filters, ordering and cursors come from ent (`entgql.RelayConnection`, `QueryField`, the `*WhereInput` and `*Order` types); a hand-written operation in `apps/backend/api` is only for what ent cannot express. Before adding a `QueryField`, an edge or a field, read `api/ent.graphql` after `task backend:generate` and `entgql.Skip` whatever a visitor must not see (the writer's email, the requester of a tag). A resolver bounds `first`/`last` with `internal/pagination.Bound`, relies on the schema directives for its input (`@isString`, `@maxLength`, `@maxSize` in `api/validation.graphql`; cross-field rules are a Go method on the generated input type, in `apps/backend/internal/graph/model`), and calls the service; the service checks `auth.Can` (through `auth.DenyUnlessCan`) on the row it loaded. Lookups a list repeats per row go through `internal/graph/loaders.go`.
- Adding to the GraphQL API: a field on an entity is an ent field (`ent/schema`, with `entgql.Skip` for what a visitor must not see); then `task backend:generate`, run the resolver stubs gqlgen wrote in `apps/backend/internal/graph`, and call a service that does the work. An operation that is not entity CRUD is declared in `apps/backend/api/*.graphql` with the input directives (`@isString`, `@maxLength`, `@maxSize`), and a root field needs `@public` or `@hasRole` to differ from the default. Then the e2e test in `apps/backend-e2e`, the frontend `.graphql` document next to its feature (`apps/frontend/src/**/*.graphql`) and `task frontend:generate`.
- Demo data (`task backend:seed`, `apps/backend/tools/devdata`, the data in `apps/backend/data`) fills the default license, the seeded writers and generated novels for the local stack and the e2e tests, never production. `DEVDATA_NOVELS_COUNT`, `DEVDATA_CHAPTERS_COUNT_PER_NOVEL` and `DEVDATA_RANDOMIZER_SEED_NUMBER` of `.env` (or `task backend:seed -- --novels-count 100 --chapters-count-per-novel 20`) add generated novels, the same ones for the same seed, from the tools module (gofakeit lives only there); the `backend-init` Job runs it. Text input is cleaned and checked by the schema directives: `@isString` (one line for names and titles, `multiline: true` for descriptions and chapters, `allowEmpty: true` when blank is fine), then `@maxLength` and `@maxSize`. Put the directives on every new hand-written input or argument.
- Use Task targets (`task --list`) instead of raw commands whenever it is possible.
- A side-effect call from within a mutation that already committed its primary write (e.g. triggering Beatrice's `generateAudio` after `updateContent` persists) must not let the side effect's failure fail the whole mutation — log the error and continue.
- Do **NOT** model viewer‑specific state via root queries or parent aggregations when it conceptually belongs to a child entity. In GraphQL, viewer-specific data must respect graph locality and viewer context: state like “read”, “liked”, or “bookmarked” belongs on the entity it applies to (e.g. Chapter.isRead as a viewer-specific field), not as a root query or a Novel‑level shortcut, unless explicitly documented as a temporary or performance‑driven exception.

  ✅ Good (local, viewer-aware)

  ```graphql
  type Chapter {
    id: ID!
    title: String!
    isRead: Boolean! # viewer-specific
  }
  ```

  ❌ Avoid (breaks locality / RPC-style / root Query turns into a junk drawer after some time)

  ```graphql
  type Query {
    readChapters(novelId: ID!): [ID!]!
  }

  type Novel {
    readChapters: [ID!]!
  }
  ```

- For incident-specific findings (a quirky framework behavior, a third-party breaking change, a "found this the hard way" note) that don't belong in a standing rule above, see `.github/docs/gotchas.md`. Check it when working in the area a bullet there names; it isn't meant to be read every session.

## Test Conventions

To run tests:

```bash
# starts storybook
task frontend:storybook
# Unit tests of the backend and the frontend
task test
# Run all frontend e2e tests
task frontend:test:e2e
# Run all backend e2e tests
task backend:test:e2e
```

- If you change/add something make sure to write/update and then run the unit/e2e tests.
- Frontend and e2e tests use vitest; Go tests use the standard `testing` package (below).
- Use `it` instead of `test`.
- Use `it.each` whenever it make sense.
- Use jest-extended APIs whenever appropriate.
- Use AAA (Arrange, Act, Assert) style of writing test.
  - Use new line as an indicator of each step!
- Add fixtures only when it makes my tests more readable (but in general prefer to write them inside the test body).
- Mock with vitest (`vi.fn`, `vi.mock`).
- Use `uut` (unit under test) **only** when you instantiate an object whose **methods** you will exercise in the test. For example: `uut = MyService(...)` followed by `uut.do_something()`.
- When testing a **function** (or a constructor where you just assert on the returned value), name the variable after what it represents — e.g. `result`, `settings`, `payload`, etc. Do **not** call it `uut` in that case.
- Always ask what we should and what we should **NOT** mock.
- Go tests (`apps/backend`): `*_test.go` next to the file under test and named after it (`service.go` and `service_test.go`), in the package `<name>_test`. Table tests with `t.Run(name, ...)` for the same behavior over several inputs, one test per behavior otherwise; Arrange, Act and Assert separated by blank lines, early returns, `t.Fatalf` for a failed precondition and `t.Errorf` for the assertion. Nothing in a test needs Docker: what needs a real PostgreSQL, Redis or ZITADEL is covered by `backend-e2e`. Do not add code to production files only so a test can reach it.
- For e2e tests make sure to keep the GraphQL queries/mutations written in the same test file.
- Mocked values should resemble actual domain data (read the code to understand what would the actual domain data would look like):
  - Use realistic data (IDs, hashes, slugs, emails, URLs, etc.):
    ```ts
    const novelId = '93fec4bf-2f66-4e4a-9572-7aa4871f1458'; // ✅ DO (GOOD)
    const novelId = 'novel-id'; // ❌ DO NOT (BAD)
    ```
  - When data is excessively large, use a short meaningful stub:
    ```ts
    const html = '<html> ... trimmed ... </html>'; // ✅ DO (GOOD)
    const html = 'dummy'; // ❌ DO NOT (BAD)
    ```
- See `apps/backend/internal/**/*_test.go` for examples for backend and `apps/frontend/src/**/*.spec.ts` for examples for frontend.
- See `apps/backend-e2e/src/**/*.e2e-spec.ts` for examples for backend e2e tests and `apps/frontend-e2e/src/e2e/**/*.cy.ts` for examples for frontend e2e tests.
- If you need to upgrading 3rd party libs: `.github/docs/update-npm.md`.
- Storybook and Cypress e2e are not interchangeable — pick the tier by what's actually at risk, not by which is cheaper to write:
  - **Storybook** (component isolation, mocked data/hooks): visual states and in-component interaction logic. Cannot verify authorization/permission logic (you control the mocked response, so a broken real check still "passes") or real auth integration (ZITADEL login/redirect/token exchange never actually runs against mocked auth state).
  - **`backend-e2e`**: authorization/permission logic against the real API (e.g. "can this role/ownership combination perform this mutation"). This is the right layer for permission-boundary coverage, not `frontend-e2e`.
  - **`frontend-e2e` (Cypress)**: real browser + real stack coverage that neither of the above can fake — most notably the real ZITADEL login/redirect/callback flow, and full user journeys spanning multiple pages/services.
  - A feature that only adds new UI states on top of an already `backend-e2e`-tested permission check can reasonably skip a new Cypress spec and rely on Storybook + unit tests instead — that's a deliberate scope call per-feature, not a rule that Storybook replaces Cypress in general.

#### Run E2E Tests Locally

```bash
task dev:start
pnpm exec cypress open --project apps/frontend-e2e
```

`task backend:test:e2e` and `task frontend:test:e2e` start their own cluster with the production images (`infra/scripts/start-dev.sh e2e`) and tear it down afterwards. They cannot run next to `task dev:start` (both use host port 8080), so run `task dev:stop` first.
