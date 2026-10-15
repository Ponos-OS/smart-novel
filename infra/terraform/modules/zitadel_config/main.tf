data "zitadel_orgs" "this" {
  name        = var.org_name
  name_method = "TEXT_QUERY_METHOD_EQUALS"
  state       = "ORG_STATE_ACTIVE"
}

locals {
  org_id = one(data.zitadel_orgs.this.ids)
}

resource "zitadel_project" "this" {
  org_id                 = local.org_id
  name                   = var.project_name
  project_role_assertion = true
}

resource "zitadel_project_role" "this" {
  for_each = { for role in var.roles : role.key => role }

  org_id       = local.org_id
  project_id   = zitadel_project.this.id
  role_key     = each.value.key
  display_name = each.value.display_name
  group        = var.application_name
}

resource "zitadel_application_oidc" "public" {
  org_id     = local.org_id
  project_id = zitadel_project.this.id
  name       = var.application_name

  redirect_uris             = var.redirect_uris
  post_logout_redirect_uris = var.post_logout_redirect_uris
  response_types            = ["OIDC_RESPONSE_TYPE_CODE"]
  grant_types               = ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE", "OIDC_GRANT_TYPE_TOKEN_EXCHANGE"]
  app_type                  = "OIDC_APP_TYPE_NATIVE"
  auth_method_type          = "OIDC_AUTH_METHOD_TYPE_NONE"
  access_token_type         = "OIDC_TOKEN_TYPE_JWT"

  access_token_role_assertion = true
  id_token_role_assertion     = true
  dev_mode                    = var.dev_mode
}

locals {
  usernames = toset(nonsensitive(keys(var.users)))
  instance_members = toset(nonsensitive([
    for username in local.usernames : username if length(var.users[username].instance_roles) > 0
  ]))
}

resource "zitadel_human_user" "this" {
  for_each = local.usernames

  org_id                       = local.org_id
  user_name                    = each.key
  first_name                   = var.users[each.key].first_name
  last_name                    = var.users[each.key].last_name
  email                        = var.users[each.key].email
  is_email_verified            = true
  initial_password             = var.users[each.key].password
  initial_skip_password_change = true
}

resource "zitadel_user_grant" "this" {
  for_each = local.usernames

  org_id     = local.org_id
  project_id = zitadel_project.this.id
  user_id    = zitadel_human_user.this[each.key].id
  role_keys  = [var.users[each.key].role]

  depends_on = [zitadel_project_role.this]
}

resource "zitadel_instance_member" "this" {
  for_each = local.instance_members

  user_id = zitadel_human_user.this[each.key].id
  roles   = var.users[each.key].instance_roles
}
