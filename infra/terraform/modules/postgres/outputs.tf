output "database_url" {
  description = "Connection URL of the application database: the external one when given, otherwise the in-cluster service"
  value       = local.deploy ? "postgresql://${var.username}:${var.password}@postgres:5432/${var.database}" : var.database_url
  sensitive   = true
}
