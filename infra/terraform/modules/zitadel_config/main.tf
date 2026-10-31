data "zitadel_orgs" "this" {
  count = var.create_org ? 0 : 1

  name        = var.org_name
  name_method = "TEXT_QUERY_METHOD_EQUALS"
  state       = "ORG_STATE_ACTIVE"
}

resource "zitadel_org" "this" {
  count = var.create_org ? 1 : 0

  name = var.org_name
}

locals {
  org_id = var.create_org ? zitadel_org.this[0].id : one(data.zitadel_orgs.this[0].ids)
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
  granted_usernames = toset(nonsensitive([
    for username in local.usernames : username if var.users[username].role != null
  ]))
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
  for_each = local.granted_usernames

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

# The organization's own policy: it applies to logins that name the organization in their scope, and overrides the instance default for them.
resource "zitadel_login_policy" "this" {
  count = var.create_org ? 1 : 0

  org_id                        = local.org_id
  allow_register                = var.allow_self_registration
  user_login                    = true
  allow_external_idp            = false
  force_mfa                     = false
  force_mfa_local_only          = false
  hide_password_reset           = false
  ignore_unknown_usernames      = false
  default_redirect_uri          = var.login_default_redirect_uri
  passwordless_type             = "PASSWORDLESS_TYPE_NOT_ALLOWED"
  second_factors                = ["SECOND_FACTOR_TYPE_OTP", "SECOND_FACTOR_TYPE_U2F"]
  multi_factors                 = ["MULTI_FACTOR_TYPE_U2F_WITH_VERIFICATION"]
  password_check_lifetime       = "864000s"
  external_login_check_lifetime = "864000s"
  mfa_init_skip_lifetime        = "2592000s"
  second_factor_check_lifetime  = "64800s"
  multi_factor_check_lifetime   = "43200s"
}

# Actions v1 triggers do not run behind Login V2, so the new user is announced to the backend, which grants the role.
resource "zitadel_action_target" "user_added" {
  count = var.self_registration_webhook_url == null ? 0 : local.self_registration

  name               = "userAddedToGrantRole"
  endpoint           = var.self_registration_webhook_url
  target_type        = "REST_WEBHOOK"
  timeout            = "5s"
  interrupt_on_error = false
}

resource "zitadel_action_execution_event" "user_added" {
  count = length(zitadel_action_target.user_added)

  event      = "user.human.added"
  target_ids = [zitadel_action_target.user_added[0].id]
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

locals {
  backend_access = var.backend_access == null ? 0 : 1
}

resource "zitadel_machine_user" "backend" {
  count = local.backend_access

  org_id      = local.org_id
  user_name   = "backend-user-grant-manager"
  name        = "Backend User Grant Manager"
  description = "Machine user the backend uses to grant project roles"
}

resource "zitadel_personal_access_token" "backend" {
  count = local.backend_access

  org_id          = local.org_id
  user_id         = zitadel_machine_user.backend[0].id
  expiration_date = var.backend_access.credential_expiration_date
}

resource "zitadel_org_member" "backend" {
  count = local.backend_access

  org_id  = local.org_id
  user_id = zitadel_machine_user.backend[0].id
  roles   = ["ORG_USER_PERMISSION_EDITOR"]
}

locals {
  # The light logo is the frontend's own file, so it cannot drift; the dark logo and the icons are derived from it
  # by scripts/make-login-assets.py, because the logo is a dark book that would vanish on a dark page.
  frontend_public = "${path.module}/../../../../apps/frontend/public"
  login_assets    = "${path.module}/files/login"
  logo            = "${local.frontend_public}/logo.png"
  logo_dark       = "${local.login_assets}/logo-dark.png"
  icon            = "${local.login_assets}/icon.png"
  icon_dark       = "${local.login_assets}/icon-dark.png"
}

# The login page in the frontend's look, light or dark by the visitor's system. Only for an organization of its own:
# uploading the logo needs a key (a JWT profile) and not a token, which the local environment does not use.
resource "zitadel_label_policy" "this" {
  count = var.create_org ? 1 : 0

  org_id = local.org_id

  theme_mode = "THEME_MODE_AUTO"
  set_active = true

  background_color      = var.branding.light.background_color
  background_color_dark = var.branding.dark.background_color
  font_color            = var.branding.light.font_color
  font_color_dark       = var.branding.dark.font_color
  primary_color         = var.branding.light.primary_color
  primary_color_dark    = var.branding.dark.primary_color
  warn_color            = var.branding.light.warn_color
  warn_color_dark       = var.branding.dark.warn_color

  logo_path      = local.logo
  logo_hash      = filemd5(local.logo)
  logo_dark_path = local.logo_dark
  logo_dark_hash = filemd5(local.logo_dark)
  icon_path      = local.icon
  icon_hash      = filemd5(local.icon)
  icon_dark_path = local.icon_dark
  icon_dark_hash = filemd5(local.icon_dark)

  disable_watermark      = true
  hide_login_name_suffix = false
}
