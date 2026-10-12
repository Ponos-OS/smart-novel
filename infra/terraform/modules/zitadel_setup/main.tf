resource "kubernetes_job_v1" "setup" {
  metadata {
    name      = "zitadel-setup"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    backoff_limit = 6

    template {
      metadata {
        labels = merge(var.labels, { app = "zitadel-setup" })
      }

      spec {
        restart_policy = "OnFailure"

        container {
          name  = "setup"
          image = var.image

          env {
            name  = "ZITADEL_URL"
            value = var.zitadel_url
          }

          env {
            name  = "ZITADEL_APP_NAME"
            value = var.app_name
          }

          volume_mount {
            name       = "credentials"
            mount_path = var.credentials.mount_path
          }
        }

        volume {
          name = "credentials"

          persistent_volume_claim {
            claim_name = var.credentials.claim_name
          }
        }
      }
    }
  }

  wait_for_completion = true

  timeouts {
    create = "10m"
  }

  lifecycle {
    precondition {
      condition     = var.credentials.mount_path == "/zitadel-pat"
      error_message = "The setup script reads and writes /zitadel-pat, so the credentials volume must be mounted there."
    }
  }
}
