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
    │   ├── object_storage/ S3-compatible storage (RustFS) plus a Job that creates the bucket and uploads the seed covers
    │   ├── ingress/    Traefik; serves the routes the other modules contribute
    │   ├── rabbitmq/   RabbitMQ
    │   ├── ollama/     Ollama with the model baked into the image
    │   ├── openai_compatible_tts/   OpenAI-compatible TTS server with the model baked into the image
    │   ├── beatrice/   Beatrice, the audio generation service
    │   ├── fithara/    Fithara, the license drafting assistant
    │   ├── backend/    NestJS API
    │   ├── frontend/   Vite SPA
    │   ├── job/        A one-shot Job
    │   ├── devtools/   RedisInsight, pgAdmin, Open WebUI; off by default
    │   ├── observability/  OpenTelemetry Collector, Tempo, Loki, Prometheus and Grafana
    │   ├── backup/     CronJobs that pg_dump to the backup bucket
    │   ├── zitadel/    ZITADEL (init Job, server, login UI); it writes its first-instance PATs to a volume
    │   └── zitadel_config/  Project, roles, users, OIDC apps, self-registration and impersonation, through the ZITADEL provider
    └── envs/
        ├── local/          kind cluster, image loading, and one call to module "app"
        ├── local-zitadel/  Configures ZITADEL with the provider, through module "zitadel_config"
        ├── hetzner/        Deploys onto the shared Hetzner cluster: module "app" plus the backup CronJobs
        └── hetzner-zitadel/ Project, roles and client on the shared ZITADEL
```

Each component is its own module under `modules/`. `modules/app` is the app layer: data stores, backend, frontend, Beatrice, Fithara and one `Ingress`. It takes everything about the platform as inputs (`ingress_class_name`, `ingress_host`, `cluster_issuer`, `otlp_endpoint`), so it also deploys onto a shared cluster. `envs/local` creates the kind cluster, points the `kubernetes` provider at it, and calls `module "app"` plus the three modules that stand in for the platform locally: `ingress` (Traefik), `observability` and `zitadel`. Nothing outside `envs/local` calls those three. `envs/local-zitadel` is a second root module that configures ZITADEL once it runs (see Ingress and ZITADEL).

## Local Environment

We need Docker, Terraform and the [`kind` CLI](https://kind.sigs.k8s.io/docs/user/quick-start).

```bash
npm run start:dev   # builds the images, creates the cluster, loads the images, applies the three stages
npm run stop:dev    # destroys the cluster and forgets the state of the ZITADEL configuration
```

Both are safe to run twice. The app is served on `http://localhost:8080`. The kubeconfig is written to `infra/terraform/envs/local/smart-novel-config`:

```bash
kubectl --kubeconfig infra/terraform/envs/local/smart-novel-config -n smart-novel get all
```

Code changes need no rebuild: `envs/local` mounts `apps/` into the kind node and feeds it to `module "app"` as volumes (see Backend and Frontend). Rebuild only when dependencies change, by running `start:dev` again.

## Data Components

Postgres, Redis and RustFS are deployed in the cluster under the Service names `postgres`, `redis` and `s3`, which the application settings in `.env` already use. Setting `database_url`, `redis_url` or `object_storage_endpoint` on `module "app"` skips the matching component. Data is throwaway unless `persistent_volumes` is `true`.

RustFS is reachable through the ingress on `s3.localhost:8080` (S3 API, the host of `OBJECT_STORAGE_PUBLIC_URL`) and `s3-console.localhost:8080` (console). The seed covers in `apps/backend/data` are uploaded only when `object_storage_seed_volume` is set (a host path or a claim); without it only the bucket, its policy and its CORS rule are created. The CORS rule lets the browser `PUT` cover images straight to the bucket with a presigned URL; its origins are the ones in `CORS_ALLOWED_ORIGINS`. An external storage (`object_storage_endpoint`, e.g. R2 on Hetzner) is not touched by that Job, so allow `PUT` from the frontend origin there yourself, and set `OBJECT_STORAGE_PUBLIC_URL` to the host browsers reach it on.

## Ingress and ZITADEL

