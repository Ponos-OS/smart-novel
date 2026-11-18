#!/bin/sh
# Usage: run.sh [k6 run flags]
# Runs the load test with the k6 image against the stack on localhost, which must be up and seeded.
set -eu

root="$(cd "$(dirname "$0")/../.." && pwd)"
k6_image="grafana/k6:2.4.0"
outputs="$(mktemp -d)"
trap 'rm -rf "$outputs"' EXIT

command -v docker > /dev/null || {
  echo "Error: docker is not installed." >&2
  exit 1
}

# The credentials of the seeded users stay out of the repository and out of the process list: the container reads them from a temporary file.
terraform -chdir="$root/infra/terraform/local/2-zitadel-config" output -json > "$outputs/outputs.json"
chmod -R a+rX "$outputs"

docker run --rm --network host \
  --user "$(id -u):$(id -g)" \
  -v "$root:/repo:ro" \
  -v "$outputs:/run/zitadel:ro" \
  -w /repo/apps/backend-stress \
  -e "BASE_URL=${BASE_URL:-http://localhost:${TRAEFIK_EXPOSED_PORT:-8080}}" \
  -e "ZITADEL_ISSUER_URL=${ZITADEL_ISSUER_URL:-http://auth.localhost:8080}" \
  "$k6_image" run "$@" src/main.ts
