# Self-improvement log

## Zitadel Terraform, Step 1 (2026-10-15)

- Gating a module with `count` made `module.x[*].routes` depend on the module's "close" node and closed a cycle with the ingress (ingress -> setup -> workloads -> ingress routes). Gating the workload resources inside the module (an `enabled` input) and leaving the Service in place kept the outputs static. Ordering after the setup goes through a value (`wait_for`), not `depends_on`.
- `terraform test` surfaces such cycles in seconds; run it after every structural change instead of reasoning about the graph.
- REQUIREMENTS.md said not to commit each step, so the commit step was skipped and the work left in the tree for review. `npm run start:dev` / `stop:dev` twice is left to the user.
