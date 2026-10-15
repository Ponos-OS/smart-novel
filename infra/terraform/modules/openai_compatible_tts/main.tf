resource "kubernetes_deployment_v1" "openai_compatible_tts" {
  metadata {
    name      = "openai-compatible-tts"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "openai-compatible-tts" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "openai-compatible-tts" })
      }

      spec {
        # The image reads its own port from <NAME>_PORT, which the Service named after it would overwrite with tcp://<ip>:<port>.
        enable_service_links = false

        container {
          name  = "openai-compatible-tts"
          image = var.image

          port {
            name           = "http"
            container_port = 8001
          }

          readiness_probe {
            exec {
              command = ["/usr/local/bin/healthcheck.sh"]
            }
            initial_delay_seconds = 30
            period_seconds        = 15
            timeout_seconds       = 10
            failure_threshold     = 20
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "openai_compatible_tts" {
  metadata {
    name      = "openai-compatible-tts"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "openai-compatible-tts" }

    port {
      port        = 8001
      target_port = "http"
    }
  }
}
