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
