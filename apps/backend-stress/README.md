# Backend stress

A [k6](https://k6.io) load test of the GraphQL operations the UI sends. The operations are cut out of the frontend `.graphql` documents, so a UI change that breaks one fails `setup()` with `operation <Name> rejected: ...`, before any load starts.

## Run it locally

```bash
task backend:test:stress
```

The task starts the e2e stack (`start-dev.sh e2e`, so no other stack may be running), seeds it from `.env` and tears it down when k6 ends. Set `DEVDATA_NOVELS_COUNT` and `DEVDATA_CHAPTERS_COUNT_PER_NOVEL` in `.env` for a bigger bulk of data (the nightly run uses 100 novels of 10 chapters).

k6 runs from the `grafana/k6` image, so extra k6 flags go after `--`: `task backend:test:stress -- --duration 30s`. The nightly run is `.github/workflows/stress.yml`; start it by hand from the Actions tab.

## Scenarios

- `browse`: up to 10 virtual users read the home list, search by tag, open a novel and a chapter, as the seeded writer or the plain user (who also marks the chapter read).
- `write`: 2 iterations a second, each creates a novel and a chapter, updates them and deletes both, so the run leaves the data as it was.

## Read the summary

Every line under `THRESHOLDS` is one rule: a green check passed, a red cross failed the run. `graphql_failures` is the share of operations answered with an `errors` array (the HTTP status of those is 200). `http_req_duration{scenario:...}` is the response time; read `p(95)` as "95 percent of the requests were faster than this".

## Change a threshold

Edit `thresholds` in `src/main.ts`. The values are about 2.5 times the worst of three local runs against 100 novels of 10 chapters (browse p95 612 ms, p99 793 ms; write p95 409 ms, p99 544 ms), because a GitHub runner is slower than a developer machine. Lower one only after reading the summaries of several nightly runs.
