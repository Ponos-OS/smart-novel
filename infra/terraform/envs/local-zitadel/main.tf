# The bot's PAT is written by ZITADEL to a volume only the cluster can read.
data "external" "bot_pat" {
  program = [
    "sh", "-c",
    "token=$(kubectl --kubeconfig \"$1\" --namespace \"$2\" exec deploy/zitadel-login -- cat /zitadel-pat/token) && printf '{\"token\":\"%s\"}' \"$token\"",
    "sh", var.kubeconfig_path, var.namespace,
  ]
}

provider "zitadel" {
  domain       = "localhost"
  port         = tostring(var.host_port)
  insecure     = true
  access_token = trimspace(data.external.bot_pat.result.token)
}

module "zitadel_config" {
  source = "../../modules/zitadel_config"

  redirect_uris             = ["http://localhost:${var.host_port}/auth/callback"]
  post_logout_redirect_uris = ["http://localhost:${var.host_port}"]
  dev_mode                  = true
}
