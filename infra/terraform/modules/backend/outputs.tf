output "enabled" {
  description = "Whether the workload is deployed"
  value       = var.enabled
}

output "routes" {
  description = "Ingress routes: the GraphQL API and the callbacks Beatrice calls when audio is ready"
  value = [
    { name = "backend-web", path = "/graphql", service_name = kubernetes_service_v1.backend.metadata[0].name, service_port = var.port },
    { name = "backend-beatrice-callbacks", path = "/beatrice-callbacks", service_name = kubernetes_service_v1.backend.metadata[0].name, service_port = var.port },
  ]
}

output "internal_url" {
  description = "URL of the backend inside the cluster"
  value       = "http://${kubernetes_service_v1.backend.metadata[0].name}:${var.port}"
}
