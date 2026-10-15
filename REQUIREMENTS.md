# Configure ZITADEL with Terraform

DO NOT COMMIT EACH STEP. PLEASE LET ME REVIEW IT FIRST.

Replace `local-setup/setup-zitadel` (JavaScript, run as the `zitadel_setup` Job) with the `zitadel/zitadel` Terraform provider. Background and provider coverage: `infra/docs/zitadel-terraform-provider.md`.

## Decisions

- Two stages, two root modules. `infra/terraform/envs/local` deploys the cluster and ZITADEL; a new root module `infra/terraform/envs/local-zitadel` configures ZITADEL with the provider. `infra/scripts/start-dev.sh` applies them in order. The configuration resources live in a reusable module `infra/terraform/modules/zitadel_config` so a production root module can call it with other inputs (public domain, a JWT profile key instead of the bot PAT, no test users).
- Consumers keep reading files under `/zitadel-pat` (backend, init Job, frontend, `backend-e2e`). Stage 2 delivers the generated values to the same paths, so none of them change. The e2e suites keep copying to `local-setup/{pats,client,user-ids}`.
- Terraform runs on the host and cannot write into the credentials volume. Stage 2 stores the values in a Secret and a Job copies them onto the volume.
- The backend, frontend and init Job need those files at startup, so they must deploy after stage 2. Stage 1 therefore skips them (generic input on `module "app"`), and a final apply of `envs/local` deploys them. Step 1 settles the exact shape.
- The provider is authenticated with the bot PAT that ZITADEL writes on first start (`/zitadel-pat/token`), read from the cluster. Production uses a JWT profile key.

## Steps

### Step 1: Stage split

Make `module "app"` deploy ZITADEL without the setup Job and, behind an input, without the workloads that need the credentials (backend, frontend, pre-deploy Jobs). `start-dev.sh` applies `envs/local` twice around a stage-2 placeholder. `stop-dev.sh` still removes everything.

AC:

- With the input off, `terraform apply` of `envs/local` ends with ZITADEL healthy through the ingress and no backend, frontend or Job running.
- With it on, the previous end state is reached (using the still-present JS Job at this step).
- `module "app"` mentions no environment concept.

Test: `terraform test` for `app`; run `npm run start:dev` and `npm run stop:dev` twice.

### Step 2: Provider wiring and project

Create `modules/zitadel_config` and `envs/local-zitadel` with the provider (domain `localhost`, port 8080, insecure, PAT read from the cluster), the project, roles and the public OIDC application (`smart-novel`).

AC:

- Apply creates the project, the `admin`, `writer` and `user` roles and the public application; a second apply changes nothing.
- The client ID is an output.

Test: `.tftest.hcl` with a mocked provider for the module; manual apply against the dev cluster, then check the console.

### Step 3: Users and grants

Human users from a `users` input (email, names, password, role), user grants, and the `IAM_OWNER` instance membership for the admin.

AC:

- `admin@test.com`, `writer@test.com`, `writer2@test.com` and `user@test.com` can log in at http://localhost:8080 with the passwords from `users.data.js`; the admin opens the ZITADEL console.
- The user IDs are outputs.
- An empty `users` input creates none (production).

Test: `.tftest.hcl`; log in manually with writer and admin.

### Step 4: Login policy and the self-registration action

`zitadel_default_login_policy` with `allow_register`, and the action that grants the `user` role to self-registered users, with its trigger. The script is a template that receives the project ID and a credential.

AC:

- Self-registering a new user in the login UI yields a user with the `user` role.
- The action fails registration when it fails (`allowed_to_fail = false`).

Test: manual self-registration; check the grant in the console. Check which credential the action embeds before choosing it (today: the bot PAT).

### Step 5: Impersonation and the integration-test bot

Security policy with impersonation, the confidential OIDC application, the `integration-test-impersonator-bot` machine user with its JSON key and PAT, `IAM_END_USER_IMPERSONATOR` for it and for the first-instance `bot`, and the bot's project access with no roles.

AC:

- Token exchange with the bot key impersonates a seeded user (the existing `backend-e2e` flow).
- The empty-role project grant works, otherwise a documented fallback is used (verify `zitadel_user_grant` with empty `role_keys` first).

Test: `.tftest.hcl`; `nx e2e backend-e2e`.

### Step 6: Deliver outputs

Stage 2 writes the Secret and the copy Job so `/zitadel-pat` holds `project-id`, `client/<app>-client-id`, `integration-test/*`, `user-ids/*`, then `envs/local` deploys the workloads. Existing paths and file contents stay the same.

AC:

- `npm run start:dev` ends with the app working end to end, login included.
- `nx e2e backend-e2e` and `nx e2e frontend-e2e` pass without edits to the suites.
- Both stages are idempotent on re-run.

Test: `nx e2e backend-e2e`, `nx e2e frontend-e2e`; `npm run start:dev` and `npm run stop:dev` twice.

### Step 7: Remove the JS setup

Delete `local-setup/setup-zitadel`, `modules/zitadel_setup`, the image build in `start-dev.sh`, the `setup_zitadel` image variables and their test fixtures.

AC:

- `grep -r setup-zitadel\|setup_zitadel` finds nothing outside the archive.
- Everything from Step 6 still passes.

### Step 8: Docs

Update `infra/README.md`, `.github/CONTRIBUTING.md`, `.github/README.md`, `.env.example` comments, and replace `infra/docs/zitadel-terraform-provider.md` with a short note on running stage 2 against a production ZITADEL (credential, reachability, no test users).

AC: the docs match the commands that work.
