# ZITADEL Initialization Script

This Node.js ESM application initializes ZITADEL with test users, projects, and OIDC applications for local development.

https://dev.to/kasir-barati/auto-assigning-a-role-to-self-registered-users-in-zitadel-with-a-zitadel-action-4imi

> [!TIP]
>
> If you change something related to how ZITADEL generates access tokens/JWT tokens you might wanna first cleanup your UI's local storage so it is using the new token generated with the latest changes. I grappled with this exact issue when I changed my app to generate JWT tokens instead of opaque access tokens.

## Architecture

The script is modular and organized into services, data modules, actions, and utilities:

### Services

Services encapsulate interactions with different ZITADEL API versions:

- **`ZitadelUsersV2Service`** - Users V2 API endpoints (`/v2/users`)
  - Create human users
  - Create machine users (service accounts)
  - Add JSON keys to machine users
  - Find users by email or username

- **`ZitadelManagementV1Service`** - Management V1 API endpoints (`/management/v1`)
  - Create and find projects
  - Create project roles
  - Assign roles to users
  - Create OIDC applications (public and confidential)
  - Grant users project access (for token exchange)
  - Create Personal Access Tokens (PAT) for users
  - List user grants
  - Enable self-registration (customize login policy)
  - Fetch, create, and update login policies
  - Create and manage Actions (server-side JavaScript snippets)
  - Set trigger actions for flow types (e.g. post-registration auto role assignment)

- **`ZitadelAdminV1Service`** - Admin V1 API endpoints (`/admin/v1`)
  - Enable impersonation in security policy
  - Add instance members with IAM roles (`IAM_OWNER`, `IAM_END_USER_IMPERSONATOR`, etc.)

- **`ZitadelAuthV1Service`** - Auth V1 API endpoints (`/auth/v1`)
  - Get current authenticated user (user ID and organization ID)

- **`config`** - Configuration service
  - Reads and validates environment variables
  - Defines file output paths
  - Creates necessary output directories

### Actions

Zitadel Action scripts (server-side JavaScript) that run inside the ZITADEL process:

- **`post-self-registration-to-extend-user-claims.mjs`** - Builds the `postSelfRegistrationToExtendUserClaims` action script at setup time, injecting the project ID and bot PAT. The generated script auto-grants the `user` role to self-registered users via the Management API and includes a `hasRole` guard to skip if the role is already assigned.
- **`has-role.mjs`** - Helper function inlined into the action script at build time. Checks whether a user's grants already contain a given role key.
- **`print-keys-deep.mjs`** - Debugging utility for deep-printing object keys inside Zitadel actions using `zitadel/log`. Useful for inspecting the `ctx` and `api` objects during action development.

### Data Modules

Static data definitions used by the initialization script:

- **`users.data.js`** - Test user definitions (email, name, password, role, output file path)
- **`roles.data.js`** - Project role definitions (roleKey, displayName)

### Utilities

- **`Logger`** - Consistent logging with formatted output (section headers, info, success, error)
- **`FileUtil`** - File operations: read PAT with retries, write files
- **`sleep`** - Promise-based delay for eventual consistency waits
- **`isEmpty`** / **`isNotEmpty`** - Null/undefined/empty-string guards

## Usage

The script is automatically run in a Docker container as part of the compose setup:

```bash
npm start
```

## Environment Variables

| Variable           | Description                                                         | Required |
| ------------------ | ------------------------------------------------------------------- | -------- |
| `ZITADEL_URL`      | Base URL for the ZITADEL instance                                   | Yes      |
| `ZITADEL_APP_NAME` | Application name (used for naming projects, apps, and output files) | Yes      |

## File Outputs

All files are written under the `/zitadel-pat` bind-mounted directory:

| File Path                                            | Description                                         |
| ---------------------------------------------------- | --------------------------------------------------- |
| `/zitadel-pat/token`                                 | PAT for the initial machine user (input, read-only) |
| `/zitadel-pat/project-id`                            | Project ID                                          |
| `/zitadel-pat/client/<app-name>-client-id`           | OIDC client ID for the frontend app                 |
| `/zitadel-pat/integration-test/<app-name>-client-id` | OIDC client ID for integration tests                |
| `/zitadel-pat/integration-test/<app-name>-secret`    | OIDC client secret for integration tests            |
| `/zitadel-pat/integration-test/bot-token`            | PAT for the integration test impersonation bot      |
| `/zitadel-pat/integration-test/bot-key.json`         | JSON key for the integration test bot               |
| `/zitadel-pat/user-ids/admin`                        | User ID for admin test user                         |
| `/zitadel-pat/user-ids/writer`                       | User ID for writer test user                        |
| `/zitadel-pat/user-ids/user`                         | User ID for regular test user                       |

> `<app-name>` is the value of the `ZITADEL_APP_NAME` environment variable.

## Created Test Users

| Email           | Password   | Role   | Notes                         |
| --------------- | ---------- | ------ | ----------------------------- |
| admin@test.com  | Admin123!  | admin  | Also granted `IAM_OWNER` role |
| writer@test.com | Writer123! | writer |                               |
| user@test.com   | User123!   | user   |                               |

## Project Structure

