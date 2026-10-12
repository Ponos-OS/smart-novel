# Replace Docker Compose with a modular kind + Terraform infra

DO NOT COMMIT ANYTHING AFTER YOU WORKED ON A SINGLE STEP. LET ME REVIEW IT AND THEN I WILL LET YOU KNOW IF I WANT YOU TO COMMIT IT.

## Goal

- `npm run start:dev` and `npm run stop:dev` bring the whole local environment up and down, with no Makefile.
- The environment is described once as Terraform modules under `infra/`, modeled on `/home/mjb/projects/Ponos-OS/nestral/infra`, so that a later cloud deployment reuses the same modules with different inputs.
- Every component (database, cache, object storage, auth, observability, messaging, AI, devtools, apps) is its own module that can be switched on or off, or pointed at an external service, without touching the others.

## Decisions

- Terraform plus the `hashicorp/kubernetes` provider and a `kind` cluster in Docker, like Nestral. Cluster resources are `kubernetes_*_v1` resources, not Helm charts or raw YAML.
- Layout (`infra/` at the repo root):
  - `infra/terraform/modules/<component>/`: one module per component, each with only the inputs it needs.
  - `infra/terraform/modules/app/`: the composition module. It wires the component modules together and owns the `enable_*` toggles and the external-service overrides. It knows nothing about which cluster it runs on.
  - `infra/terraform/envs/local/`: a thin root module: `kind_cluster`, image loading, the `kubernetes` provider, and one `module "app"` call.
  - No `envs/aws` in this feature. The structure must allow adding it without changing any module (no kind or local assumption inside `modules/`).
- Switch between in-cluster and external services with the `null` default, like Nestral: when `database_url` (or `redis_url`, `object_storage_endpoint`, ...) is set, the matching module is skipped.
- Components and their toggles (default in brackets):
  - `namespace`, `postgres`, `redis`, `minio`, `ingress` (Traefik), `zitadel` (core, login UI, one-shot setup job): always on.
  - `observability` (OpenTelemetry Collector, Jaeger) [on].
  - `rabbitmq` and `beatrice` [on].
  - `ollama` and `qwen_tts` [on, behind `enable_ai`, so `start:dev` can skip the heavy models].
  - `devtools` (RedisInsight, PgAdmin, Open WebUI) [off, `enable_devtools`]. Production deployments will not include it.
  - `backend` and `frontend` [on].
- Entry point stays `http://localhost:8080`. The kind node maps host port `8080` to the ingress controller, so ZITADEL's external domain, the OIDC redirect URIs and the same-origin OTLP route keep working with no port-forward.
- Hot reload is kept in the local environment only:
  - `envs/local` mounts the repo into the kind node (`extra_mounts`) and passes `dev_source_path` to `module "app"`.
  - When `dev_source_path` is set, `backend` and `frontend` run the `development` Docker target and mount `apps/` from the node via `hostPath`, with the same polling env vars as today. When it is `null`, they run the `production` target.
  - Everything else about the two components is identical in both modes.
- Secrets and settings come from `.env` (read with `regexall` in `envs/local`, like Nestral) and from Terraform variables. Generated secrets (ZITADEL masterkey, session secret) are produced by Terraform where a throwaway value is acceptable.
- Container images of third-party components are variables with pinned defaults (the versions in `compose.yml` today), preloaded into kind.
- The ZITADEL bot PAT, login-client PAT and generated OIDC client ID reach the pods through one mechanism chosen in Step 3 and used by every consumer (replacing the `zitadel-pat` volume).
- Prerequisites are Docker, Terraform and the `kind` CLI. `start:dev` fails early with a clear message if one is missing.
- Docker Compose is removed at the end (Step 9), not before; each step keeps compose working until then so the repo is never without a runnable environment.
- Out of scope: an AWS environment, CI changes beyond what e2e needs, and any new application feature.

## Step 1: Skeleton, kind cluster, and npm scripts

