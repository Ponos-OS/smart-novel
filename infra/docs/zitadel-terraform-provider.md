# Configuring a Deployed ZITADEL

`modules/zitadel_config` configures ZITADEL with the `zitadel/zitadel` provider. `envs/local-zitadel` is the local root module for it; a deployed environment (QA, production) gets its own root module that calls the same module with its own inputs. This note lists what differs.

## Credential

The local root module authenticates the provider with the PAT ZITADEL writes for its first-instance machine user, read from the cluster with `kubectl exec`. A deployed root module cannot do that. Create a machine user with the instance role it needs (for example `IAM_OWNER`), download its JSON key, and pass it to the provider as `jwt_profile_file` or `jwt_profile_json`. Keep the key in the pipeline's secret store.

## Reachability

Terraform runs where the pipeline runs and talks to ZITADEL's API: set `domain`, and leave `insecure` and `port` out so it uses HTTPS on 443. The runner must be able to reach that address, and the address must be ZITADEL's external domain.

## Inputs

- `redirect_uris` and `post_logout_redirect_uris`: the deployed frontend's URLs. Keep `dev_mode` off.
- `users`: leave empty. The local test users have public passwords. A user without a `password` cannot log in.
- `allow_self_registration`: decide whether people may register themselves.
- `impersonation`: leave `null` unless this instance holds no real users, for example a QA instance. Impersonation is instance-wide, and its bot can act as any user. When set, `credential_expiration_date` controls how long the bot's key and PAT last.

## Outputs

The root module outputs the client ID, and, where impersonation is set, the bot's key and PAT. Pass the client ID to the workloads as `ZITADEL_CLIENT_ID` and `VITE_OIDC_CLIENT_ID`, the way `envs/local` does from stage 2's outputs. The backend also needs a PAT in `ZITADEL_PAT`, to create sessions on behalf of users.

## State

Keep the state in a remote backend with locking. It holds the generated keys and tokens.
