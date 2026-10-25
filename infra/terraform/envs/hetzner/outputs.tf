output "url" {
  description = "Where the app is served"
  value       = "https://${var.domain}"
}

output "namespace" {
  description = "Namespace everything is deployed into"
  value       = module.app.namespace
}
