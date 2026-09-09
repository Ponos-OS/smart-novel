## Developing Features Process

`REQUIREMENTS.md` is split into independently-committable steps. Work ONE step per pass through this loop.

1. Check `git log` / the current code to find the next unimplemented step in `REQUIREMENTS.md`. Do not redo a step that's already merged, and do not start a later step early just because it's convenient.
2. Build only that step's scope.
3. Add tests at the tier `.github/CONTRIBUTING.md` calls for (unit for pure logic, integration for a new/changed GraphQL operation or worker path, evals for prompt changes). Each step's "Test" subsection in `REQUIREMENTS.md` says which tiers apply and whether graphql-api-tester is relevant.
4. If the step exposes or changes a GraphQL query/mutation, invoke the graphql-api-tester subagent with: the operation name(s), their file path, and the step's AC. Skip this for steps with no GraphQL surface (worker-only or logging-only steps) — invoking it with nothing new to test wastes the call. Needs a running dev server (`docker compose up --build -d`, tear down after) unless one is already up. After launching it, don't spawn another agent just to "wait" — the completion notification arrives on its own; stop and let the turn end.
5. Incorporate whatever graphql-api-tester or the test suite surfaces.
6. Run `nx e2e backend-e2e` for backend changes, and for frontend changes run `nx e2e frontend-e2e`.
   - When a step's `### Test` says to verify manually, budget for that verification surfacing environment/dependency facts no code review would catch (a library's model/checkpoint capabilities, realistic CPU timing under load) — actually run it rather than treating the AC as sufficient on paper. When it does surface something, fix it and update `REQUIREMENTS.md`'s AC for that step to match reality (surfaced by the `instruct` feature's step 4 — the shim's model checkpoint didn't support the target method, and the default timeout was too low for real CPU inference).
   - For an infra-only step whose `### Test` is just "boots and reports healthy," a passing `service_healthy` isn't proof the specific thing you changed works — a healthcheck can be unrelated to the new config. Grep the service's own logs for a positive confirmation line tied to the change (surfaced by Step 1a: `docker inspect --format='{{.State.Health.Status}}'` said healthy, but only `docker logs` showing `"worker ready"` actually confirmed Beatrice connected to the newly-added RabbitMQ rather than just passing its own unrelated HTTP healthcheck).
7. Commit the step on its own, with a message naming the `REQUIREMENTS.md` step number. Before committing, confirm `.husky/_/*` hooks are executable (`ls -la .husky/_/pre-commit`) — if git silently reports "hook was ignored because it's not set as executable", `chmod +x .husky/_/*` and re-verify before trusting the commit ran lint-staged (surfaced by Step 1a; `.husky/_/` is gitignored/generated, so this can recur in a fresh environment).
8. IMPORTANT: follow the instructions in `SELF_IMPROVE.md` to improve yourself.

You MUST complete step 8 (self-improvement) before you stop.
