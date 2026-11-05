output "base_url" {
  description = "Base URL of the mock, without any path the mocked API prefixes its routes with"
  value       = "http://${kubernetes_service_v1.wiremock.metadata[0].name}:8080"
}
