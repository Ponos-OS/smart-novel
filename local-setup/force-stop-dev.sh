#!/usr/bin/env bash
# Stops the local stack when `npm run stop:dev` cannot: kills what holds the Terraform
# state lock, deletes the kind cluster directly and forgets the throwaway state.
# Run it from anywhere: `bash local-setup/force-stop-dev.sh`

set -u

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_dir="$root/infra/terraform/envs/local"
zitadel_env_dir="$root/infra/terraform/envs/local-zitadel"
cluster_name="smart-novel"

echo "Stopping the scripts and Terraform processes of the stack..."
pkill -f "infra/scripts/start-dev.sh" 2>/dev/null
pkill -f "infra/scripts/stop-dev.sh" 2>/dev/null
pkill -f "terraform -chdir=$env_dir" 2>/dev/null
pkill -f "terraform -chdir=$zitadel_env_dir" 2>/dev/null
pkill -f "terraform-provider-" 2>/dev/null
sleep 2

echo "Deleting the kind cluster..."
kind delete cluster --name "$cluster_name"

echo "Forgetting the Terraform state, locks and kubeconfig..."
rm -f "$env_dir"/terraform.tfstate "$env_dir"/terraform.tfstate.backup \
  "$env_dir"/.terraform.tfstate.lock.info "$env_dir/$cluster_name-config"
rm -f "$zitadel_env_dir"/terraform.tfstate "$zitadel_env_dir"/terraform.tfstate.backup \
  "$zitadel_env_dir"/.terraform.tfstate.lock.info

if pgrep -af "terraform" >/dev/null; then
  echo "Warning: a terraform process is still running:" >&2
  pgrep -af "terraform" >&2
fi

echo "Clusters left: $(kind get clusters 2>&1 | tr '\n' ' ')"
echo "Done. Start again with: npm run start:dev"
