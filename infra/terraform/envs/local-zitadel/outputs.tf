output "project_id" {
  description = "ID of the smart-novel project"
  value       = module.zitadel_config.project_id
}

output "client_id" {
  description = "Client ID of the public OIDC application"
  value       = module.zitadel_config.client_id
}
