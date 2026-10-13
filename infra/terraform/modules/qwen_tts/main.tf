resource "kubernetes_deployment_v1" "qwen_tts" {
  metadata {
    name      = "qwen-tts"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "qwen-tts" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "qwen-tts" })
      }

      spec {
        # The image reads its own port from <NAME>_PORT, which the Service named after it would overwrite with tcp://<ip>:<port>.
        enable_service_links = false

        container {
          name  = "qwen-tts"
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

resource "kubernetes_service_v1" "qwen_tts" {
  metadata {
    name      = "qwen-tts"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "qwen-tts" }

    port {
      port        = 8001
      target_port = "http"
    }
  }
}
