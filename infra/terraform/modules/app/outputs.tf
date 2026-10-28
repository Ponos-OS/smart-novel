output "namespace" {
  description = "Namespace everything is deployed into"
  value       = module.namespace.name
}

output "database_url" {
  description = "Connection URL of the application database"
  value       = module.postgres.database_url
  sensitive   = true
}

output "redis_url" {
  description = "Connection URL of Redis"
  value       = module.redis.redis_url
  sensitive   = true
}

output "object_storage_endpoint" {
  description = "Endpoint of the S3 API"
  value       = module.object_storage.endpoint
}

output "otlp_http_endpoint" {
  description = "OTLP/HTTP endpoint the workloads export to; null when tracing is off"
  value       = var.otlp_endpoint
}

output "broker_url" {
  description = "AMQP URL of the message broker; null when Beatrice is not deployed"
  value       = one(module.rabbitmq[*].broker_url)
  sensitive   = true
}

output "beatrice_url" {
  description = "In-cluster GraphQL URL of Beatrice; null when it is not deployed"
  value       = one(module.beatrice[*].graphql_url)
}

output "workloads_enabled" {
  description = "Whether the backend and the frontend are deployed"
  value       = module.backend.enabled && module.frontend.enabled
}

output "grafana_configmaps" {
  description = "Names of the ConfigMaps published for the shared Grafana; empty unless publish_grafana_configmaps is set"
  value = concat(
    [for map in kubernetes_config_map_v1.shared_dashboard : map.metadata[0].name],
    kubernetes_config_map_v1.shared_alert_rules[*].metadata[0].name,
  )
}

output "tool_routes" {
  description = "Routes for the ingress to the in-cluster tools (S3 API and console, RabbitMQ management and the devtools), each on its own host"
  value = concat(
    module.object_storage.routes,
    flatten(module.rabbitmq[*].routes),
    flatten(module.devtools[*].routes),
  )
}
