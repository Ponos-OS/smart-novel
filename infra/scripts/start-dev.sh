#!/bin/sh
# Usage: start-dev.sh [e2e]
# Without an argument: the development environment, with hot reload.
# e2e: the production images and no devtools, for the end-to-end suites.
set -eu

mode="${1:-dev}"
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
env_dir="$repo_root/infra/terraform/envs/local"
zitadel_env_dir="$repo_root/infra/terraform/envs/local-zitadel"
cluster_name="smart-novel"

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

env_value() {
  sed -n "s/^$1=\\([^# ]*\\).*/\\1/p" "$repo_root/.env" 2> /dev/null | head -n 1
}

backend_port="$(env_value BACKEND_PORT)"

# The init Job runs the development image in both modes.
docker build -f "$repo_root/apps/backend/Dockerfile" \
       --target development \
       --build-arg "PORT=${backend_port:-3000}" \
       -t smart-novel-backend:dev "$repo_root"

if [ "$mode" = dev ]; then
  docker build -f "$repo_root/apps/frontend/Dockerfile" \
         --target development \
         -t smart-novel-frontend:dev "$repo_root"
else
  docker build -f "$repo_root/apps/backend/Dockerfile" \
         --target production \
         --build-arg "PORT=${backend_port:-3000}" \
         --build-arg "DATABASE_URL=postgresql://dummy" \
         --build-arg "BEATRICE_VERSION=$(env_value BEATRICE_VERSION)" \
         -t smart-novel-backend:e2e "$repo_root"
  # The production build compiles the frontend, which needs the generated typed hooks.
  (cd "$repo_root" && npx nx codegen frontend)
  # The client ID is generated at runtime; the frontend's start script replaces the placeholder.
  docker build -f "$repo_root/apps/frontend/Dockerfile" \
         --target production \
         --build-arg "VITE_SERVICE_URL=$(env_value VITE_SERVICE_URL)" \
         --build-arg "VITE_OIDC_CLIENT_ID=__OIDC_CLIENT_ID_PLACEHOLDER__" \
         --build-arg "VITE_OIDC_AUTHORITY=$(env_value VITE_OIDC_AUTHORITY)" \
         --build-arg "VITE_OIDC_REDIRECT_URI=$(env_value VITE_OIDC_REDIRECT_URI)" \
         --build-arg "VITE_OIDC_SCOPE=$(sed -n "s/^VITE_OIDC_SCOPE='\\(.*\\)'.*/\\1/p" "$repo_root/.env" | head -n 1)" \
         --build-arg "VITE_OTLP_ENDPOINT=$(env_value VITE_OTLP_ENDPOINT)" \
         -t smart-novel-frontend:e2e "$repo_root"
fi

set -- -var "mode=$mode"
run_local_ai_models="$(env_value RUN_LOCAL_AI_MODELS)"
run_local_ai_models="${run_local_ai_models:-true}"
set -- "$@" -var "run_local_ai_models=$run_local_ai_models"
if [ "$mode" = e2e ]; then
  set -- "$@" -var enable_devtools=false
fi

if [ "$run_local_ai_models" = true ]; then
  docker build --build-arg "BEATRICE_LLM_MODEL=$(env_value BEATRICE_LLM_MODEL)" \
         -t smart-novel-ollama:dev "$repo_root/local-setup/ollama"
  docker build --build-arg "BEATRICE_TTS_MODEL=$(env_value BEATRICE_TTS_MODEL)" \
         -t smart-novel-openai-compatible-tts:dev "$repo_root/local-setup/openai-compatible-tts"
fi

TF_VAR_run_as_user="$(id -u)"
export TF_VAR_run_as_user

terraform -chdir="$env_dir" init

# Stage 1: the cluster and ZITADEL. The backend, the frontend and the Jobs need ZITADEL's generated credentials at startup, so they wait for stage 2.
terraform -chdir="$env_dir" apply -auto-approve -var wait_for_zitadel_credentials=true "$@"

# Stage 2: configure ZITADEL.
terraform -chdir="$zitadel_env_dir" init
terraform -chdir="$zitadel_env_dir" apply -auto-approve

# Stage 3: deploy the workloads.
terraform -chdir="$env_dir" apply -auto-approve -var wait_for_zitadel_credentials=false "$@"

if [ "$mode" = dev ]; then
  cat <<'EOT'

Everything is behind Traefik on port 8080:

  UI                http://localhost:8080                      login: infra/terraform/envs/local-zitadel/main.tf
  GraphQL (Apollo)  http://localhost:8080/graphql              needs a bearer token from a logged-in session
  ZITADEL console   http://localhost:8080/ui/console/          admin login: infra/terraform/envs/local-zitadel/main.tf
  Grafana           http://grafana.localhost:8080              admin password: see infra/README.md
  RabbitMQ          http://rabbitmq.localhost:8080             guest / guest, only when Beatrice is deployed
  RustFS console    http://s3-console.localhost:8080           S3 API on http://s3.localhost:8080
  RedisInsight      http://redis-insight.localhost:8080        needs enable_devtools = true
  pgAdmin           http://pgadmin.localhost:8080              needs enable_devtools = true, admin@admin.com / admin
  Open WebUI        http://open-webui.localhost:8080           needs enable_devtools = true

Beatrice is cluster-internal, forward it to reach http://localhost:3001/graphql:

  kubectl --kubeconfig infra/terraform/envs/local/smart-novel-config -n smart-novel port-forward deploy/beatrice 3001:3000
EOT
fi
