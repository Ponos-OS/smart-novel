provider "kubernetes" {
  config_path = var.kubeconfig_path
}

data "kubernetes_secret_v1" "zitadel_admin" {
  metadata {
    namespace = var.zitadel_admin_secret.namespace
    name      = var.zitadel_admin_secret.name
  }
}

provider "zitadel" {
  domain = var.zitadel_domain
  port   = "443"
  # A key, not the token: uploading the login page's logo and icon needs a JWT profile.
  jwt_profile_json = data.kubernetes_secret_v1.zitadel_admin.data["jwt_profile_json"]
}
