output "org_id" {
  description = "ID of the organization; with create_org, the scope urn:zitadel:iam:org:id:<org_id> makes a login use its policy"
  value       = local.org_id
}

output "project_id" {
  description = "ID of the project"
  value       = zitadel_project.this.id
}

output "client_id" {
  description = "Client ID of the public OIDC application; not a secret, the browser sends it in every login"
  value       = nonsensitive(zitadel_application_oidc.public.client_id)
}

output "user_ids" {
  description = "IDs of the created users, by username"
  value       = { for username, user in zitadel_human_user.this : username => user.id }
}

output "integration_test" {
  description = "What the integration tests need to impersonate users; null when impersonation is not configured. The key is the JSON key file of the bot"
  sensitive   = true
  value = local.impersonation == 0 ? null : {
    client_id     = zitadel_application_oidc.integration_test[0].client_id
    client_secret = zitadel_application_oidc.integration_test[0].client_secret
    bot_key       = zitadel_machine_key.impersonator[0].key_details
    bot_token     = zitadel_personal_access_token.impersonator[0].token
  }
}

output "backend_pat" {
  description = "PAT of the backend's machine user; null when backend_access is not configured"
  sensitive   = true
  value       = local.backend_access == 0 ? null : zitadel_personal_access_token.backend[0].token
}

output "webhook_signing_key" {
  description = "Key ZITADEL signs its calls to self_registration_webhook_url with; null when there is no such target"
  sensitive   = true
  value       = one(zitadel_action_target.user_added[*].signing_key)
}
