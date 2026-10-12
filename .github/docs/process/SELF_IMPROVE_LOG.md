# Self-improvement log

## Replace Docker Compose with kind + Terraform

- Step 1 (2026-10-12): first `npm run start:dev` took ~19 minutes, almost all of it `npm ci` inside the first image builds, and overran the 10 minute foreground limit. Added a note to `PROCESS.md` step 6 to expect this and to poll with an `until pgrep` loop instead of `sleep`. Also recorded that infra steps are verified by really running `start:dev` twice and `stop:dev` twice (idempotence) plus `terraform test` per module.
- Step 2 (2026-10-12): a pinned third-party image tag I wrote from memory (`minio/mc`) did not exist and only failed at `kind load`, minutes into `start:dev`. Added a note to `PROCESS.md` to check new image tags with `docker manifest inspect` (or an image already on the host) before the first run.
- Step 3 (2026-10-12): the ZITADEL image is distroless (no `cat`), so reading the PAT out of the running pod failed silently with an empty value; use a throwaway busybox pod that mounts the claim instead. Also, ingress rules like `!PathPrefix(...)` cannot be written as plain Kubernetes Ingress, which is why Traefik uses its file provider here. No process change; both are specific to this feature.
