locals {
  credentials_mount_path = "/zitadel-pat"
  external_origin        = "http://${var.external_domain}:${var.external_port}"
  login_path             = "/ui/v2/login"

  # Shared by the init step and the server, which read the same configuration.
  environment = {
    ZITADEL_PORT                                           = "8080"
    ZITADEL_DATABASE_POSTGRES_HOST                         = var.database_host
    ZITADEL_DATABASE_POSTGRES_PORT                         = tostring(var.database_port)
    ZITADEL_DATABASE_POSTGRES_DATABASE                     = "zitadel"
    ZITADEL_DATABASE_POSTGRES_USER_USERNAME                = "zitadel"
    ZITADEL_DATABASE_POSTGRES_USER_SSL_MODE                = "disable"
    ZITADEL_DATABASE_POSTGRES_ADMIN_USERNAME               = var.database_admin_username
    ZITADEL_DATABASE_POSTGRES_ADMIN_SSL_MODE               = "disable"
    ZITADEL_EXTERNALDOMAIN                                 = var.external_domain
    ZITADEL_FIRSTINSTANCE_ORG_HUMAN_USERNAME               = var.admin_username
    ZITADEL_FIRSTINSTANCE_ORG_HUMAN_PASSWORDCHANGEREQUIRED = "false"
    # Machine user (IAM_OWNER) whose PAT is written to the shared volume so the setup job can read it.
    ZITADEL_FIRSTINSTANCE_ORG_MACHINE_MACHINE_USERNAME   = "bot"
    ZITADEL_FIRSTINSTANCE_ORG_MACHINE_MACHINE_NAME       = "Bot"
    ZITADEL_FIRSTINSTANCE_ORG_MACHINE_PAT_EXPIRATIONDATE = "9999-12-31T23:59:59Z"
    ZITADEL_FIRSTINSTANCE_PATPATH                        = "${local.credentials_mount_path}/token"
    ZITADEL_DEFAULTINSTANCE_INSTANCENAME                 = "ZITADEL"
    # Login V2 (a separate Next.js app served by the login deployment).
    ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_REQUIRED = "true"
    ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_BASEURI  = "${local.external_origin}${local.login_path}/"
    ZITADEL_OIDC_DEFAULTLOGINURLV2                    = "${local.external_origin}${local.login_path}/login?authRequest="
    ZITADEL_OIDC_DEFAULTLOGOUTURLV2                   = "${local.external_origin}${local.login_path}/logout?post_logout_redirect="
    # Machine user for the login service.
    ZITADEL_FIRSTINSTANCE_LOGINCLIENTPATPATH                 = "${local.credentials_mount_path}/login-client.pat"
    ZITADEL_FIRSTINSTANCE_ORG_LOGINCLIENT_MACHINE_USERNAME   = "login-client"
    ZITADEL_FIRSTINSTANCE_ORG_LOGINCLIENT_MACHINE_NAME       = "Automatically Initialized IAM_LOGIN_CLIENT"
    ZITADEL_FIRSTINSTANCE_ORG_LOGINCLIENT_PAT_EXPIRATIONDATE = "9999-12-31T23:59:59Z"
    # Token exchange (RFC 8693), so e2e tests can impersonate human users through the bot's PAT.
    ZITADEL_DEFAULTINSTANCE_FEATURES_TOKENEXCHANGE_ENABLED = "true"
    ZITADEL_DEFAULTINSTANCE_FEATURES_IMPERSONATION_ENABLED = "true"
  }

  secret_environment = {
    ZITADEL_MASTERKEY                        = "masterkey"
    ZITADEL_DATABASE_POSTGRES_USER_PASSWORD  = "database_password"
    ZITADEL_DATABASE_POSTGRES_ADMIN_PASSWORD = "database_admin_password"
    ZITADEL_FIRSTINSTANCE_ORG_HUMAN_PASSWORD = "admin_password"
  }
}

resource "random_password" "masterkey" {
  length  = 32
  special = false
}

resource "kubernetes_secret_v1" "zitadel" {
  metadata {
    name      = "zitadel"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    masterkey               = random_password.masterkey.result
    database_password       = var.database_password
    database_admin_password = var.database_admin_password
    admin_password          = var.admin_password
  }
}

# One volume every ZITADEL-related pod mounts, because ZITADEL and the setup job write credentials the others read. Kind has a single node, so a ReadWriteOnce claim can be mounted by all of them.
resource "kubernetes_persistent_volume_claim_v1" "credentials" {
  metadata {
    name      = "zitadel-credentials"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = var.credentials_storage_class_name

    resources {
      requests = {
        storage = "100Mi"
      }
    }
  }

  wait_until_bound = false
}
