# Self-improvement log

## Zitadel Terraform, Step 1 (2026-10-15)

- Gating a module with `count` made `module.x[*].routes` depend on the module's "close" node and closed a cycle with the ingress (ingress -> setup -> workloads -> ingress routes). Gating the workload resources inside the module (an `enabled` input) and leaving the Service in place kept the outputs static. Ordering after the setup goes through a value (`wait_for`), not `depends_on`.
- `terraform test` surfaces such cycles in seconds; run it after every structural change instead of reasoning about the graph.
- REQUIREMENTS.md said not to commit each step, so the commit step was skipped and the work left in the tree for review. `npm run start:dev` / `stop:dev` twice is left to the user.

## Zitadel Terraform, Step 2 (2026-10-15)

- The installed provider (2.12.x) requires `org_id` on every resource; the docs Context7 returned mixed v1 and v2 resources. Check the schema with `terraform validate`/`terraform test` on a mocked provider before trusting a docs snippet.
- The PAT lives on a volume the host cannot read, so stage 2 reads it with `kubectl exec` into the login pod (the only ZITADEL pod with a shell that mounts the claim). Not verified against a live cluster in this pass; left for the user's manual apply.
- `stop-dev.sh` must forget stage 2's state, since destroying the cluster destroys what it configured.
