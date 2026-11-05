#!/bin/sh
set -eu

if [ -z "${VITE_OIDC_CLIENT_ID:-}" ]; then
  echo "VITE_OIDC_CLIENT_ID is not set, OIDC login will not work"
fi

exec npx nx serve frontend --host=0.0.0.0
