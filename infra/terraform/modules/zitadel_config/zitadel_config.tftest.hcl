mock_provider "zitadel" {
  mock_data "zitadel_machine_users" {
    defaults = {
      user_ids = ["2f66a1b4-0c2d-4e4a-9572"]
    }
  }

  mock_data "zitadel_orgs" {
    defaults = {
      ids = ["93fec4bf-2f66-4e4a-9572"]
    }
  }
}

variables {
  redirect_uris             = ["http://localhost:8080/auth/callback"]
  post_logout_redirect_uris = ["http://localhost:8080"]
}

run "creates_the_three_roles_of_the_application" {
  command = plan

  assert {
    condition     = toset(keys(zitadel_project_role.this)) == toset(["admin", "writer", "user"])
    error_message = "the admin, writer and user roles must exist"
  }
}

run "the_public_application_uses_the_code_flow_without_a_secret" {
  command = plan

  assert {
    condition     = zitadel_application_oidc.public.auth_method_type == "OIDC_AUTH_METHOD_TYPE_NONE" && zitadel_application_oidc.public.response_types == tolist(["OIDC_RESPONSE_TYPE_CODE"])
    error_message = "the single-page app is a public client using the authorization code flow"
  }
}

run "roles_are_asserted_in_tokens" {
  command = plan

  assert {
    condition     = zitadel_project.this.project_role_assertion && zitadel_application_oidc.public.id_token_role_assertion && zitadel_application_oidc.public.access_token_role_assertion
    error_message = "the backend reads the roles from the tokens"
  }
}

run "dev_mode_is_off_unless_asked_for" {
  command = plan

  assert {
    condition     = zitadel_application_oidc.public.dev_mode == false
    error_message = "dev mode relaxes redirect validation and must be opt-in"
  }
}

run "outputs_the_client_id" {
  command = apply

  assert {
    condition     = length(output.client_id) > 0 && length(output.project_id) > 0
    error_message = "the client and project IDs must be outputs"
  }
}

run "no_users_by_default" {
  command = plan

  assert {
    condition     = length(zitadel_human_user.this) == 0 && length(zitadel_user_grant.this) == 0 && length(zitadel_instance_member.this) == 0
    error_message = "production passes no users, so none may be created"
  }
}

run "each_user_gets_its_role_and_only_admins_become_instance_members" {
  command = plan

  variables {
    users = {
      admin = {
        email          = "admin@test.com"
        first_name     = "Admin"
        last_name      = "User"
        password       = "Admin123!"
        role           = "admin"
        instance_roles = ["IAM_OWNER"]
      }
      writer = {
        email      = "writer@test.com"
        first_name = "Writer"
        last_name  = "User"
        password   = "Writer123!"
        role       = "writer"
      }
    }
  }

  assert {
    condition     = toset(keys(zitadel_human_user.this)) == toset(["admin", "writer"]) && zitadel_user_grant.this["writer"].role_keys == toset(["writer"])
    error_message = "every user must be created and granted its role"
  }

  assert {
    condition     = toset(keys(zitadel_instance_member.this)) == toset(["admin"]) && zitadel_instance_member.this["admin"].roles == toset(["IAM_OWNER"])
    error_message = "only the user with instance roles becomes an instance member"
  }
}

run "outputs_the_user_ids" {
  command = apply

  variables {
    users = {
      user = {
        email      = "user@test.com"
        first_name = "Regular"
        last_name  = "User"
        password   = "User123!"
        role       = "user"
      }
    }
  }

  assert {
    condition     = toset(keys(output.user_ids)) == toset(["user"])
    error_message = "the user IDs must be outputs, by username"
  }
}

run "self_registration_is_off_by_default" {
  command = plan

  assert {
    condition     = length(zitadel_default_login_policy.this) == 0 && length(zitadel_action.post_self_registration) == 0 && length(zitadel_trigger_actions.post_self_registration) == 0
    error_message = "production does not open registration unless asked to"
  }
}

run "self_registration_grants_the_user_role_and_fails_registration_when_it_fails" {
  command = apply

  variables {
    allow_self_registration = true
  }

  assert {
    condition     = zitadel_default_login_policy.this[0].allow_register && zitadel_action.post_self_registration[0].allowed_to_fail == false
    error_message = "registration must be allowed, and blocked when the role cannot be granted"
  }

  assert {
    condition     = zitadel_trigger_actions.post_self_registration[0].flow_type == "FLOW_TYPE_INTERNAL_AUTHENTICATION" && zitadel_trigger_actions.post_self_registration[0].trigger_type == "TRIGGER_TYPE_POST_CREATION"
    error_message = "the action must run right after a user is created"
  }

  assert {
    condition     = strcontains(zitadel_action.post_self_registration[0].script, "api.userGrants.push") && strcontains(zitadel_action.post_self_registration[0].script, "roles: ['user']") && !strcontains(zitadel_action.post_self_registration[0].script, "Bearer")
    error_message = "the script must grant the user role through ZITADEL's own API, with no credential in it"
  }
}

run "impersonation_is_off_by_default" {
  command = plan

  assert {
    condition     = length(zitadel_default_security_settings.this) == 0 && length(zitadel_machine_user.impersonator) == 0 && output.integration_test == null
    error_message = "production does not allow impersonation unless asked to"
  }
}

