output "redis_url" {
  description = "Connection URL of Redis: the external one when given, otherwise the in-cluster service"
  value       = local.deploy ? "redis://${local.has_password ? ":${var.password}@" : ""}redis:6379" : var.redis_url
  sensitive   = true
}
