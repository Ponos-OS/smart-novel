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
