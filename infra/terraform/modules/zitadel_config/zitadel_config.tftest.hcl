mock_provider "zitadel" {
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
