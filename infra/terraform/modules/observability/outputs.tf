output "otlp_http_endpoint" {
  description = "In-cluster OTLP/HTTP endpoint applications export traces to"
  value       = "http://${kubernetes_service_v1.stack["otel-collector"].metadata[0].name}:4318"
}

output "otlp_grpc_endpoint" {
  description = "In-cluster OTLP/gRPC endpoint applications export traces to"
  value       = "http://${kubernetes_service_v1.stack["otel-collector"].metadata[0].name}:4317"
}

output "routes" {
  description = "Routes for the ingress: the browser OTLP/HTTP exports, which stay same-origin so they need no CORS preflight, and Grafana on its own host"
  value = [
    {
      name     = "otel-collector-web"
      rule     = "PathPrefix(`/v1/traces`)"
      priority = 300
      service  = "http://${kubernetes_service_v1.stack["otel-collector"].metadata[0].name}:4318"
    },
    {
      name     = "grafana-web"
      rule     = "Host(`${var.grafana_host}`)"
      priority = 300
      service  = "http://${kubernetes_service_v1.grafana.metadata[0].name}:3000"
    },
  ]
}
