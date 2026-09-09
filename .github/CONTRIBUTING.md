## 🚀 Quick Start

```bash
npm run init
npm run start:dev
```

Then open:

- Frontend: http://localhost:8080
- GraphQL API: http://localhost:8080/graphql
- ZITADEL console: http://localhost:8080/ui/console/

BTW if you need DevTools such as Redis Insight, or PgAdmin you have to use the `compose.devtools.yml`:

```shell
docker compose -f compose.devtools.yml --profile dev up --build -d
```

- Open WebUI: http://localhost:8080/
- RedisInsight: http://localhost:5540/

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

## Test Conventions

To run tests:

```bash
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

#### Run E2E Tests Locally

```bash
docker compose --profile frontend-e2e up -d --build --wait
npx cypress open --project apps/frontend-e2e
```
