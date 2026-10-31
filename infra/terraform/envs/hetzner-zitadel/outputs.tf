output "project_id" {
  description = "ID of the smart-novel project"
  value       = module.zitadel_config.project_id
}

output "client_id" {
  description = "Client ID of the public OIDC application; the zitadel_client_id input of envs/hetzner"
  value       = module.zitadel_config.client_id
}

output "org_id" {
  description = "ID of smart-novel's organization; the zitadel_org_id input of envs/hetzner"
  value       = module.zitadel_config.org_id
}

output "backend_pat" {
  description = "PAT of the backend's machine user, which may only manage user grants; the zitadel_management_pat input of envs/hetzner"
  sensitive   = true
  value       = module.zitadel_config.backend_pat
}

output "webhook_signing_key" {
  description = "Key ZITADEL signs its calls to the backend with; the zitadel_webhook_signing_key input of envs/hetzner"
  sensitive   = true
  value       = module.zitadel_config.webhook_signing_key
}
