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

locals {
  self_registration = var.allow_self_registration ? 1 : 0
}

resource "zitadel_default_login_policy" "this" {
  count = var.manage_instance_settings ? local.self_registration : 0

  allow_register                = true
  user_login                    = true
  allow_external_idp            = false
  force_mfa                     = false
  force_mfa_local_only          = false
  hide_password_reset           = false
  ignore_unknown_usernames      = false
  default_redirect_uri          = var.login_default_redirect_uri
  passwordless_type             = "PASSWORDLESS_TYPE_NOT_ALLOWED"
  password_check_lifetime       = "864000s"
  external_login_check_lifetime = "864000s"
  mfa_init_skip_lifetime        = "2592000s"
  second_factor_check_lifetime  = "64800s"
  multi_factor_check_lifetime   = "43200s"
}

resource "zitadel_action" "post_self_registration" {
  count = local.self_registration

  org_id = local.org_id
  name   = "postSelfRegistrationToExtendUserClaims"
  script = templatefile("${path.module}/files/post-self-registration.js.tftpl", {
    project_id = zitadel_project.this.id
    role_key   = var.self_registration_role_key
  })
  timeout         = "5s"
  allowed_to_fail = false

  depends_on = [zitadel_project_role.this]
}

resource "zitadel_trigger_actions" "post_self_registration" {
  count = local.self_registration

  org_id       = local.org_id
  flow_type    = "FLOW_TYPE_INTERNAL_AUTHENTICATION"
  trigger_type = "TRIGGER_TYPE_POST_CREATION"
  action_ids   = [zitadel_action.post_self_registration[0].id]
}

locals {
  impersonation = var.impersonation == null ? 0 : 1
}

resource "zitadel_default_security_settings" "this" {
  count = var.manage_instance_settings ? local.impersonation : 0

  enable_impersonation = true
}

resource "zitadel_application_oidc" "integration_test" {
  count = local.impersonation

  org_id     = local.org_id
  project_id = zitadel_project.this.id
  name       = "${var.application_name}-integration-test"

  redirect_uris    = var.impersonation.redirect_uris
  response_types   = ["OIDC_RESPONSE_TYPE_CODE"]
  grant_types      = ["OIDC_GRANT_TYPE_REFRESH_TOKEN", "OIDC_GRANT_TYPE_TOKEN_EXCHANGE", "OIDC_GRANT_TYPE_AUTHORIZATION_CODE"]
  app_type         = "OIDC_APP_TYPE_WEB"
  auth_method_type = "OIDC_AUTH_METHOD_TYPE_BASIC"
  version          = "OIDC_VERSION_1_0"

  access_token_type           = "OIDC_TOKEN_TYPE_JWT"
  access_token_role_assertion = true
  id_token_role_assertion     = true
  dev_mode                    = var.dev_mode
}

resource "zitadel_machine_user" "impersonator" {
  count = local.impersonation

  org_id      = local.org_id
  user_name   = "integration-test-impersonator-bot"
  name        = "Integration Test Impersonation Bot"
  description = "Machine user for integration test token exchange"
}

resource "zitadel_machine_key" "impersonator" {
  count = local.impersonation

  org_id          = local.org_id
  user_id         = zitadel_machine_user.impersonator[0].id
  key_type        = "KEY_TYPE_JSON"
  expiration_date = var.impersonation.credential_expiration_date
}

resource "zitadel_personal_access_token" "impersonator" {
  count = local.impersonation

  org_id          = local.org_id
  user_id         = zitadel_machine_user.impersonator[0].id
  expiration_date = var.impersonation.credential_expiration_date
}

resource "zitadel_instance_member" "impersonator" {
  count = local.impersonation

  user_id = zitadel_machine_user.impersonator[0].id
  roles   = ["IAM_END_USER_IMPERSONATOR"]
}

# The impersonator must be able to reach the project but must not hold any of its roles, or the impersonated user's roles would mix with the bot's.
resource "zitadel_user_grant" "impersonator" {
  count = local.impersonation

  org_id     = local.org_id
  project_id = zitadel_project.this.id
  user_id    = zitadel_machine_user.impersonator[0].id
  role_keys  = []
}
