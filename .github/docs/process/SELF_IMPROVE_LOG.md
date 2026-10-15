# Self-improvement log

## Zitadel Terraform, Step 1 (2026-10-15)

- Gating a module with `count` made `module.x[*].routes` depend on the module's "close" node and closed a cycle with the ingress (ingress -> setup -> workloads -> ingress routes). Gating the workload resources inside the module (an `enabled` input) and leaving the Service in place kept the outputs static. Ordering after the setup goes through a value (`wait_for`), not `depends_on`.
- `terraform test` surfaces such cycles in seconds; run it after every structural change instead of reasoning about the graph.
- REQUIREMENTS.md said not to commit each step, so the commit step was skipped and the work left in the tree for review. `npm run start:dev` / `stop:dev` twice is left to the user.

## Zitadel Terraform, Step 2 (2026-10-15)

- The installed provider (2.12.x) requires `org_id` on every resource; the docs Context7 returned mixed v1 and v2 resources. Check the schema with `terraform validate`/`terraform test` on a mocked provider before trusting a docs snippet.
- The PAT lives on a volume the host cannot read, so stage 2 reads it with `kubectl exec` into the login pod (the only ZITADEL pod with a shell that mounts the claim). Not verified against a live cluster in this pass; left for the user's manual apply.
- `stop-dev.sh` must forget stage 2's state, since destroying the cluster destroys what it configured.

## Zitadel Terraform, Step 3 (2026-10-15)

- A sensitive `users` map cannot feed `for_each` directly, nor can anything derived from it; the keys (usernames) are not secret, so `nonsensitive(keys(...))` and `nonsensitive([...])` around the derived set fixed it. `terraform test` caught both in seconds.
- Usernames are the email's local part, as in the JS script, so the JS Job that still runs at stage 3 finds the existing users instead of creating duplicates.

## Zitadel Terraform, Step 4 (2026-10-15)

- The requirement asked which credential the action embeds. A first draft created a machine user with `ORG_USER_PERMISSION_EDITOR` and a PAT for it; the automated security review flagged a long-lived token inside the action script. ZITADEL's action runtime has `api.userGrants.push({projectID, roles})` (the docs' "Assign roles to users" example, internal authentication, post creation), so the action needs no credential at all and the machine user, org membership and PAT were removed. Lesson: when a requirement says "check which credential", first check whether the platform offers a call that needs none.
- The JS action called the Management API and only logged a failed grant, so `allowed_to_fail = false` never blocked anything. With `userGrants.push` a failing grant now fails the registration, as the AC asks. Not exercised against a live ZITADEL in this pass.
- The JS Job still running in stage 3 overwrites the trigger with its own action until Step 7.

## Zitadel Terraform, Step 5 (2026-10-15)

- Impersonation is `zitadel_default_security_settings`; the bot's key is `zitadel_machine_key` (JSON), its PAT `zitadel_personal_access_token`; the first-instance `bot` is found with the `zitadel_machine_users` data source. All sit behind one nullable `impersonation` input, so production gets none of it.
- A mocked data source returns empty lists by default; a `mock_data` default is needed whenever a resource consumes `one(...)` of it.
- The empty-role `zitadel_user_grant` (`role_keys = []`) is written but unverified; the AC allows a documented fallback if ZITADEL rejects it. To be checked with `nx e2e backend-e2e`.
- Step 5 follow-up: `users[*].password` is optional (impersonation targets need no login) and `impersonation.credential_expiration_date` is configurable, defaulting to 9999-12-31. No QA environment exists yet; only the module accepts the inputs.

## Zitadel Terraform, Step 6 (2026-10-15)

- First attempt: a Secret plus a writer Job (`zitadel_credentials_delivery`) to put files on the `/zitadel-pat` volume. The user questioned it on modularity grounds (a shared ReadWriteOnce claim assumes one node; a hash of secrets in the Job name), then redirected: no files, nothing on the host, pass the values to the containers as Kubernetes env settings. The module was deleted.
- Final shape: stage 2 outputs (`client_id`, `pat`, `user_ids`, `integration_test`); `envs/local` reads them with `terraform_remote_state` (count 0 while `wait_for_zitadel_credentials` is true, since stage 2's state does not exist yet; `stop-dev.sh` destroys with it true for the same reason) and passes them as `ZITADEL_CLIENT_ID`, `ZITADEL_PAT` (Secret), `VITE_OIDC_CLIENT_ID`, `ZITADEL_WRITER_USER_ID`. The backend already preferred those over its `*_FILE` settings, so only the seeder and the frontend start scripts changed. `backend-e2e` reads `terraform output -json` and `ClusterFixture.extractFile` was deleted.
- Lesson: I had read the consumers as needing files because the existing wiring was files. Reading `auth-module.config.ts` first (env before file) would have shown the volume was never required. Before building a delivery mechanism for an existing contract, check whether the consumer already accepts a simpler one.
- Not run against a cluster in this pass: `start:dev`/`stop:dev` twice, `nx e2e backend-e2e`, `nx e2e frontend-e2e`.

## Zitadel Terraform, Step 7 (2026-10-15)

- Pure deletion: `local-setup/setup-zitadel`, `modules/zitadel_setup`, the image build, the image load and the `setup_zitadel` image variable. Step 6 had already removed the module call, so nothing referenced the module any more.
- The AC grep still matches `REQUIREMENTS.md` (archived later) and `infra/docs/zitadel-terraform-provider.md`, which Step 8 replaces. The two README references and the test-user comment in `auth.commands.ts` were repointed to `envs/local-zitadel` now, since they were links, not prose to rewrite.
- The README paragraphs that still describe the credentials volume and the setup Job are wrong now; they are Step 8's.
