provider "kubernetes" {
  config_path = var.kubeconfig_path
}

data "kubernetes_secret_v1" "admin" {
  metadata {
    namespace = var.zitadel_admin_secret.namespace
    name      = var.zitadel_admin_secret.name
  }
}

provider "zitadel" {
  domain = var.zitadel_domain
  port   = "443"
  # A key, not the token: uploading the login page's logo and icon needs a JWT profile.
  jwt_profile_json = data.kubernetes_secret_v1.admin.data["jwt_profile_json"]
}

# Its own organization on the shared instance, with its own users and login policy; instance-wide settings belong to the infra repo.
module "zitadel_config" {
  source = "../../modules/zitadel_config"

  redirect_uris             = ["https://${var.domain}${var.redirect_path}"]
  post_logout_redirect_uris = ["https://${var.domain}"]

  create_org                    = true
  org_name                      = var.zitadel_org_name
  allow_self_registration       = true
  self_registration_webhook_url = "https://${var.domain}/zitadel-events/user-added"
  login_default_redirect_uri    = "https://${var.domain}"
  manage_instance_settings      = false

  backend_access = {}
}
