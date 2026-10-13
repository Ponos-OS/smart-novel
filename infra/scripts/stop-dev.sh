#!/bin/sh
set -eu

env_dir="$(cd "$(dirname "$0")/../terraform/envs/local" && pwd)"
cluster_name="smart-novel"

terraform -chdir="$env_dir" init
terraform -chdir="$env_dir" destroy -auto-approve && exit 0

# The environment is throwaway. When Terraform can no longer reach the cluster, for example after its definition changed in a way that replaces it, delete the cluster directly and forget the state.
echo "terraform destroy failed, deleting the kind cluster directly." >&2
kind delete cluster --name "$cluster_name"
rm -f "$env_dir"/terraform.tfstate "$env_dir"/terraform.tfstate.backup "$env_dir/$cluster_name-config"
