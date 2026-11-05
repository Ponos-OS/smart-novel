#!/bin/sh
set -eu

if [ -n "${VITE_OIDC_CLIENT_ID:-}" ]; then
  echo "Injecting OIDC client ID: $VITE_OIDC_CLIENT_ID"
  find /usr/share/nginx/html -name '*.js' -exec \
    sed -i "s/__OIDC_CLIENT_ID_PLACEHOLDER__/$VITE_OIDC_CLIENT_ID/g" {} +
else
  echo "VITE_OIDC_CLIENT_ID is not set, OIDC login will not work"
fi

exec nginx -g 'daemon off;'
