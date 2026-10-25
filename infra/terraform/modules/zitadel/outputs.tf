output "routes" {
  description = "Routes for the ingress: ZITADEL's own endpoints and the login UI. Everything else falls through to the frontend"
  value = [
    {
      name = "zitadel-web"
      rule = join(" || ", [for prefix in [
        "/.well-known", "/oauth", "/oidc", "/saml", "/v2", "/management", "/admin", "/auth/v1",
        "/assets/v1", "/ui/console", "/debug", "/zitadel.",
      ] : "PathPrefix(`${prefix}`)"])
      priority    = 100
      service     = "h2c://${kubernetes_service_v1.zitadel.metadata[0].name}:8080"
      middlewares = ["zitadel-fwd"]
    },
    {
      name     = "zitadel-login-web"
      rule     = "PathPrefix(`${local.login_path}`)"
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
