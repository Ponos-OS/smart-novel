resource "kubernetes_deployment_v1" "ollama" {
  metadata {
    name      = "ollama"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "ollama" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "ollama" })
      }

      spec {
        # The image reads its own port from <NAME>_PORT, which the Service named after it would overwrite with tcp://<ip>:<port>.
        enable_service_links = false

        container {
          name  = "ollama"
          image = var.image

          port {
            name           = "http"
            container_port = 11434
          }

          readiness_probe {
            exec {
              command = ["/usr/local/bin/healthcheck.sh"]
            }
            initial_delay_seconds = 15
            period_seconds        = 15
            timeout_seconds       = 30
            failure_threshold     = 20
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "ollama" {
  metadata {
    name      = "ollama"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "ollama" }

    port {
      port        = 11434
      target_port = "http"
    }
  }
}
