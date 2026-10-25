variable "kubeconfig_path" {
  description = "Kubeconfig of the shared cluster, to read the ZITADEL admin token from"
  type        = string
}

variable "zitadel_domain" {
  description = "Host of ZITADEL, from the infra repo's zitadel_issuer_url output without the scheme"
  type        = string
}

variable "zitadel_admin_secret" {
  description = "Namespace and name of the Secret that holds the admin token (zitadel_admin_secret output of the infra repo's cluster/ root, key token)"
  type = object({
    namespace = string
    name      = string
  })
  default = {
    namespace = "zitadel"
    name      = "zitadel-admin"
  }
}

variable "domain" {
  description = "Host the app is served on; the redirect URIs are built from it"
  type        = string
}

variable "redirect_path" {
  description = "Path of the app's OIDC callback"
  type        = string
  default     = "/auth/callback"
}
