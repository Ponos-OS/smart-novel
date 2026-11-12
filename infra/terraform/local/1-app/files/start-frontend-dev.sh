#!/bin/sh
set -eu

if [ -z "${VITE_OIDC_CLIENT_ID:-}" ]; then
  echo "VITE_OIDC_CLIENT_ID is not set, OIDC login will not work"
fi

if [ -z "${VITE_OIDC_PROJECT_ID:-}" ]; then
  echo "VITE_OIDC_PROJECT_ID is not set, the backend will refuse the tokens"
fi

exec task frontend:serve
