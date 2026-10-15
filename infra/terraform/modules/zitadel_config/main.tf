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
