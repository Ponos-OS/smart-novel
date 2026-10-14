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
│   │       │   ├── object-storage/ # MinIO S3 file uploads
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
│   ├── qwen-tts/                 # Qwen-TTS server Dockerfile & healthcheck
│   └── setup-zitadel/            # Zitadel provisioning scripts
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
- **Object Storage**: MinIO (S3-compatible)
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

#### Logging in to the frontend

Open http://localhost:8080 and sign in through ZITADEL with one of the seeded test users (created by `local-setup/setup-zitadel`):

| Login name        | Password     | Role   |
| ----------------- | ------------ | ------ |
| `admin@test.com`  | `Admin123!`  | admin  |
| `writer@test.com` | `Writer123!` | writer |
| `user@test.com`   | `User123!`   | user   |

Use `writer@test.com` to create novels and chapters. The ZITADEL console (http://localhost:8080/ui/console/) takes the instance admin from `.env` (`ZITADEL_ADMIN_USERNAME` / `ZITADEL_ADMIN_PASSWORD`, `admin` / `Admin123!` by default).

#### Accessing Jaeger

Jaeger is at http://localhost:8080/jaeger. It has no login, anyone who can reach the port can open it.
