#!/bin/sh
set -eu

if [ -f "$ZITADEL_CLIENT_ID_FILE" ]; then
  CLIENT_ID="$(tr -d '[:space:]' < "$ZITADEL_CLIENT_ID_FILE")"
  echo "Injecting OIDC client ID: $CLIENT_ID"
  find /usr/share/nginx/html -name '*.js' -exec \
    sed -i "s/__OIDC_CLIENT_ID_PLACEHOLDER__/$CLIENT_ID/g" {} +
else
  echo "$ZITADEL_CLIENT_ID_FILE not found, OIDC login will not work"
fi

exec nginx -g 'daemon off;'
