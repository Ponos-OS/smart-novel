#!/bin/sh
set -eu

env_dir="$(cd "$(dirname "$0")/../terraform/envs/local" && pwd)"
zitadel_env_dir="$(cd "$(dirname "$0")/../terraform/envs/local-zitadel" && pwd)"
cluster_name="smart-novel"

# Destroying the cluster destroys what stage 2 configured in it, so only its state is left to forget.
forget_zitadel_state() {
  rm -f "$zitadel_env_dir"/terraform.tfstate "$zitadel_env_dir"/terraform.tfstate.backup
}

terraform -chdir="$env_dir" init
terraform -chdir="$env_dir" destroy -auto-approve && forget_zitadel_state && exit 0

# The environment is throwaway. When Terraform can no longer reach the cluster, for example after its definition changed in a way that replaces it, delete the cluster directly and forget the state.
echo "terraform destroy failed, deleting the kind cluster directly." >&2
kind delete cluster --name "$cluster_name"
forget_zitadel_state
rm -f "$env_dir"/terraform.tfstate "$env_dir"/terraform.tfstate.backup "$env_dir/$cluster_name-config"