- Create `infra/terraform/envs/local` with the `kind` provider, a `kind_cluster` named `smart-novel`, host port `8080` mapped to the node, and the repo mounted for hot reload.
- Add `modules/namespace` and `modules/app` (initially only the namespace), with a `labels` input applied to every resource.
- Add the image-loading `terraform_data` resource (app images and third-party images, host platform only, as in Nestral).
- `start:dev`: check prerequisites, build the app images, `terraform init` and `apply -auto-approve` for `envs/local`. `stop:dev`: `terraform destroy -auto-approve`. Implement as small scripts under `infra/scripts/` that the npm scripts call, since the Nestral Makefile logic does not fit one-line npm scripts.
- Add an `update:dev` npm script only if rebuilding is needed when hot reload cannot cover a change (for example new dependencies); decide in this step.
- Git-ignore Terraform state, `.terraform/`, `terraform.tfvars` and the generated kubeconfig.
- Write `infra/README.md` (short, no emojis): layout, how the modules compose, where to change things.

### Test

- `terraform validate` and `terraform test` on `modules/*` (plan-level, `.tftest.hcl`, like Nestral).
- Manual: `npm run start:dev` creates the cluster and namespace; `npm run stop:dev` removes it; running either twice is safe.

## Step 2: Data modules (Postgres, Redis, MinIO)

- `modules/postgres`: StatefulSet or Deployment plus Service, credentials from variables, a readiness probe, and the extra `zitadel` database and role created at init (replaces `create-zitadel-db.sh`). Skipped when `database_url` is given.
- `modules/redis`: same image and flags as `start-redis.sh` (maxmemory, policy, optional password), memory limit kept.
- `modules/minio`: server plus a bucket-init Job that creates the bucket, uploads the seed covers from `apps/backend/data`, and applies `bucket-policy.json`. The cover files reach the Job without a host mount in non-dev mode (decide in this step and document).
- Persistent volumes controlled by one `persistent_volumes` flag, off locally (throwaway data).

### Test

- `.tftest.hcl` for each module: skipped when the external URL is set; present otherwise.
- Manual: `kubectl exec` into the cluster to confirm Postgres accepts both databases, Redis answers `PING`, and the bucket holds the covers.

## Step 3: Ingress and ZITADEL

- `modules/ingress`: Traefik with the Kubernetes provider (IngressRoute or Ingress), reachable on the kind-mapped port `8080`. Modules contribute their own routes (path, priority, service); the ingress module owns no application knowledge. Priorities from `compose.yml` are preserved.
- `modules/zitadel`: `init` and `start-from-setup` as a Job plus Deployment, the login UI Deployment, the same environment as today (login V2, token exchange and impersonation features, bot and login-client machine users).
- The `setup-zitadel` script becomes a Job. Choose and document how the PATs and the OIDC client ID are shared (Kubernetes Secret written by the Job, or a PVC), and expose them to consumers through a module output so `backend` and `frontend` never reference the mechanism directly.
- The user ids written to `local-setup/user-ids` and the PATs written to `local-setup/pats` that the e2e suites read must remain available to them (decide the new location in this step; consumed in Step 8).

### Test

- `.tftest.hcl`: routes registered by a module appear in the ingress; ZITADEL environment contains the external port from the input.
- Manual: `http://localhost:8080/ui/console/` loads and the admin login works; the setup Job completes and the client ID is readable by a test pod.

## Step 4: Observability

- `modules/observability`: OpenTelemetry Collector (config moved from `local-setup/otel-collector-config.yaml` into the module) and Jaeger, with the OTLP HTTP and gRPC services inside the cluster.
- The collector contributes the browser OTLP route `/v1/traces` to the ingress. Jaeger UI is reachable locally (path on the ingress or documented port-forward; pick one and keep it consistent with the other UIs).
- The "wait until the collector is healthy" check becomes a readiness probe, replacing `otel-healthcheck`.
- Trace sampling is a variable (1.0 locally).

### Test

- `.tftest.hcl` for the toggle and the sampling variable.
- Manual: a trace sent to `localhost:8080/v1/traces` shows up in Jaeger.

## Step 5: Messaging and AI