```
src/
├── actions/
│   ├── has-role.mjs                                     # Helper: check if user already has a role
│   ├── post-self-registration-to-extend-user-claims.mjs # Builds the auto-role-assignment action script
│   └── print-keys-deep.mjs                              # Debug utility for inspecting action ctx/api
├── data/
│   ├── index.js                             # Barrel export for data modules
│   ├── roles.data.js                        # Project role definitions
│   └── users.data.js                        # Test user definitions
├── services/
│   ├── index.js                             # Barrel export for services
│   ├── config.service.js                    # Configuration and env var validation
│   ├── zitadel-admin-v1.service.js          # Admin V1 API endpoints
│   ├── zitadel-auth-v1.service.js           # Auth V1 API endpoints
│   ├── zitadel-management-v1.service.js     # Management V1 API endpoints
│   └── zitadel-users-v2.service.js          # Users V2 API endpoints
├── utils/
│   ├── index.js                             # Barrel export for utilities
│   ├── file.util.js                         # File operations (read PAT, write files)
│   ├── is-empty.util.js                     # isEmpty guard
│   ├── is-not-empty.util.js                 # isNotEmpty guard
│   ├── logger.util.js                       # Logging utility
│   └── sleep.util.js                        # Promise-based delay
└── main.js                                  # Main entry point
```

## User Self-Registration

The setup script enables **self-registration** so that new users can create their own accounts through the Zitadel Login UI (the "Register" link on the login page).

### How it works

1. **Login policy** — The script updates the organization's login policy to set `allowRegister: true`, which enables the "Register" link on the Zitadel Login UI.

2. **Automatic role assignment** — A Zitadel **Action** (server-side JavaScript) is created and bound to the **Complement Token → Pre Userinfo Creation** trigger. When a new user self-registers, this action automatically grants them the `user` project role via the Management API (if they don't already have it).

3. **Role hierarchy** — Self-registered users only receive the `user` role (lowest privilege). The `writer` and `admin` roles must be assigned manually by an admin (via the Zitadel Console or Management API).

### Flow types & trigger types (Actions v1)

| Flow Type | Name                     | Trigger Type | Name                       | Description                                           |
| --------- | ------------------------ | ------------ | -------------------------- | ----------------------------------------------------- |
| 1         | External Authentication  | 1            | Post Authentication        | Fires after external authentication                   |
| 1         | External Authentication  | 2            | Pre Creation               | Fires before user creation from external auth         |
| 1         | External Authentication  | 3            | Post Creation              | Fires after user creation from external auth          |
| 2         | Complement Token         | 4            | Pre Userinfo Creation      | Fires before userinfo is created (**used by script**) |
| 2         | Complement Token         | 5            | Pre Access Token Creation  | Fires before access token is created                  |
| 3         | Internal Authentication  | 1            | Post Authentication        | Fires after internal authentication                   |
| 3         | Internal Authentication  | 2            | Pre Creation               | Fires before user creation from internal auth         |
| 3         | Internal Authentication  | 3            | Post Creation              | Fires after user creation from internal auth          |
| 4         | Complement SAML Response | 6            | Pre SAML Response Creation | Fires before SAML response is created                 |

### Action: `postSelfRegistrationToExtendUserClaims`

The action script is built at setup time by `buildPostRegistrationActionScript()`, which inlines the `hasRole` helper and injects the project ID and bot PAT. The generated script uses `zitadel/http` to call the Management API and grant the `user` role to the user — but only if they don't already have it (the `hasRole` guard prevents duplicate grants). It is configured with `allowedToFail: false` so that registration **is blocked** if the role assignment fails.

> [!IMPORTANT]
>
> - The **function name** inside the action script **must match the action name** exactly (i.e. `postSelfRegistrationToExtendUserClaims`). If they don't match, Zitadel reports `"function not found"` and silently skips the action.
> - The action uses the **bot's PAT** (service account token) for authorization — not `ctx.v1.authToken` — because the newly registered user has no Management API permissions. The PAT is embedded in the script at setup time.
> - The action executes **inside Zitadel's own process**, so the HTTP call targets `http://traefik:80` (the Traefik reverse proxy inside the cluster), **not** the external host URL.

## Authentication Strategy

ZITADEL is configured by `infra/terraform/modules/zitadel` to create a machine user with a Personal Access Token (PAT) at first startup. The PAT is written to a volume (`/zitadel-pat/token`) that this container, run as the `zitadel_setup` Job, shares with ZITADEL.

The script:

1. Reads the PAT from the mounted file (with retries until ZITADEL is ready).
2. Uses the PAT to authenticate all API requests.
3. Creates a project, roles, and OIDC applications (public for frontend, confidential for integration tests).
4. Enables self-registration in the login policy.
5. Creates a Zitadel Action to auto-assign the `user` role on self-registration (with a `hasRole` guard to skip duplicates) and binds it to the Complement Token → Pre Userinfo Creation trigger.
6. Creates human test users and assigns them project roles.
7. Grants the admin user `IAM_OWNER` access for full ZITADEL Console access.
8. Enables impersonation in the security policy.
9. Creates a machine user (`integration-test-impersonator-bot`) with a JSON key and PAT for integration test token exchange.
10. Assigns `IAM_END_USER_IMPERSONATOR` role to both the initial bot user and the integration test bot.
11. Grants the integration test bot project access and verifies the grant.
