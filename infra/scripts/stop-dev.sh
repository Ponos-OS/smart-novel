#!/bin/sh
set -eu

env_dir="$(cd "$(dirname "$0")/../terraform/envs/local" && pwd)"

terraform -chdir="$env_dir" init
terraform -chdir="$env_dir" destroy -auto-approve
