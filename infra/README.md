# Infrastructure

The local environment is a `kind` cluster in Docker. Terraform defines everything on it through the `hashicorp/kubernetes` provider, so Deployments, Services and the rest are `kubernetes_*_v1` resources.

```text
infra/
├── scripts/            start-dev.sh, stop-dev.sh
└── terraform/
    ├── modules/
    │   ├── app/        Composes the component modules; knows nothing about which cluster it runs on
    │   ├── namespace/  The namespace every component deploys into
    │   ├── postgres/   PostgreSQL with the application and zitadel databases
    │   ├── redis/      Redis
    │   ├── minio/      MinIO plus a Job that creates the bucket and uploads the seed covers
    │   ├── ingress/    Traefik; serves the routes the other modules contribute
    │   ├── rabbitmq/   RabbitMQ
    │   ├── ollama/     Ollama with the model baked into the image
    │   ├── openai_compatible_tts/   OpenAI-compatible TTS server with the model baked into the image
    │   ├── beatrice/   Beatrice, the audio generation service
    │   ├── backend/    NestJS API
    │   ├── frontend/   Vite SPA
    │   ├── job/        A one-shot Job
    │   ├── devtools/   RedisInsight, pgAdmin, Open WebUI; off by default
    │   ├── observability/  OpenTelemetry Collector and Jaeger
    │   ├── zitadel/    ZITADEL (init Job, server, login UI) and its credentials volume
    │   └── zitadel_setup/  Job that runs local-setup/setup-zitadel: project, roles, users, OIDC apps
    └── envs/
        └── local/      kind cluster, image loading, and one call to module "app"
```

Each component is its own module under `modules/`. `modules/app` wires them together and owns the toggles. `envs/<name>` is a thin root module: it creates the cluster, points the `kubernetes` provider at it, and calls `module "app"`.

## Local Environment

