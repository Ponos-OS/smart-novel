output "otlp_http_endpoint" {
  description = "In-cluster OTLP/HTTP endpoint applications export traces to"
  value       = "http://${kubernetes_service_v1.collector.metadata[0].name}:4318"
}

output "otlp_grpc_endpoint" {
  description = "In-cluster OTLP/gRPC endpoint applications export traces to"
  value       = "http://${kubernetes_service_v1.collector.metadata[0].name}:4317"
}

output "routes" {
  description = "Routes for the ingress: the browser OTLP/HTTP exports, which stay same-origin so they need no CORS preflight, and the Jaeger UI"
  value = [
    {
      name     = "otel-collector-web"
      rule     = "PathPrefix(`/v1/traces`)"
      priority = 300
      service  = "http://${kubernetes_service_v1.collector.metadata[0].name}:4318"
    },
    {
      name     = "jaeger-web"
      rule     = "PathPrefix(`${var.jaeger_path}`)"
      priority = 300
      service  = "http://${kubernetes_service_v1.jaeger.metadata[0].name}:16686"
    },
  ]
}
