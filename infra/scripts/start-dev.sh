#!/bin/sh
set -eu

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
env_dir="$repo_root/infra/terraform/envs/local"

for tool in docker terraform kind; do
  command -v "$tool" > /dev/null || {
    echo "Error: $tool is not installed." >&2
    exit 1
  }
done

env_value() {
  sed -n "s/^$1=\\([^# ]*\\).*/\\1/p" "$repo_root/.env" 2> /dev/null | head -n 1
}

backend_port="$(env_value BACKEND_PORT)"

docker build -f "$repo_root/apps/backend/Dockerfile" \
       --target development \
       --build-arg "PORT=${backend_port:-3000}" \
       -t smart-novel-backend:dev "$repo_root"
docker build -f "$repo_root/apps/frontend/Dockerfile" \
       --target development \
       -t smart-novel-frontend:dev "$repo_root"
docker build -t smart-novel-setup-zitadel:dev "$repo_root/local-setup/setup-zitadel"

if ! grep -qs '^[[:space:]]*enable_ai[[:space:]]*=[[:space:]]*false' "$env_dir/terraform.tfvars"; then
  docker build --build-arg "OLLAMA_MODEL=$(env_value OLLAMA_MODEL)" \
         -t smart-novel-ollama:dev "$repo_root/local-setup/ollama"
  docker build --build-arg "QWEN_TTS_MODEL=$(env_value QWEN_TTS_MODEL)" \
         -t smart-novel-qwen-tts:dev "$repo_root/local-setup/qwen-tts"
fi

terraform -chdir="$env_dir" init
terraform -chdir="$env_dir" apply -auto-approve
