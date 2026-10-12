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

backend_port="$(sed -n 's/^BACKEND_PORT=//p' "$repo_root/.env" 2> /dev/null | head -n 1)"

docker build -f "$repo_root/apps/backend/Dockerfile" \
       --target development \
       --build-arg "PORT=${backend_port:-3000}" \
       -t smart-novel-backend:dev "$repo_root"
docker build -f "$repo_root/apps/frontend/Dockerfile" \
       --target development \
       -t smart-novel-frontend:dev "$repo_root"

terraform -chdir="$env_dir" init
terraform -chdir="$env_dir" apply -auto-approve
