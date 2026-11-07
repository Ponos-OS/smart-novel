#!/bin/sh
# Usage: start-dev.sh [e2e]
# Without an argument: the development environment, with hot reload.
# e2e: the production images and no devtools, for the end-to-end suites.
set -eu

mode="${1:-dev}"
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
env_dir="$repo_root/infra/terraform/local/1-app"
zitadel_env_dir="$repo_root/infra/terraform/local/2-zitadel-config"
cluster_name="smart-novel"
image_tag="${IMAGE_TAG:-e2e}"

. "$repo_root/infra/scripts/timing.sh"
TIMINGS_TITLE="start-dev.sh $mode"

case "$mode" in
  dev | e2e) ;;
  *)
    echo "Error: unknown mode '$mode', expected dev or e2e." >&2
    exit 2
    ;;
esac

for tool in docker terraform kind; do
  command -v "$tool" > /dev/null || {
    echo "Error: $tool is not installed." >&2
    exit 1
  }
done

# Both environments own host port 8080, so the e2e environment cannot start next to a running one. Exit code 3 tells callers nothing was started, so they must not tear anything down.
if [ "$mode" = e2e ] && kind get clusters 2> /dev/null | grep -qx "$cluster_name"; then
  echo "Error: the kind cluster '$cluster_name' already exists, either the dev environment or an interrupted e2e run." >&2
  echo "Both use host port 8080. Run 'npm run stop:dev' first." >&2
  exit 3
fi

# Terraform cannot refresh a kind_cluster that no longer exists, for example after Docker was reset or the cluster was deleted by hand, so a leftover state would fail the plan. The environment is throwaway: forget it.
if ! kind get clusters 2> /dev/null | grep -qx "$cluster_name"; then
  rm -f "$env_dir"/terraform.tfstate "$env_dir"/terraform.tfstate.backup "$env_dir/$cluster_name-config" \
        "$zitadel_env_dir"/terraform.tfstate "$zitadel_env_dir"/terraform.tfstate.backup
fi

# CI builds the images once in a separate job and loads them here.
if [ -z "${SKIP_IMAGE_BUILD:-}" ]; then
  sh "$repo_root/infra/scripts/build-images.sh" "$mode"
fi

if [ "$mode" = dev ]; then
  built_images="smart-novel-backend:dev smart-novel-frontend:dev"
else
  built_images="smart-novel-backend:dev smart-novel-backend:$image_tag smart-novel-frontend:$image_tag"
fi
# The images keep their tags across rebuilds; the IDs tell Terraform when to load them into the cluster again.
# shellcheck disable=SC2086
built_images_fingerprint="$(docker image inspect --format '{{.Id}}' $built_images | tr '\n' ',')"

set -- -var "mode=$mode" -var "built_images_fingerprint=$built_images_fingerprint" -var "image_tag=$image_tag"
if [ "$mode" = e2e ]; then
  # e2e never calls a paid provider (Beatrice and Fithara talk to WireMock) and nobody reads its traces.
  set -- "$@" -var enable_devtools=false -var mock_ai_providers=true -var enable_observability=false
fi

TF_VAR_run_as_user="$(id -u)"
export TF_VAR_run_as_user

timed "terraform init (1-app)" terraform -chdir="$env_dir" init

# Stage 1: the cluster and ZITADEL. The backend, the frontend and the Jobs need ZITADEL's generated credentials at startup, so they wait for stage 2.
timed "terraform apply stage 1 (cluster, ZITADEL)" terraform -chdir="$env_dir" apply -auto-approve -var wait_for_zitadel_credentials=true "$@"

# Stage 2: configure ZITADEL.
timed "terraform init (2-zitadel-config)" terraform -chdir="$zitadel_env_dir" init
timed "terraform apply stage 2 (ZITADEL config)" terraform -chdir="$zitadel_env_dir" apply -auto-approve

# Stage 3: deploy the workloads.
timed "terraform apply stage 3 (workloads)" terraform -chdir="$env_dir" apply -auto-approve -var wait_for_zitadel_credentials=false "$@"

if [ "$mode" = dev ]; then
  cat <<'EOT'

Everything is behind Traefik on port 8080:

  UI                http://localhost:8080                      login: infra/terraform/local/2-zitadel-config/main.tf
  GraphQL (Apollo)  http://localhost:8080/graphql              needs a bearer token from a logged-in session
  ZITADEL console   http://auth.localhost:8080/ui/console/     admin login: infra/terraform/local/2-zitadel-config/main.tf
  Grafana           http://grafana.localhost:8080              admin password: see infra/README.md
  RabbitMQ          http://rabbitmq.localhost:8080             guest / guest, only when Beatrice is deployed
  RustFS console    http://s3-console.localhost:8080           S3 API on http://s3.localhost:8080
  RedisInsight      http://redis-insight.localhost:8080        needs enable_devtools = true
  pgAdmin           http://pgadmin.localhost:8080              needs enable_devtools = true, admin@admin.com / admin

Beatrice is cluster-internal, forward it to reach http://localhost:3001/graphql:

  kubectl --kubeconfig infra/terraform/local/1-app/smart-novel-config -n smart-novel port-forward deploy/beatrice 3001:3000

To login Grafana you can use "admin" as username and password:
  kubectl --kubeconfig infra/terraform/local/1-app/smart-novel-config -n smart-novel get secret grafana-admin -o jsonpath='{.data.password}' | base64 -d; echo
EOT
fi
