output "internal_url" {
  description = "URL of the ingress inside the cluster; requests through it carry the same routing as requests from the host"
  value       = "http://${kubernetes_service_v1.traefik.metadata[0].name}:80"
}