run "the_impersonator_is_a_confidential_app_user_with_no_project_roles" {
  command = apply

  variables {
    impersonation = {
      redirect_uris = ["http://localhost:8080/dummy/callback"]
    }
  }

  assert {
    condition     = zitadel_default_security_settings.this[0].enable_impersonation && zitadel_application_oidc.integration_test[0].auth_method_type == "OIDC_AUTH_METHOD_TYPE_BASIC" && contains(zitadel_application_oidc.integration_test[0].grant_types, "OIDC_GRANT_TYPE_TOKEN_EXCHANGE")
    error_message = "impersonation must be on and the confidential app must allow token exchange"
  }

  assert {
    condition     = zitadel_instance_member.impersonator[0].roles == toset(["IAM_END_USER_IMPERSONATOR"])
    error_message = "the bot must be an impersonator"
  }

  assert {
    condition     = length(zitadel_user_grant.impersonator[0].role_keys) == 0
    error_message = "the impersonator must not hold any project role"
  }

  assert {
    condition     = nonsensitive(output.integration_test.bot_key) != "" && nonsensitive(output.integration_test.bot_token) != ""
    error_message = "the bot's key and PAT must be outputs"
  }
}

run "users_may_have_no_password_and_credentials_may_expire_sooner" {
  command = plan

  variables {
    users = {
      writer = {
        email      = "writer@qa.example.com"
        first_name = "Writer"
        last_name  = "QA"
        role       = "writer"
      }
    }
    impersonation = {
      redirect_uris              = ["https://qa.example.com/dummy/callback"]
      credential_expiration_date = "2027-06-30T23:59:59Z"
    }
  }

  assert {
    condition     = zitadel_human_user.this["writer"].initial_password == null
    error_message = "a user that is only impersonated needs no password"
  }

  assert {
    condition     = zitadel_machine_key.impersonator[0].expiration_date == "2027-06-30T23:59:59Z" && zitadel_personal_access_token.impersonator[0].expiration_date == "2027-06-30T23:59:59Z"
    error_message = "the bot's key and PAT must expire when asked to"
  }
}

run "without_instance_settings_only_the_project_level_pieces_remain" {
  command = plan

  variables {
    manage_instance_settings   = false
    allow_self_registration    = true
    login_default_redirect_uri = "https://novel.example.com"
    impersonation = {
      redirect_uris = ["http://localhost:8080/callback"]
    }
  }

  assert {
    condition     = length(zitadel_default_login_policy.this) == 0 && length(zitadel_default_security_settings.this) == 0 && length(zitadel_action.post_self_registration) == 1 && length(zitadel_trigger_actions.post_self_registration) == 1
    error_message = "the instance-wide policies belong to the instance owner, the post-registration action to this project"
  }
}

run "an_existing_organization_is_used_by_default" {
  command = plan

  assert {
    condition     = length(zitadel_org.this) == 0 && length(zitadel_login_policy.this) == 0 && length(data.zitadel_orgs.this) == 1
    error_message = "without create_org the organization is looked up and no organization policy is set"
  }
}

run "its_own_organization_gets_its_own_login_policy" {
  command = plan

  variables {
    create_org                 = true
    org_name                   = "smart-novel"
    manage_instance_settings   = false
    allow_self_registration    = true
    login_default_redirect_uri = "https://novel.example.com"
  }

  assert {
    condition     = zitadel_org.this[0].name == "smart-novel" && length(data.zitadel_orgs.this) == 0
    error_message = "the organization must be created, not looked up"
  }

  assert {
    condition     = zitadel_login_policy.this[0].allow_register && zitadel_login_policy.this[0].default_redirect_uri == "https://novel.example.com" && length(zitadel_default_login_policy.this) == 0 && length(zitadel_action.post_self_registration) == 1
    error_message = "the login policy belongs to the organization, not to the instance, and the post-registration action stays"
  }
}

run "no_login_page_branding_without_an_organization_of_its_own" {
  command = plan

  assert {
    condition     = length(zitadel_label_policy.this) == 0
    error_message = "the local environment authenticates with a token, which cannot upload the logo"
  }
}

run "the_login_page_follows_the_frontends_palette_in_both_themes" {
  command = plan

  variables {
    create_org               = true
    org_name                 = "smart-novel"
    manage_instance_settings = false
  }

  assert {
    condition = (
      zitadel_label_policy.this[0].theme_mode == "THEME_MODE_AUTO" &&
      zitadel_label_policy.this[0].background_color == "#f9fafb" &&
      zitadel_label_policy.this[0].background_color_dark == "#111827" &&
      zitadel_label_policy.this[0].primary_color == "#2563eb" &&
      zitadel_label_policy.this[0].primary_color_dark == "#3b82f6" &&
      zitadel_label_policy.this[0].warn_color == "#dc2626" &&
      zitadel_label_policy.this[0].warn_color_dark == "#f87171"
    )
    error_message = "the colors must be the frontend's gray and blue, light and dark"
  }

  assert {
    condition     = endswith(zitadel_label_policy.this[0].logo_path, "apps/frontend/public/logo.png") && endswith(zitadel_label_policy.this[0].logo_dark_path, "files/login/logo-dark.png") && zitadel_label_policy.this[0].disable_watermark
    error_message = "the light logo is the frontend's own file, the dark one is derived from it"
  }
}

run "a_color_that_is_not_a_hex_value_is_rejected" {
  command = plan

  variables {
    branding = { dark = { primary_color = "blue" } }
  }

  expect_failures = [var.branding]
}
