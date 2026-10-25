output "enabled" {
  description = "Whether the workload is deployed"
  value       = var.enabled
}

output "routes" {
  description = "Ingress routes: the app itself, and its static assets. ZITADEL's /assets/v1 API is longer and wins where both are served"
  value = [
    { name = "frontend-web", path = "/", service_name = kubernetes_service_v1.frontend.metadata[0].name, service_port = var.port },
    { name = "frontend-assets", path = "/assets", service_name = kubernetes_service_v1.frontend.metadata[0].name, service_port = var.port },
  ]
}
