output "project_id" {
  description = "ID of the smart-novel project"
  value       = module.zitadel_config.project_id
}

output "client_id" {
  description = "Client ID of the public OIDC application"
  value       = module.zitadel_config.client_id
}

output "user_ids" {
  description = "IDs of the test users, by username"
  value       = module.zitadel_config.user_ids
}

output "integration_test" {
  description = "Client ID and secret of the confidential application, and the key and PAT of the impersonator bot"
  sensitive   = true
  value       = module.zitadel_config.integration_test
}

output "pat" {
  description = "Personal access token of ZITADEL's first-instance machine user, the one the provider authenticates with. The backend uses it to create sessions"
  sensitive   = true
  value       = trimspace(data.external.bot_pat.result.token)
}
