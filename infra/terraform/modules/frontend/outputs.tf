output "enabled" {
  description = "Whether the workload is deployed"
  value       = var.enabled
}

output "routes" {
  description = "Routes for the ingress: the app itself, and its static assets, which must not swallow ZITADEL's /assets/v1 API"
  value = [
    {
      name     = "frontend-web"
      rule     = "PathPrefix(`/`)"
      priority = 50
      service  = "http://${kubernetes_service_v1.frontend.metadata[0].name}:${var.port}"
    },
    {
      name     = "frontend-assets"
      rule     = "PathPrefix(`/assets`) && !PathPrefix(`/assets/v1`)"
      priority = 200
      service  = "http://${kubernetes_service_v1.frontend.metadata[0].name}:${var.port}"
    },
  ]
}
