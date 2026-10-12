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
