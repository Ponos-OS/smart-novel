# Smart Novel

A modern monorepo project for managing and reading novels with AI-powered word explanations. Built with Nx, NestJS, GraphQL, and React.

## 🌟 Features

- **📚 Novel Management**: Create, read, and manage novels with chapters stored in PostgreSQL via Prisma
- **🔍 GraphQL API**: Powerful query, mutation, and subscription capabilities (Apollo Server)
- **🏷️ Advanced Filtering**: Filter and search novels by categories with inclusion/exclusion
- **🤖 AI-Powered Explanations**: Word definitions with context using Ollama LLM, with client-side rate limiting (token bucket)
- **🔊 Text-to-Speech Narration**: Chapter narration via Piper TTS with real-time status updates through GraphQL subscriptions
- **🔐 Authentication & Authorization**: OIDC-based auth via Zitadel with RBAC (role-based access control)
- **🌗 Theme Support**: Light/dark mode toggle with persistent theme preferences
- **📄 Pagination**: Cursor-based novel listing with pagination support

## 📁 Project Structure

```
smart-novel/
├── apps/
│   ├── backend/                  # NestJS GraphQL API
│   │   ├── data/                 # Novel seed data (markdown + JSON)
│   │   ├── prisma/               # Prisma schema, migrations & seeders
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/         # Zitadel OIDC auth & RBAC guards
│   │       │   ├── llm/          # Ollama LLM word explanation
│   │       │   ├── novel/        # Novel & chapter CRUD, narration (TTS)
│   │       │   ├── object-storage/ # RustFS S3 file uploads
│   │       │   ├── prisma/       # Prisma service
│   │       │   └── redis/        # Redis caching service
│   │       └── utils/
│   ├── backend-e2e/              # Backend E2E tests (Vitest)
│   ├── frontend/                 # React SPA
│   │   └── src/
│   │       ├── components/       # Shared components (MarkdownRenderer, etc.)
│   │       ├── hooks/            # Custom hooks (useAuth, useWordExplain, etc.)
│   │       ├── pages/            # Route pages (home, novel, search, auth)
│   │       └── utils/            # Utilities (token-bucket, notifications)
│   └── frontend-e2e/             # Frontend E2E tests (Cypress)
├── infra/                        # Terraform modules and scripts for the local kind cluster (see infra/README.md)
├── local-setup/                  # Images the cluster builds
│   ├── ollama/                   # Ollama Dockerfile & healthcheck
│   └── openai-compatible-tts/    # OpenAI-compatible TTS server Dockerfile & healthcheck
├── .env.example                  # Environment variables template
├── nx.json                       # Nx configuration
└── tsconfig.base.json            # TypeScript base configuration
```

## 🛠️ Technology Stack

- **Backend**: NestJS, GraphQL (Apollo Server), TypeScript, Prisma ORM, Webpack
- **Frontend**: React, Vite, TypeScript, TailwindCSS, TanStack Query, React Router
- **Database**: PostgreSQL
- **Cache**: Redis (ioredis)
- **Auth**: Zitadel (OIDC/OAuth2), RBAC
- **LLM**: Ollama (llama3.2:1b), Open WebUI
- **TTS**: Piper TTS REST API
- **Object Storage**: RustFS (S3-compatible)
- **Reverse Proxy**: Traefik
- **Testing**: Vitest (unit/integration), Cypress (E2E)
- **Monorepo**: Nx
- **Infrastructure**: Docker, kind, Terraform

### Local Development

```bash
npm ci
npm run start:dev
```

|        | URL                          | Info                                                            |
| ------ | ---------------------------- | --------------------------------------------------------------- |
| UI     | http://localhost:8080        | Username/Password: `infra/terraform/envs/local-zitadel/main.tf` |
| Jaeger | http://localhost:8080/jaeger | No login needed for local dev.                                  |

### E2E

```bash
nx storybook frontend # starts storybook
nx e2e backend-e2e    # starts backend e2e tests
```

#### Connect to External LLM Providers

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
