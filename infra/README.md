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

Code changes need no rebuild: `envs/local` mounts `apps/` into the kind node and passes its path to `module "app"` as `dev_source_path`. Rebuild only when dependencies change, by running `start:dev` again.

## Data Components

Postgres, Redis and MinIO are deployed in the cluster under the Service names `postgres`, `redis` and `s3`, which the application settings in `.env` already use. Setting `database_url`, `redis_url` or `object_storage_endpoint` on `module "app"` skips the matching component. Data is throwaway unless `persistent_volumes` is `true`.

MinIO is reachable from the host on `localhost:9000` (S3 API) and `localhost:9001` (console), through node ports mapped by `envs/local`. The seed covers in `apps/backend/data` are uploaded only when `dev_source_path` is set, because they reach the Job through the node mount; without it only the bucket and its policy are created.

## Ingress and ZITADEL

Traefik listens on node port 80, which kind maps to `localhost:8080`. It uses its file provider, so it needs no Kubernetes API access and no CRDs. A module contributes a route by exposing it in a `routes` output (`name`, `rule`, `priority`, `service`, optional `middlewares`); `modules/app` passes the routes of all modules to `modules/ingress`. The ingress module knows nothing about the applications behind it.

ZITADEL's generated credentials (the bot PAT, the login-client PAT, the project ID, the OIDC client ID and the user IDs written by the setup script) live on one PersistentVolumeClaim, `zitadel-credentials`, mounted at `/zitadel-pat` by ZITADEL, the login UI and the setup Job. Consumers get the claim name and file paths from the `zitadel_credentials` output of `modules/app` (available only after the setup Job finished) and never refer to the volume directly.

To read the files from the host, for example for the e2e suites, copy them out of a pod that mounts the claim. Step 8 of `REQUIREMENTS.md` does this into the git-ignored `local-setup/{pats,client,user-ids}` directories the suites already read.

## Where to Change Things

- A new component: add `modules/<component>` and call it from `modules/app`.
- A new variable in a module: give it a default that suits local development, and set it in an environment only if that one differs.
- Something specific to one environment: put it in that environment's root module and pass it into `module "app"` as an input.
- Personal overrides: `envs/local/terraform.tfvars` (git-ignored).
