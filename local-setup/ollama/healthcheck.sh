#!/bin/sh
set -eu

HOST="${OLLAMA_HOST:-127.0.0.1}"
PORT="${OLLAMA_PORT:-11434}"
MODEL="${BEATRICE_LLM_MODEL:-llama3.2:1b}"

# 1) API must be up (no 404/connection error)
if ! curl -fsS "http://${HOST}:${PORT}/api/version" >/dev/null; then
  exit 1
fi

# 2) Model must be registered locally
if ! curl -fsS "http://${HOST}:${PORT}/api/tags" | grep -q "\"name\":\"${MODEL}\""; then
  exit 1
fi

# 3) The /api/generate endpoint must be usable (not 404).
#    We do a minimal, non-streaming call for readiness without heavy compute.
CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -X POST "http://${HOST}:${PORT}/api/generate" \
  -d "{\"model\":\"${MODEL}\",\"prompt\":\"ping\",\"stream\":false,\"options\":{\"num_predict\":1}}")"

# Healthy only if we get 200
[ "$CODE" -eq 200 ]