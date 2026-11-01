output "routes" {
  description = "Routes for the ingress: everything on ZITADEL's own host, and the login UI on it. Nothing is claimed on the host of the frontend"
  value = [
    {
      name        = "zitadel-web"
      rule        = local.host_rule
      priority    = 100
      service     = "h2c://${kubernetes_service_v1.zitadel.metadata[0].name}:8080"
      middlewares = ["zitadel-fwd"]
    },
    {
      name     = "zitadel-login-web"
      rule     = "(${local.host_rule}) && PathPrefix(`${local.login_path}`)"
      priority = 250
      service  = "http://${kubernetes_service_v1.login.metadata[0].name}:3000"
    },
  ]
}

output "middlewares" {
  description = "Middlewares the routes reference"
  value = {
    zitadel-fwd = {
      custom_request_headers = {
        "X-Forwarded-Host"  = "${var.external_domain}:${var.external_port}"
        "X-Forwarded-Proto" = "http"
      }
    }
  }
}

output "credentials" {
  description = "Where ZITADEL's generated credentials live. Consumers mount the claim and read the files, and never refer to the mechanism"
  value = {
    claim_name = kubernetes_persistent_volume_claim_v1.credentials.metadata[0].name
    mount_path = local.credentials_mount_path
    pat_file   = "${local.credentials_mount_path}/token"
  }
}