Traefik listens on node port 80, which kind maps to `localhost:8080`; that is the only HTTP port on the host, and every web tool is a `*.localhost` host on it (browsers resolve those to loopback), so nothing else needs a port-forward or a node port. Redis is the exception, on `localhost:6379`: it is raw TCP, which Traefik can only route per entrypoint, and only `backend-e2e` uses it. It reads the app's standard `Ingress` (class `traefik`) through the Kubernetes Ingress provider. ZITADEL, the observability routes and the in-cluster tools (`tool_routes` of `modules/app`: RustFS, RabbitMQ management and the devtools, each on its own host) stay on its file provider, because they need h2c and header middlewares, which plain Ingress cannot express; `envs/local` passes those routes to `modules/ingress`. `backend` and `frontend` expose their routes (`name`, `path`, `service_name`, `service_port`) and `modules/app` turns them into the Ingress. ZITADEL's `/assets/v1` is longer than the frontend's `/assets` and has an explicit priority, so it wins there.

ZITADEL is configured in three stages, which `start-dev.sh` applies in order:

1. `envs/local` with `wait_for_zitadel_credentials = true` creates the cluster and everything except the backend, the frontend and the pre-deploy Jobs, which need values ZITADEL generates.
2. `envs/local-zitadel` configures ZITADEL with the `zitadel/zitadel` provider, through `modules/zitadel_config`: the project and its roles, the public OIDC application, the test users and their grants, self-registration with the action that grants the `user` role, and impersonation with the integration-test bot. Its outputs are the client ID, the bot PAT, the user IDs and the integration-test values.
3. `envs/local` again with `wait_for_zitadel_credentials = false` reads those outputs with `terraform_remote_state` and passes them to the workloads as ordinary settings: `ZITADEL_CLIENT_ID` and `ZITADEL_PAT` and `ZITADEL_MANAGEMENT_PAT` (Secrets) for the backend, `VITE_OIDC_CLIENT_ID` for the frontend, `ZITADEL_WRITER_USER_ID` for the init Job. `modules/app` only knows its inputs and nothing about ZITADEL's configuration.

`modules/zitadel_config` is the part a deployed environment reuses. Its root module supplies the inputs: `redirect_uris`, `users` (empty means none), `allow_self_registration` and `impersonation` (`null` means none, and it should only be set on an instance without real users, because it lets the bot act as any user). `envs/local-zitadel` authenticates the provider with ZITADEL's first-instance PAT, read from the cluster with `kubectl exec`. A deployed environment passes a JWT profile key to the provider instead. See `infra/docs/zitadel-terraform-provider.md`.

The state of stage 2 lives next to `envs/local-zitadel` and is git-ignored. `stop-dev.sh` removes it with the cluster, so a fresh start configures a fresh ZITADEL.

## Observability

The OpenTelemetry Collector (tail sampling config in `modules/observability`) receives OTLP on `otel-collector:4318` (HTTP) and `:4317` (gRPC) and forwards the traces to Tempo. Prometheus scrapes RabbitMQ, and Loki is deployed for the logs the apps do not ship yet. Browsers export to the same origin at `http://localhost:8080/v1/traces`, which the module routes through the ingress. Grafana is on `http://grafana.localhost:8080`, routed by host through the same ingress, and loads the datasources, the RabbitMQ dashboard and the alert rules from `observability/grafana/provisioning`.

`enable_observability = false` skips the stack; `trace_sampling_ratio` (1.0 locally) sets the share of non-noisy traces kept, errors are always kept. The stores write to `emptyDir`, so the data goes away with the pods.

`OTEL_LOGS_EXPORTER` in `.env` picks how logs reach Loki. `otlp` (default): the backend, Beatrice and Fithara push them to the collector, so a hard crash can lose the last seconds. `none`: `modules/alloy` tails the three services' stdout through the Kubernetes API and the services stop pushing (`OTEL__LOG_SHIPPING=stdout` for Beatrice and Fithara). Pick one, both would store every line twice. Logs are labelled with `service_name` from the pod's `app` label.

On Hetzner the shared Grafana serves both apps, and `envs/hetzner` sets `publish_grafana_configmaps` to publish the RabbitMQ dashboard and the alert rules (two on the audio queues, one on failed removals of narration audio and covers from the bucket) from `observability/grafana/provisioning` as ConfigMaps in the `smart-novel` namespace. Their names carry the app name (UIDs, rule group, folders) and every query filters on `namespace="smart-novel"`, because the shared Prometheus holds both apps' series. Datasources are referenced by the UIDs `prometheus`, `tempo` and `loki`. Locally the same files are mounted into the stack above. smart-novel exports traces only, so there are no app metrics yet; the dashboard and the queue alerts use RabbitMQ's. The removal alert is the exception: it counts `Failed to delete narration audio` lines in Loki (`{namespace="smart-novel", app="backend"}`), and the backend's logs do not reach Loki yet, so it stays healthy until a log shipper does.

