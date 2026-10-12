output "kubeconfig_path" {
  description = "Kubeconfig of the kind cluster, for kubectl --kubeconfig"
  value       = kind_cluster.this.kubeconfig_path
}

output "namespace" {
  description = "Namespace everything is deployed into"
  value       = module.app.namespace
}
