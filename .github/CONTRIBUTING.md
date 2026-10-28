## 🚀 Quick Start

Prerequisites are Docker, Terraform and the [`kind` CLI](https://kind.sigs.k8s.io/docs/user/quick-start). Learn more about kind cluster here [`infra/README.md`](../infra/README.md). If you need DevTools such as RedisInsight, pgAdmin or Open WebUI, put this in `infra/terraform/envs/local/terraform.tfvars` (git-ignored) and run `npm run start:dev` again:

```hcl
enable_devtools = true
```

<details><summary>To skip the heavy models (Ollama, OpenAI-compatible TTS, and with them Beatrice), set <code>RUN_LOCAL_AI_MODELS=false</code> in the <code>.env</code></summary>

Beatrice talks to an OpenAI-compatible LLM and an OpenAI-compatible speech endpoint.

`RUN_LOCAL_AI_MODELS` in `.env`, picks where the requests must go when starting the app (`npm run start:dev`) or running the tests (`nx e2e backend-e2e`).

Local models utilize Ollama and the bundled `local-setup/openai-compatible-tts`. Then we do not need to change anything [`terraform.tfvars`](../infra/terraform/envs/local/terraform.tfvars); set these in `.env`:

```bash
RUN_LOCAL_AI_MODELS=false
BEATRICE_LLM_MODEL=gpt-4o-mini
BEATRICE_TTS_MODEL=gpt-4o-mini-tts
BEATRICE_DEFAULT_VOICE=alloy
```

Then put the endpoints and keys in `infra/terraform/envs/local/terraform.tfvars`:

```hcl
llm_base_url = "https://api.openai.com/v1"
llm_api_key  = "sk-..."
tts_base_url = "https://api.openai.com/v1"
tts_api_key  = "sk-..."
tts_voices   = "alloy,nova"
```

`BEATRICE_DEFAULT_VOICE` must be one of `tts_voices`.

> [!IMPORTANT]
>
> The LLM and speech endpoints cannot be mixed (one local, one external) with the current switch.

Every call to a paid provider costs money, so run only the specs that you are interested in: Narrow `include` in [`apps/backend-e2e/vitest.config.ts`](../apps/backend-e2e/vitest.config.ts) to those specs, e.g. `src/backend/beatrice-callbacks.e2e-spec.ts`. Do not commit this change though.

</details>

```bash
npm ci
npm run start:dev
```

## Where to Change Things (Infrastructure)

- A new component (a database, a worker, a tool): add `infra/terraform/modules/<component>` with only the inputs it needs and a `.tftest.hcl`, then call it from `infra/terraform/modules/app`. A module that serves HTTP contributes its ingress routes (`name`, `path`, `service_name`, `service_port`) through a `routes` output, and `modules/app` puts them in its `Ingress`. What a shared cluster would provide (ingress controller, ZITADEL server, observability) is called only from `envs/local`.
- A new variable in a module: give it a default that suits local development, and set it in an environment only if that one differs.
- A change to ZITADEL itself (a role, an application, a user, a policy): `infra/terraform/modules/zitadel_config`, with the local values in `infra/terraform/envs/local-zitadel/main.tf`. `npm run start:dev` applies it between the cluster and the workloads. What the workloads need from it (client ID, PAT) reaches them as environment settings from `envs/local`.
- A new application setting (`.env` key): add it to `.env.example`. `envs/local` hands the whole `.env` to the backend, the `VITE_` keys to the frontend, and keys that look like secrets (`PASSWORD`, `SECRET`, `MASTERKEY`, `ACCESS_KEY`) go to a Secret. Values that depend on a deployed component are filled in by `modules/app`.
- Anything specific to one environment (hot reload, host ports, devtools, which images run): `infra/terraform/envs/<name>`, passed to `module "app"` as generic inputs. Modules must be identical in every environment, so they never mention `dev`, `local` or `kind`.
- An external service instead of an in-cluster one: set the matching `*_url` input of `module "app"`.
- Personal overrides: `infra/terraform/envs/local/terraform.tfvars`.

## Prisma Migration Guide

### Development

To run migrations in development:

```bash
npx prisma migrate dev
```

#### Production

How migrations should be applied in a professional, production‑safe workflow? Since the Prisma CLI is a dev dependency and not available in the production container. Thus we need to apply migrations in our CI/CD Pipeline:

```bash
npx prisma migrate deploy --schema=./apps/backend/prisma/schema.prisma
```

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
- Use `retryAsync` instead of `try ... catch ...` block when it make sense:
  ```ts
  import { retryAsync } from 'nestjs-backend-common';
  const [error, someVar] = await retryAsync(() => someFunc(), {
    retry: 123,
  });
  ```
- Do **NOT** wrap normal control‑flow or repository/service logic in `try/catch` blocks. Only use `try/catch` when you are genuinely handling a known error case or adding meaningful recovery logic. Logging‐and‑rethrowing is `NOT` considered meaningful handling; let errors bubble up and rely on global exception filters/middleware instead.
- Do **NOT** add a barrel `index.ts` in the "frontend" app, for a Vite-powered SPA you should **NOT** because:
  - Tree-shaking happens still for the production builds, but it **hurts dev server startup and HMR performance** because Vite eagerly transforms every module the barrel re-exports, even if you only need one.
  - When you do `import { getInitials } from '../../utils'`, Vite (and Rollup under the hood) has to parse the entire barrel to figure out what's exported.
- When you add a new resolver in the "backend" app, you **MUST** add it to the `apps/backend/gen-graphql-schema.ts`.
- Use Nx targets instead of raw commands whenever it is possible.
- A side-effect call from within a mutation that already committed its primary write (e.g. triggering Beatrice's `generateAudio` after `updateContent` persists) must not let the side effect's failure fail the whole mutation — wrap it (`retryAsync` with `{ retry: 0 }`, or try/catch) and log-and-continue.
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
nx storybook frontend
# Run all e2e tests
nx e2e frontend-e2e
# Run all e2e tests
nx e2e backend-e2e
```

- If you change/add something make sure to write/update and then run the unit/e2e tests.
- Use vitest.
- Use `it` instead of `test`.
- Use `it.each` whenever it make sense.
- Use jest-extended APIs whenever appropriate.
- Use AAA (Arrange, Act, Assert) style of writing test.
  - Use new line as an indicator of each step!
- Add fixtures only when it makes my tests more readable (but in general prefer to write them inside the test body).
- Try to mock using vitest instead of `@nestjs/testing`.
- Use `uut` (unit under test) **only** when you instantiate an object whose **methods** you will exercise in the test. For example: `uut = MyService(...)` followed by `uut.do_something()`.
- When testing a **function** (or a constructor where you just assert on the returned value), name the variable after what it represents — e.g. `result`, `settings`, `payload`, etc. Do **not** call it `uut` in that case.
- Always ask what we should and what we should **NOT** mock.
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
- See `apps/backend/src/**/*.spec.ts` for examples for backend and `apps/frontend/src/**/*.spec.ts` for examples for frontend.
- See `apps/backend-e2e/src/**/*.e2e-spec.ts` for examples for backend e2e tests and `apps/frontend-e2e/src/e2e/**/*.cy.ts` for examples for frontend e2e tests.
- If you need to upgrading 3rd party libs: `.github/docs/update-npm.md`.
- Storybook and Cypress e2e are not interchangeable — pick the tier by what's actually at risk, not by which is cheaper to write:
  - **Storybook** (component isolation, mocked data/hooks): visual states and in-component interaction logic. Cannot verify authorization/permission logic (you control the mocked response, so a broken real check still "passes") or real auth integration (ZITADEL login/redirect/token exchange never actually runs against mocked auth state).
  - **`backend-e2e`**: authorization/permission logic against the real API (e.g. "can this role/ownership combination perform this mutation"). This is the right layer for permission-boundary coverage, not `frontend-e2e`.
  - **`frontend-e2e` (Cypress)**: real browser + real stack coverage that neither of the above can fake — most notably the real ZITADEL login/redirect/callback flow, and full user journeys spanning multiple pages/services.
  - A feature that only adds new UI states on top of an already `backend-e2e`-tested permission check can reasonably skip a new Cypress spec and rely on Storybook + unit tests instead — that's a deliberate scope call per-feature, not a rule that Storybook replaces Cypress in general.

#### Run E2E Tests Locally

```bash
npm run start:dev
npx cypress open --project apps/frontend-e2e
```

`nx e2e backend-e2e` and `nx e2e frontend-e2e` start their own cluster with the production images (`infra/scripts/start-dev.sh e2e`) and tear it down afterwards. They cannot run next to `npm run start:dev` (both use host port 8080), so run `npm run stop:dev` first.
