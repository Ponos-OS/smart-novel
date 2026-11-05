#!/bin/sh
set -eu

html_root="${HTML_ROOT:-/usr/share/nginx/html}"

if [ -n "${VITE_OIDC_CLIENT_ID:-}" ]; then
  echo "Injecting OIDC client ID: $VITE_OIDC_CLIENT_ID"
  find "$html_root" -name '*.js' -exec \
    sed -i "s/__OIDC_CLIENT_ID_PLACEHOLDER__/$VITE_OIDC_CLIENT_ID/g" {} +
else
  echo "VITE_OIDC_CLIENT_ID is not set, OIDC login will not work"
fi

# The image is built with the scope urn:zitadel:iam:org:id:__OIDC_ORG_ID_PLACEHOLDER__ in VITE_OIDC_SCOPE.
# With an organization the scope names it; without one the scope is removed and the sign-in uses the instance default.
if [ -n "${VITE_OIDC_ORG_ID:-}" ]; then
  echo "Injecting OIDC organization ID: $VITE_OIDC_ORG_ID"
  find "$html_root" -name '*.js' -exec \
    sed -i "s/__OIDC_ORG_ID_PLACEHOLDER__/$VITE_OIDC_ORG_ID/g" {} +
else
  find "$html_root" -name '*.js' -exec \
    sed -i "s/ *urn:zitadel:iam:org:id:__OIDC_ORG_ID_PLACEHOLDER__//g" {} +
fi

exec nginx -g 'daemon off;'
