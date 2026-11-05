output "url" {
  description = "Where the app is served"
  value       = "https://${var.domain}"
}

output "namespace" {
  description = "Namespace everything is deployed into"
  value       = module.app.namespace
}

output "zitadel_project_id" {
  description = "ID of the smart-novel project on the shared ZITADEL"
  value       = module.zitadel_config.project_id
}

output "zitadel_client_id" {
  description = "Client ID of the public OIDC application"
  value       = module.zitadel_config.client_id
}
