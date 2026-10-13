#!/bin/sh
set -eu

if [ -f "$ZITADEL_CLIENT_ID_FILE" ]; then
  VITE_OIDC_CLIENT_ID="$(tr -d '[:space:]' < "$ZITADEL_CLIENT_ID_FILE")"
  export VITE_OIDC_CLIENT_ID
  echo "VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID (from $ZITADEL_CLIENT_ID_FILE)"
else
  echo "$ZITADEL_CLIENT_ID_FILE not found, OIDC login will not work"
fi

exec npx nx serve frontend --host=0.0.0.0