We need Docker, Terraform and the [`kind` CLI](https://kind.sigs.k8s.io/docs/user/quick-start).

```bash
npm run start:dev   # builds the images, creates the cluster, loads the images, applies
npm run stop:dev    # destroys the cluster
```

Both are safe to run twice. The app is served on `http://localhost:8080`. The kubeconfig is written to `infra/terraform/envs/local/smart-novel-config`:

```bash
kubectl --kubeconfig infra/terraform/envs/local/smart-novel-config -n smart-novel get all
```

Code changes need no rebuild: `envs/local` mounts `apps/` into the kind node and feeds it to `module "app"` as volumes (see Backend and Frontend). Rebuild only when dependencies change, by running `start:dev` again.

## Data Components

Postgres, Redis and MinIO are deployed in the cluster under the Service names `postgres`, `redis` and `s3`, which the application settings in `.env` already use. Setting `database_url`, `redis_url` or `object_storage_endpoint` on `module "app"` skips the matching component. Data is throwaway unless `persistent_volumes` is `true`.

MinIO is reachable from the host on `localhost:9000` (S3 API) and `localhost:9001` (console), through node ports mapped by `envs/local`. The seed covers in `apps/backend/data` are uploaded only when `minio_seed_volume` is set (a host path or a claim); without it only the bucket and its policy are created.

## Ingress and ZITADEL

Traefik listens on node port 80, which kind maps to `localhost:8080`. It uses its file provider, so it needs no Kubernetes API access and no CRDs. A module contributes a route by exposing it in a `routes` output (`name`, `rule`, `priority`, `service`, optional `middlewares`); `modules/app` passes the routes of all modules to `modules/ingress`. The ingress module knows nothing about the applications behind it.

ZITADEL's generated credentials (the bot PAT, the login-client PAT, the project ID, the OIDC client ID and the user IDs written by the setup script) live on one PersistentVolumeClaim, `zitadel-credentials`, mounted at `/zitadel-pat` by ZITADEL, the login UI and the setup Job. Consumers get the claim name and file paths from the `zitadel_credentials` output of `modules/app` (available only after the setup Job finished) and never refer to the volume directly.

To read the files from the host, for example for the e2e suites, copy them out of a pod that mounts the claim. Step 8 of `REQUIREMENTS.md` does this into the git-ignored `local-setup/{pats,client,user-ids}` directories the suites already read.

## Observability

The OpenTelemetry Collector (tail sampling config in `modules/observability`) receives OTLP on `otel-collector:4318` (HTTP) and `:4317` (gRPC) and forwards to Jaeger. Browsers export to the same origin at `http://localhost:8080/v1/traces`, which the module routes through the ingress. The Jaeger UI is on `http://localhost:8080/jaeger`: UIs sit behind the ingress path, not behind port-forwards. `enable_observability = false` skips both; `trace_sampling_ratio` (1.0 locally) sets the share of non-noisy traces kept, errors are always kept. Readiness probes on both replace the compose health-check container.

## Messaging and AI

Beatrice consumes audio jobs from RabbitMQ, normalizes text with an LLM (Ollama) and synthesizes speech with OpenAI-compatible TTS. `local-setup/ollama` and `local-setup/openai-compatible-tts` stay where they are; `start-dev.sh` builds them (models are baked in, so the first build is large and slow) and `envs/local` loads them into kind. Beatrice does not reconnect if RabbitMQ is down when it starts, so `modules/app` makes it wait for RabbitMQ and the AI components.

`enable_ai = false` (in `envs/local/terraform.tfvars`) skips building and deploying Ollama and OpenAI-compatible TTS. Beatrice and RabbitMQ then run only if `llm_base_url` and `tts_base_url` point at other services, for example the host or a cloud provider; otherwise they are skipped too. `broker_url` skips RabbitMQ. Beatrice has no health endpoint, so its readiness probe checks that the port is open.

## Backend and Frontend

`envs/local` reads `.env` and hands it to `module "app"` as `backend_environment`, `backend_secret_environment` (keys matching `PASSWORD|SECRET|MASTERKEY|ACCESS_KEY`, stored in a Secret) and `frontend_environment` (the `VITE_` keys). Values that depend on the deployed components (database and Redis URLs, object storage endpoint, Beatrice URL, tracing) are filled in by `modules/app` and win over `.env`, so an external `database_url` or a disabled component needs no `.env` edit.

The modules know nothing about development. `backend` and `frontend` take an image, a port, environment, `volumes` (host path or claim), and the frontend also an optional `command` and `files`. Anything that has to run first, such as applying the database schema, is a `pre_deploy_jobs` entry (`modules/job`): the backend and the frontend start only after all of them completed, and `use_backend_environment` gives a Job the backend's environment, including what `modules/app` fills in.

Everything specific to hot reload lives in `envs/local/main.tf`: the development images, the `hostPath` volumes that mount `apps/` from the node, the frontend start script (`envs/local/files/`, reads the generated OIDC client ID from the credentials volume), and two pre-deploy Jobs: `backend-init` (`prisma db push`, `generate`, `seed`) and `frontend-codegen` (`nx codegen frontend`, then `chown` of `apps/` to `run_as_user`; `start-dev.sh` passes `id -u`). A deployed environment passes production images, no volumes and its own migration Job. The `zitadel_credentials = true` flag on a volume means ZITADEL's credentials claim, which only `modules/app` knows the name of.

## Devtools

`enable_devtools = true` in `envs/local/terraform.tfvars` adds RedisInsight (`localhost:5540`), pgAdmin (`localhost:5050`, `admin@admin.com` / `admin`, the database is pre-registered) and Open WebUI (`localhost:8090`, no login). Unlike Jaeger they are reached by host port, through node ports mapped by `envs/local` like MinIO's: Open WebUI cannot be served under a path prefix, and these are the addresses `CONTRIBUTING.md` documents. The port mappings exist whether or not the tools are enabled, and their large images are pulled only when it is.

Each tool is deployed only when the service it inspects runs in the cluster (an external `database_url`, `redis_url` or `enable_ai = false` skips pgAdmin, RedisInsight or Open WebUI). Nothing outside `modules/devtools` refers to it, so a deployed environment leaves the module call out, or keeps `enable_devtools` false.

`stop:dev` falls back to deleting the kind cluster when Terraform can no longer reach it, for example right after the cluster definition changed.

## End-to-End Tests

`nx e2e backend-e2e` and `nx e2e frontend-e2e` run `infra/scripts/start-dev.sh e2e`, which builds the production backend and frontend images (the init Job still uses the development image and the mounted sources), applies `envs/local` with `mode = e2e`, `enable_devtools = false` and `enable_ai = true`, and tears everything down with `stop-dev.sh` afterwards. Redis is exposed on `localhost:6379` because the backend suites subscribe to it directly. The suites copy the credentials ZITADEL generated out of the cluster into the git-ignored `local-setup/{pats,client,user-ids}`, with `kubectl exec` into the backend pod.

The dev and e2e environments both use the cluster name `smart-novel` and host port 8080, so they cannot run together: `start-dev.sh e2e` exits with code 3 and an instruction to run `npm run stop:dev` first when the cluster exists, and the callers then skip their teardown instead of destroying the environment that is running.

## Where to Change Things

- A new component: add `modules/<component>` and call it from `modules/app`.
- A new variable in a module: give it a default that suits local development, and set it in an environment only if that one differs.
- Something specific to one environment: put it in that environment's root module and pass it into `module "app"` as an input.
- Personal overrides: `envs/local/terraform.tfvars` (git-ignored).
