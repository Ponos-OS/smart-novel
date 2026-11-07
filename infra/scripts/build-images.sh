#!/bin/sh
# Usage: build-images.sh [dev|e2e]
# Builds the images start-dev.sh loads into the kind cluster. The independent builds run side by side.
# IMAGE_TAG (default e2e) is the tag of the production images; CI passes the semver they will be released as.
# DOCKER_BUILD_CACHE_SCOPE, when set, shares the layer cache through the GitHub Actions cache; `--load` puts the result into the local daemon.
set -eu

mode="${1:-dev}"
image_tag="${IMAGE_TAG:-e2e}"
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"

. "$repo_root/infra/scripts/timing.sh"
TIMINGS_TITLE="build-images.sh $mode"

env_value() {
  sed -n "s/^$1=\\([^# ]*\\).*/\\1/p" "$repo_root/.env" 2> /dev/null | head -n 1
}

backend_port="$(env_value BACKEND_PORT)"

# The default docker driver cannot export a cache, so with a cache scope the builds run on a docker-container builder of their own.
cache_builder="smart-novel-cache"
if [ -n "${DOCKER_BUILD_CACHE_SCOPE:-}" ]; then
  docker buildx inspect "$cache_builder" > /dev/null 2>&1 \
    || docker buildx create --name "$cache_builder" --driver docker-container > /dev/null
fi

build() {
  name="$1"
  shift
  if [ -z "${DOCKER_BUILD_CACHE_SCOPE:-}" ]; then
    timed "docker build $name" docker build "$@"
    return
  fi
  timed "docker build $name" docker buildx build --builder "$cache_builder" --load \
    --cache-from "type=gha,scope=$DOCKER_BUILD_CACHE_SCOPE-$name" \
    --cache-to "type=gha,mode=max,scope=$DOCKER_BUILD_CACHE_SCOPE-$name" "$@"
}

# Runs the builds in the background, then waits for each one so a failure is not lost.
pids=""
run_in_background() {
  "$@" &
  pids="$pids $!"
}

wait_for_all() {
  failed=0
  for pid in $pids; do
    wait "$pid" || failed=1
  done
  pids=""
  return "$failed"
}

# The init Job runs the development image in both modes.
run_in_background build backend:dev \
  -f "$repo_root/apps/backend/Dockerfile" \
  --target development \
  --build-arg "PORT=${backend_port:-3000}" \
  -t smart-novel-backend:dev "$repo_root"

if [ "$mode" = dev ]; then
  run_in_background build frontend:dev \
    -f "$repo_root/apps/frontend/Dockerfile" \
    --target development \
    -t smart-novel-frontend:dev "$repo_root"
else
  run_in_background build backend:e2e \
    -f "$repo_root/apps/backend/Dockerfile" \
    --target production \
    --build-arg "PORT=${backend_port:-3000}" \
    --build-arg "DATABASE_URL=postgresql://dummy" \
    --build-arg "BEATRICE_VERSION=$(env_value BEATRICE_VERSION)" \
    --build-arg "FITHARA_VERSION=$(env_value FITHARA_VERSION)" \
    -t "smart-novel-backend:$image_tag" "$repo_root"
  # The production build compiles the frontend, which needs the generated typed hooks.
  timed "nx codegen frontend" sh -c 'cd "$1" && npx nx codegen frontend' sh "$repo_root"
  # The client ID is generated at runtime; the frontend's start script replaces the placeholder.
  run_in_background build frontend:e2e \
    -f "$repo_root/apps/frontend/Dockerfile" \
    --target production \
    --build-arg "VITE_SERVICE_URL=$(env_value VITE_SERVICE_URL)" \
    --build-arg "VITE_OIDC_CLIENT_ID=__OIDC_CLIENT_ID_PLACEHOLDER__" \
    --build-arg "VITE_OIDC_AUTHORITY=$(env_value VITE_OIDC_AUTHORITY)" \
    --build-arg "VITE_OIDC_REDIRECT_URI=$(env_value VITE_OIDC_REDIRECT_URI)" \
    --build-arg "VITE_OIDC_SCOPE=$(sed -n "s/^VITE_OIDC_SCOPE='\\(.*\\)'.*/\\1/p" "$repo_root/.env" | head -n 1)" \
    --build-arg "VITE_OTLP_ENDPOINT=$(env_value VITE_OTLP_ENDPOINT)" \
    -t "smart-novel-frontend:$image_tag" "$repo_root"
fi

wait_for_all
