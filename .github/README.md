# Smart Novel

A modern monorepo project for managing and reading novels with AI-powered word explanations. Built with Nx, NestJS, GraphQL, and React.

| Service                                                                                           | Replicas | vCPU |    RAM |  Disk | Notes                                                                       |
| ------------------------------------------------------------------------------------------------- | -------: | ---: | -----: | ----: | --------------------------------------------------------------------------- |
| Frontend (SPA)                                                                                    |        1 |  0.1 |  64 MB |     - | [Nginx](https://github.com/Ponos-OS/infra/blob/main/.github/docs/nginx.md). |
| Backend ([NestJS + Prisma](https://github.com/Ponos-OS/infra/blob/main/.github/docs/nodejs.md))   |        1 |    1 |   1 GB |     - |                                                                             |
| Beatrice ([FastAPI](https://github.com/Ponos-OS/infra/blob/main/.github/docs/python.md))          |        1 |  0.5 | 512 MB |     - | LLM + TTS service, port 3000. Also runs the RabbitMQ audio worker.          |
| [Redis](docs/redis.md)                                                                            |        1 | 0.25 | 256 MB |     - | Cache only, no persistence.                                                 |
| smart-novel [Postgres](https://github.com/Ponos-OS/infra/blob/main/.github/docs/postgres.md)      |        1 |    1 |   2 GB | 20 GB | Daily backup, its own CronJob.                                              |
| smart-novel [RabbitMQ](https://github.com/Ponos-OS/infra/blob/main/.github/docs/rabbitmq.md)      |        1 |  0.5 | 512 MB |  2 GB | Private only.                                                               |
| [Object storage](https://github.com/Ponos-OS/infra/blob/main/.github/docs/object-storage.md) (S3) |        - |    - |      - | 50 GB | Cloudflare R2, not a pod. Not in the disk totals. Covers and narration.     |

## Project Structure

```
smart-novel/
├── apps/
│   ├── backend/                  # NestJS GraphQL API
│   │   ├── data/                 # Novel seed data (markdown + JSON)
│   │   ├── prisma/               # Prisma schema, migrations & seeders
│   │   └── src/
│   │       ├── app/
│   │       ├── assets/
│   │       ├── modules/
│   │       │   ├── auth/         # Zitadel OIDC auth & RBAC guards
│   │       │   ├── background-runner/
│   │       │   ├── category/
│   │       │   ├── fithara/
│   │       │   ├── license/
│   │       │   ├── license-assistant/
│   │       │   ├── llm/          # Ollama LLM word explanation
│   │       │   ├── novel/        # Novel & chapter CRUD, narration (TTS)
│   │       │   ├── object-storage/ # RustFS S3 file uploads
│   │       │   ├── platform-terms/
│   │       │   ├── prisma/       # Prisma service
│   │       │   ├── redis/        # Redis caching service
│   │       │   └── tts-callbacks/
│   │       └── shared/
│   ├── backend-e2e/              # Backend E2E tests (Vitest)
│   ├── frontend/                 # React SPA
│   │   ├── public/
│   │   └── src/
│   │       ├── app/
│   │       ├── assets/
│   │       ├── components/       # Shared components (MarkdownRenderer, etc.)
│   │       ├── features/
│   │       ├── hooks/            # Custom hooks (useAuth, useWordExplain, etc.)
│   │       ├── lib/
│   │       ├── pages/            # Route pages (home, novel, search, auth)
│   │       ├── services/
│   │       ├── stories/
│   │       ├── test-utils/
│   │       └── utils/            # Utilities (token-bucket, notifications)
│   └── frontend-e2e/             # Frontend E2E tests (Cypress)
├── infra/                        # Terraform modules and scripts for the local kind cluster (see infra/README.md)
├── libs/                         # Code shared by both apps (@smart-novel/shared)
├── local-setup/                  # Images the cluster builds
│   ├── ollama/                   # Ollama Dockerfile & healthcheck
│   └── openai-compatible-tts/    # OpenAI-compatible TTS server Dockerfile & healthcheck
├── scripts/                      # Repo maintenance scripts
├── .env.example                  # Environment variables template
├── nx.json                       # Nx configuration
└── tsconfig.base.json            # TypeScript base configuration
```
