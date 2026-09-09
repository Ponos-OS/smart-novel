# Self-improvement log

## Step 1a — 2026-09-09

- Change: `PROCESS.md` step 7 now says to verify `.husky/_/*` hooks are executable before trusting a commit ran lint-staged. `.husky/_/` is gitignored/generated and wasn't executable in this environment, so `git commit` silently skipped `pre-commit`/`prepare-commit-msg`/`commit-msg`/`post-commit` (git only printed an informational hint, didn't fail). Fixed with `chmod +x .husky/_/*`.
- Change: `PROCESS.md` step 6 now says to grep the service's own logs for a positive confirmation line, not just trust `service_healthy`, for infra-only steps. Beatrice's healthcheck passing didn't by itself prove it connected to the newly-added RabbitMQ; only the `"worker ready"` log line did.
- No AC/scope surprises for this step — compose bump + RabbitMQ service was exactly as scoped, no code changes needed, matching the AC's "infra/compose only" note.
