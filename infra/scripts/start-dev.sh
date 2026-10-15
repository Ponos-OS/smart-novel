#!/bin/sh
# Usage: start-dev.sh [e2e]
# Without an argument: the development environment, with hot reload.
# e2e: the production images and no devtools, for the end-to-end suites.
set -eu

mode="${1:-dev}"
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
env_dir="$repo_root/infra/terraform/envs/local"
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
docker build -t smart-novel-setup-zitadel:dev "$repo_root/local-setup/setup-zitadel"

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
if [ "$mode" = e2e ]; then
  set -- "$@" -var enable_ai=true -var enable_devtools=false
fi

if [ "$mode" = e2e ] || ! grep -qs '^[[:space:]]*enable_ai[[:space:]]*=[[:space:]]*false' "$env_dir/terraform.tfvars"; then
  docker build --build-arg "BEATRICE_LLM_MODEL=$(env_value BEATRICE_LLM_MODEL)" \
         -t smart-novel-ollama:dev "$repo_root/local-setup/ollama"
  docker build --build-arg "BEATRICE_TTS_MODEL=$(env_value BEATRICE_TTS_MODEL)" \
         -t smart-novel-openai-compatible-tts:dev "$repo_root/local-setup/openai-compatible-tts"
fi

TF_VAR_run_as_user="$(id -u)"
export TF_VAR_run_as_user

terraform -chdir="$env_dir" init
terraform -chdir="$env_dir" apply -auto-approve "$@"
