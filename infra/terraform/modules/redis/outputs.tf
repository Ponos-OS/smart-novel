output "redis_url" {
  description = "Connection URL of Redis: the external one when given, otherwise the in-cluster service"
  value       = local.deploy ? "redis://${local.has_password ? ":${var.password}@" : ""}redis:6379" : var.redis_url
  sensitive   = true
}

output "connection" {
  description = "Where the in-cluster Redis is reachable; null when an external Redis is used"
  value       = nonsensitive(local.deploy) ? { host = "redis", port = 6379 } : null
}
