locals {
  credentials_volume_name = "credentials"
}

resource "kubernetes_job_v1" "init" {
  metadata {
    name      = "zitadel-init"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    backoff_limit = 12

    template {
      metadata {
        labels = merge(var.labels, { app = "zitadel-init" })
      }

      spec {
        restart_policy = "OnFailure"

        # ZITADEL runs as an unprivileged user and writes the generated PATs here.
        init_container {
          name    = "credentials-permissions"
          image   = var.busybox_image
          command = ["sh", "-c", "chmod 1777 ${local.credentials_mount_path}"]

          volume_mount {
            name       = local.credentials_volume_name
            mount_path = local.credentials_mount_path
          }
        }

        container {
          name  = "zitadel"
          image = var.image
          args  = ["init"]

          dynamic "env" {
            for_each = local.environment
            content {
              name  = env.key
              value = env.value
            }
          }

          dynamic "env" {
            for_each = local.secret_environment
            content {
              name = env.key
              value_from {
                secret_key_ref {
                  name = kubernetes_secret_v1.zitadel.metadata[0].name
                  key  = env.value
                }
              }
            }
          }

          volume_mount {
            name       = local.credentials_volume_name
            mount_path = local.credentials_mount_path
          }
        }

        volume {
          name = local.credentials_volume_name

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim_v1.credentials.metadata[0].name
          }
        }
      }
    }
  }

  wait_for_completion = true

  timeouts {
    create = "10m"
  }
}

resource "kubernetes_deployment_v1" "zitadel" {
  metadata {
    name      = "zitadel"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "zitadel" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "zitadel" })
      }

      spec {
        container {
          name  = "zitadel"
          image = var.image
          args  = ["start-from-setup", "--masterkeyFromEnv", "--tlsMode", "disabled"]

          port {
            name           = "http"
            container_port = 8080
          }

          dynamic "env" {
            for_each = merge(local.environment, {
              ZITADEL_EXTERNALPORT   = tostring(var.external_port)
              ZITADEL_EXTERNALSECURE = "false"
              ZITADEL_TLS_ENABLED    = "false"
            })
            content {
              name  = env.key
              value = env.value
            }
          }

          dynamic "env" {
            for_each = local.secret_environment
            content {
              name = env.key
              value_from {
                secret_key_ref {
                  name = kubernetes_secret_v1.zitadel.metadata[0].name
                  key  = env.value
                }
              }
            }
          }

          readiness_probe {
            exec {
              command = ["/app/zitadel", "ready"]
            }
            initial_delay_seconds = 20
            period_seconds        = 10
            failure_threshold     = 12
          }

          volume_mount {
            name       = local.credentials_volume_name
            mount_path = local.credentials_mount_path
          }
        }

        volume {
          name = local.credentials_volume_name

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim_v1.credentials.metadata[0].name
          }
        }
      }
    }
  }

  wait_for_rollout = true

  depends_on = [kubernetes_job_v1.init]
}

resource "kubernetes_service_v1" "zitadel" {
  metadata {
    name      = "zitadel"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "zitadel" }

    port {
      port        = 8080
      target_port = "http"
    }
  }
}

resource "kubernetes_deployment_v1" "login" {
  metadata {
    name      = "zitadel-login"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "zitadel-login" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "zitadel-login" })
      }

      spec {
        init_container {
          name    = "wait-for-login-client-pat"
          image   = var.busybox_image
          command = ["sh", "-c", "until [ -s ${local.credentials_mount_path}/login-client.pat ]; do sleep 2; done"]

          volume_mount {
            name       = local.credentials_volume_name
            mount_path = local.credentials_mount_path
            read_only  = true
          }
        }

        container {
          name  = "login"
          image = var.login_image

          port {
            name           = "http"
            container_port = 3000
          }

          env {
            name  = "ZITADEL_API_URL"
            value = "http://zitadel:8080"
          }

          env {
            name  = "NEXT_PUBLIC_BASE_PATH"
            value = local.login_path
          }

          env {
            name  = "ZITADEL_SERVICE_USER_TOKEN_FILE"
            value = "${local.credentials_mount_path}/login-client.pat"
          }

          env {
            name  = "CUSTOM_REQUEST_HEADERS"
            value = "Host:${var.external_domain},X-Forwarded-Proto:http"
          }

          readiness_probe {
            exec {
              command = ["/bin/sh", "-c", "node /app/healthcheck.mjs http://localhost:3000${local.login_path}/healthy"]
            }
            initial_delay_seconds = 10
            period_seconds        = 10
            timeout_seconds       = 30
            failure_threshold     = 12
          }

          volume_mount {
            name       = local.credentials_volume_name
            mount_path = local.credentials_mount_path
            read_only  = true
          }
        }

        volume {
          name = local.credentials_volume_name

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim_v1.credentials.metadata[0].name
          }
        }
      }
    }
  }

  wait_for_rollout = true

  depends_on = [kubernetes_deployment_v1.zitadel]
}

resource "kubernetes_service_v1" "login" {
  metadata {
    name      = "zitadel-login"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "zitadel-login" }

    port {
      port        = 3000
      target_port = "http"
    }
  }
}
