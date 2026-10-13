output "database_url" {
  description = "Connection URL of the application database: the external one when given, otherwise the in-cluster service"
  value       = local.deploy ? "postgresql://${var.username}:${var.password}@postgres:5432/${var.database}" : var.database_url
  sensitive   = true
}

output "connection" {
  description = "Where the in-cluster PostgreSQL is reachable, without credentials; null when an external database is used"
  value       = nonsensitive(local.deploy) ? { host = "postgres", port = 5432, database = var.database, username = var.username } : null
}
