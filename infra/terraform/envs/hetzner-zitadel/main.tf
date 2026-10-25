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
  domain       = var.zitadel_domain
  port         = "443"
  access_token = trimspace(data.kubernetes_secret_v1.admin.data["token"])
}

# Instance-wide settings (allow_register and the like) belong to the infra repo; this root only sets up the project, its roles, the client and the post-registration action.
module "zitadel_config" {
  source = "../../modules/zitadel_config"

  redirect_uris             = ["https://${var.domain}${var.redirect_path}"]
  post_logout_redirect_uris = ["https://${var.domain}"]

  allow_self_registration    = true
  login_default_redirect_uri = "https://${var.domain}"
  manage_instance_settings   = false
}