## Messaging and AI

Beatrice consumes audio jobs from RabbitMQ, normalizes text with an LLM (Ollama) and synthesizes speech with OpenAI-compatible TTS. `local-setup/ollama` and `local-setup/openai-compatible-tts` stay where they are; `start-dev.sh` builds them (models are baked in, so the first build is large and slow) and `envs/local` loads them into kind. Beatrice does not reconnect if RabbitMQ is down when it starts, so `modules/app` makes it wait for RabbitMQ and the AI components.

`RUN_LOCAL_AI_MODELS=false` (in `.env`) skips building and deploying Ollama and OpenAI-compatible TTS. Beatrice and RabbitMQ then run only if `llm_base_url` and `tts_base_url` point at other services, for example the host or a cloud provider; otherwise they are skipped too. `broker_url` skips RabbitMQ. Beatrice has no health endpoint, so its readiness probe checks that the port is open.

Fithara (the license assistant) needs only an LLM, so it is always deployed. It has its own LLM settings: `FITHARA_LLM_PROVIDER`, `FITHARA_LLM_MODEL` (baked into the Ollama image next to Beatrice's) and `FITHARA_LLM_BASE_URL`, `FITHARA_LLM_API_KEY` and `FITHARA_LLM_TIMEOUT_MS` in `.env`. Nothing falls back to Beatrice's LLM settings: one left unset is not passed on, and Fithara refuses to start. The model must be one the `llmcapa` model catalog knows, or Fithara refuses to start. It has a Service but no route in the `Ingress`: only the backend reaches it, through `FITHARA_URL`, which `modules/app` fills in. Its readiness probe is `GET /health`, and its first start takes a while because the catalog is read then. Ollama serves only `OLLAMA_CONTEXT_LENGTH` tokens (the `context_length` input of its module, 32768 by default) whatever the model could take, while Fithara trusts the catalog's window; a conversation longer than what Ollama serves is truncated by Ollama before Fithara would condense it.

## Backend and Frontend

`envs/local` reads `.env` and hands it to `module "app"` as `backend_environment`, `backend_secret_environment` (keys matching `PASSWORD|SECRET|MASTERKEY|ACCESS_KEY`, stored in a Secret) and `frontend_environment` (the `VITE_` keys). Values that depend on the deployed components (database and Redis URLs, object storage endpoint, Beatrice and Fithara URLs, tracing) are filled in by `modules/app` and win over `.env`, so an external `database_url` or a disabled component needs no `.env` edit.

The modules know nothing about development. `backend` and `frontend` take an image, a port, environment, `volumes` (host path or claim), and the frontend also an optional `command` and `files`. Anything that has to run first, such as applying the database schema, is a `pre_deploy_jobs` entry (`modules/job`): the backend and the frontend start only after all of them completed, and `use_backend_environment` gives a Job the backend's environment, including what `modules/app` fills in.

Everything specific to hot reload lives in `envs/local/main.tf`: the development images, the `hostPath` volumes that mount `apps/` from the node, the frontend start script (`envs/local/files/`, which reads `VITE_OIDC_CLIENT_ID`), and two pre-deploy Jobs: `backend-init` (`prisma db push`, `generate`, `seed`) and `frontend-codegen` (`nx codegen frontend`, then `chown` of `apps/` to `run_as_user`; `start-dev.sh` passes `id -u`). A deployed environment passes production images, no volumes and its own migration Job.

## Devtools

`enable_devtools = true` in `envs/local/terraform.tfvars` adds RedisInsight (`redis-insight.localhost:8080`), pgAdmin (`pgadmin.localhost:8080`, `admin@admin.com` / `admin`, the database is pre-registered) and Open WebUI (`open-webui.localhost:8080`, no login). Like Grafana they are routed by host, because Open WebUI cannot be served under a path prefix. Their large images are pulled only when the flag is true.

Each tool is deployed only when the service it inspects runs in the cluster (an external `database_url`, `redis_url` or `run_local_ai_models = false` skips pgAdmin, RedisInsight or Open WebUI). Nothing outside `modules/devtools` refers to it, so a deployed environment leaves the module call out, or keeps `enable_devtools` false.

`stop:dev` falls back to deleting the kind cluster when Terraform can no longer reach it, for example right after the cluster definition changed.

## End-to-End Tests

`nx e2e backend-e2e` and `nx e2e frontend-e2e` run `infra/scripts/start-dev.sh e2e`, which builds the production backend and frontend images (the init Job still uses the development image and the mounted sources), applies `envs/local` with `mode = e2e`, `enable_devtools = false` and `run_local_ai_models` taken from `RUN_LOCAL_AI_MODELS` in `.env`, and tears everything down with `stop-dev.sh` afterwards. Redis is exposed on `localhost:6379` because the backend suites subscribe to it directly. `backend-e2e` reads the project ID, the user IDs and the integration-test bot's key and client from `terraform output -json` of `envs/local-zitadel`, so nothing is copied out of the cluster or written to the host.

The dev and e2e environments both use the cluster name `smart-novel` and host port 8080, so they cannot run together: `start-dev.sh e2e` exits with code 3 and an instruction to run `npm run stop:dev` first when the cluster exists, and the callers then skip their teardown instead of destroying the environment that is running.

## Hetzner

`envs/hetzner` deploys `modules/app` onto the cluster that the infra repo runs. It calls none of the local stand-ins (Traefik, ZITADEL server, observability) and imports no code from the infra repo: everything the cluster provides comes in as a variable (`ingress_class`, `cluster_issuer`, `storage_class`, `otel_collector_endpoint`, the kubeconfig), the values of the infra repo's `docs/app-contract.md`. Postgres and Redis run in the namespace on persistent volumes. Object storage is Cloudflare R2 and the LLM and TTS are external. `modules/backup` adds a daily and a monthly CronJob that `pg_dump` into the backup bucket under `daily/smart-novel/<database>/` and `monthly/smart-novel/<database>/`.

Apply in this order, copying `backend.tf.example` to `backend.tf` and `terraform.tfvars.example` to `terraform.tfvars` in each root, and keeping secrets in `TF_VAR_*`:

1. `envs/hetzner` without `zitadel_client_id`: everything but the backend, the frontend and the migration Job.
2. `envs/hetzner-zitadel`: smart-novel's own organization on the shared ZITADEL, with its own login policy (self-registration, default redirect, optional OTP and U2F), and the project, roles, client and, for new users, the webhook that has the backend grant the `user` role in it. Its `org_id` output goes to `envs/hetzner` as `zitadel_org_id`. People who also use Nestral have a separate account there. The organization also gets the login page in the frontend's look (light and dark, `branding` variable, the frontend's `logo.png`; the dark logo and the icons in `modules/zitadel_config/files/login` come from `infra/scripts/make-login-assets.py`). The provider authenticates with the key in the `zitadel-admin` Secret, because a token cannot upload the logo; `envs/local` stays unbranded for the same reason.
3. `envs/hetzner` with `zitadel_client_id`, `zitadel_pat`, `zitadel_management_pat` and `zitadel_webhook_signing_key` (the `backend_pat` and `webhook_signing_key` outputs of step 2) and `zitadel_project_id` (its `project_id` output): the workloads.

The backend's `zitadel_pat` should be a machine user's token; `zitadel_management_pat` is the token of the machine user that `hetzner-zitadel` creates with only the `ORG_USER_PERMISSION_EDITOR` role. The instance admin token that `hetzner-zitadel` reads is not meant for the app.

## Backup Restore Test

`infra/scripts/restore-test.sh` (needs Docker) starts a throwaway PostgreSQL with this project's image and an S3 server, runs the commands of `modules/backup` (`pg_dump --format=custom`, upload to `daily/smart-novel/smart_novel/<stamp>.dump`), downloads the object, restores it into a scratch database and compares row counts, a checksum, a full-text query and the index count with the source. It proves the commands and the format, not the CronJob, Hetzner Object Storage or real data.

## Where to Change Things

- A new component of the app: add `modules/<component>` and call it from `modules/app`. A stand-in for the platform (anything a shared cluster provides) goes in `envs/local` instead.
- A new variable in a module: give it a default that suits local development, and set it in an environment only if that one differs.
- Something specific to one environment: put it in that environment's root module and pass it into `module "app"` as an input.
- ZITADEL's configuration (a role, an application, a user, a policy): `modules/zitadel_config`, with the local values in `envs/local-zitadel/main.tf`.
- Personal overrides: `envs/local/terraform.tfvars` (git-ignored).
