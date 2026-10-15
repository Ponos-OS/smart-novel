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
nx storybook frontend # starts storybook
nx e2e backend-e2e # starts e2e tests for backend apps, we have similar thing for frontend
npm run start:dev # starts the whole app in dev env
```

#### Local models vs. an external provider

Beatrice (word explanations and narration) talks to an OpenAI-compatible LLM and an OpenAI-compatible speech endpoint (`POST {base_url}/audio/speech`). One switch, `enable_ai`, picks where both come from. `nx e2e` always uses the local models.

**Local models (default)**: Ollama and the bundled `local-setup/openai-compatible-tts` server run in the cluster. Nothing to configure in `terraform.tfvars`; set these in `.env` (see `.env.example`):

```bash
BEATRICE_LLM_MODEL=llama3.2:3b
BEATRICE_TTS_MODEL=Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice
BEATRICE_DEFAULT_VOICE=default
```

The first run builds large images, and speech synthesis on a CPU can take minutes.

**External provider**: put this in `infra/terraform/envs/local/terraform.tfvars` (git-ignored; keys are sensitive, never commit them) and run `npm run start:dev` again:

```hcl
enable_ai    = false
llm_base_url = "https://api.openai.com/v1"
llm_api_key  = "sk-..."
tts_base_url = "https://api.openai.com/v1"
tts_api_key  = "sk-..."
tts_voices   = "alloy,nova"
```

Then set model and voice names the provider knows in `.env`:

```bash
BEATRICE_LLM_MODEL=gpt-4o-mini
BEATRICE_TTS_MODEL=gpt-4o-mini-tts
BEATRICE_DEFAULT_VOICE=alloy
```

With `enable_ai = false` Ollama and the local speech server are neither built nor deployed, and Beatrice is deployed only when both URLs are set. `BEATRICE_DEFAULT_VOICE` must be one of `tts_voices`. Delete the lines from `terraform.tfvars` and restore the `.env` values to go back to local models. The LLM and speech endpoints cannot be mixed (one local, one external) with the current switch.

#### Logging in to the frontend

Open http://localhost:8080 and sign in through ZITADEL with [one of the seeded test users](../infra/terraform/envs/local-zitadel/main.tf) (created by `infra/terraform/envs/local-zitadel`):

Use `writer@test.com` to create novels and chapters. The ZITADEL console (http://localhost:8080/ui/console/) takes the instance admin from `.env` (`ZITADEL_ADMIN_USERNAME` / `ZITADEL_ADMIN_PASSWORD`, `admin` / `Admin123!` by default).

#### Accessing Jaeger

Jaeger is at http://localhost:8080/jaeger. It has no login, anyone who can reach the port can open it.
