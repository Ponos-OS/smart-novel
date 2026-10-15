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
  value       = module.minio.endpoint
}

output "zitadel_credentials" {
  description = "Where ZITADEL's generated credentials live, available once the setup finished; null when the workloads are not deployed"
  value       = one(module.zitadel_setup[*].credentials)
}

output "otlp_http_endpoint" {
  description = "In-cluster OTLP/HTTP endpoint for traces; null when observability is disabled"
  value       = one(module.observability[*].otlp_http_endpoint)
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
