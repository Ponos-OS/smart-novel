<h1><img src="../apps/frontend/public/logo.png" width="40" height="40" alt="smart-novel logo" />Smart Novel</h1>

A modern monorepo project for managing and reading novels with AI-powered word explanations. Built with Go (ent, gqlgen), GraphQL, React and Task.

| Service                                                                                           | Replicas | vCPU |    RAM |  Disk | Notes                                                                       |
| ------------------------------------------------------------------------------------------------- | -------: | ---: | -----: | ----: | --------------------------------------------------------------------------- |
| Frontend (SPA)                                                                                    |        1 |  0.1 |  64 MB |     - | [Nginx](https://github.com/Ponos-OS/infra/blob/main/.github/docs/nginx.md). |
| Backend (Go + ent + gqlgen)                                                                       |        1 |    1 |   1 GB |     - |                                                                             |
| Beatrice ([FastAPI](https://github.com/Ponos-OS/infra/blob/main/.github/docs/python.md))          |        1 |  0.5 | 512 MB |     - | LLM + TTS service, port 3000. Also runs the RabbitMQ audio worker.          |
| [Redis](docs/redis.md)                                                                            |        1 | 0.25 | 256 MB |     - | Cache only, no persistence.                                                 |
| [Postgres](https://github.com/Ponos-OS/infra/blob/main/.github/docs/postgres.md)                  |        1 |    1 |   2 GB | 20 GB | Daily backup, its own CronJob.                                              |
| [RabbitMQ](https://github.com/Ponos-OS/infra/blob/main/.github/docs/rabbitmq.md)                  |        1 |  0.5 | 512 MB |  2 GB | Private only.                                                               |
| [Object storage](https://github.com/Ponos-OS/infra/blob/main/.github/docs/object-storage.md) (S3) |        - |    - |      - | 50 GB | Cloudflare R2, not a pod. Not in the disk totals. Covers and narration.     |

## How to Start

You can find the exported Docker image 🐳📦🚢 for this project here:

- https://hub.docker.com/r/9109679196/smart-novel-frontend
- https://hub.docker.com/r/9109679196/smart-novel-backend

> [!TIP]
>
> You must use the same tag in both frontend and backend when running it locally.

And as for the env variables you can look at the [`.env.example`](./.env.example).

And if you wonder how the whole thing comes together please look at the [`infra`](./infra)

## Project Structure

```
smart-novel/
├── apps/
│   ├── backend/                  # Go GraphQL API (ent, entgql, gqlgen)
│   │   ├── api/                  # GraphQL schema that extends the one ent generates
│   │   ├── cmd/                  # server and migrategen entry points
│   │   ├── data/                 # Seed cover image and license texts
│   │   ├── ent/                  # ent schema and the Atlas migrations
│   │   ├── internal/             # Domain packages (novel, chapter, tag, license, narration, ...)
│   │   └── tools/                # Own Go module: the devdata seeder
│   ├── backend-e2e/              # Backend E2E tests (Vitest)
│   ├── backend-stress/
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
├── scripts/                      # Repo maintenance scripts
├── tools/                        # Go tools (gensdl turns the limits of the GraphQL schema into frontend constants)
├── .env.example                  # Environment variables template
├── Taskfile.yml                  # Task entry points; every app has its own Taskfile.yml
├── go.work                       # Go workspace (apps/backend, tools)
└── tsconfig.base.json            # TypeScript base configuration
```