- `modules/rabbitmq`, skipped when `broker_url` is given.
- `modules/beatrice`: image `9109679196/smart-novel-beatrice:${BEATRICE_VERSION}`, same environment as today, endpoints for Ollama and Qwen-TTS taken from variables, so the host or an external service can be used instead.
- `modules/ollama` and `modules/qwen_tts`: built from `local-setup/ollama` and `local-setup/qwen-tts` (move those directories under `infra/` or keep them and reference them; decide here), loaded into kind. Both sit behind `enable_ai`; with it off, Beatrice receives URLs from variables or is also skipped (decide and document the behavior).
- Probes replace the compose healthchecks.

### Test

- `.tftest.hcl`: `enable_ai = false` creates neither Ollama nor Qwen-TTS; `broker_url` set skips RabbitMQ.
- Manual: Beatrice reports healthy with `enable_ai = true`.

## Step 6: Backend and frontend with hot reload

- `modules/backend`: Deployment and Service; the init Job (`prisma:db:push`, `prisma:generate`, `prisma:seed`) replaces `init-postgres`; the GraphQL health probe replaces the compose healthcheck; routes `/graphql` and `/beatrice-callbacks` registered on the ingress. All environment from `.env`.
- `modules/frontend`: Deployment and Service; the codegen Job (`nx codegen frontend`) replaces `init-codegen`; the OIDC client ID injected like `start-frontend-dev.sh` does today; routes `/` and `/assets` (excluding ZITADEL's `/assets/v1`).
- Both accept `dev_source_path`: set means `development` target plus `hostPath` mount of `apps/`; unset means `production` target and no mount.
- The development image is rebuilt only when dependencies change, not on code changes.

### Test

- `.tftest.hcl`: with and without `dev_source_path`, the volume and image target differ and nothing else does.
- Manual: edit a backend resolver and a frontend component and see both reload without rebuilding or restarting pods; log in through ZITADEL end to end.
- Invoke `graphql-api-tester` against the running stack to confirm `{ health }` and one authenticated query.

## Step 7: Devtools module

- `modules/devtools`: RedisInsight, PgAdmin and Open WebUI, with the configuration from `compose.devtools.yml`. Off by default; `enable_devtools = true` in `terraform.tfvars` turns it on.
- Each tool is reachable locally at the address documented in `CONTRIBUTING.md` (ingress path or port-forward; pick one consistently with Step 4).
- Nothing outside this module refers to it, so removing the module call is the only change needed to exclude it from a deployment.

### Test

- `.tftest.hcl`: nothing is created when `enable_devtools = false`.
- Manual: toggle it on and open each tool.

## Step 8: End-to-end tests against the new infra

- `backend-e2e` and `frontend-e2e` Nx targets start and stop the infra with the same scripts as `start:dev`, using the `production` target images (`dev_source_path = null`) and `enable_devtools = false`.
- The e2e environment cannot run concurrently with the dev environment (both own host port `8080`); detect a running dev cluster and fail with a clear message, or use a separate cluster name and document the port conflict. Pick one.
- Where the suites read PATs and user ids from `local-setup/` today, they read them from the location chosen in Step 3.
- Remove the `docker system prune` style teardown that was needed for compose, if it is no longer necessary.

### Test

- `nx e2e backend-e2e` and `nx e2e frontend-e2e` both pass on the new infra.

## Step 9: Remove Docker Compose and update the docs

- Delete `compose.yml`, `compose.e2e.yml`, `compose.devtools.yml`, and whatever under `local-setup/` is migrated; update `clean` in `package.json`, `.gitignore`, `.dockerignore`, and `sonar-project.properties` as needed.
- Update `.github/CONTRIBUTING.md` (quick start, devtools, e2e instructions), `.github/docs/process/PROCESS.md` (every `docker compose` command), `.github/docs/gotchas.md`, `README`, and `local-setup/setup-zitadel/README.md`.
- Add to `CONTRIBUTING.md` the guidance on where to change things (new component, new variable, environment-specific input), as in the Nestral infra README.

### Test

- `grep -ri "docker compose\|compose.yml"` finds nothing outside git history.
- Fresh clone: `npm run init && npm run start:dev` reaches a working app at `http://localhost:8080`; `npm run stop:dev` leaves no kind cluster behind.

## Open Questions

- Whether the AWS (EKS and RDS) environment is wanted as a follow-up feature; this document only keeps the door open for it.
