output "routes" {
  description = "Routes for the ingress: the GraphQL API and the callbacks Beatrice calls when audio is ready"
  value = [
    {
      name     = "backend-web"
      rule     = "PathPrefix(`/graphql`)"
      priority = 300
      service  = "http://${kubernetes_service_v1.backend.metadata[0].name}:${var.port}"
    },
    {
      name     = "backend-beatrice-callbacks"
      rule     = "PathPrefix(`/beatrice-callbacks`)"
      priority = 300
      service  = "http://${kubernetes_service_v1.backend.metadata[0].name}:${var.port}"
    },
  ]
}

output "internal_url" {
  description = "URL of the backend inside the cluster"
  value       = "http://${kubernetes_service_v1.backend.metadata[0].name}:${var.port}"
}
