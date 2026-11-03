resource "kubernetes_deployment_v1" "llm_gateway" {
  metadata {
    name      = "llm-gateway"
    namespace = var.namespace
    labels    = var.labels
  }

  # The first start downloads the LLM, which takes far longer than a rollout wait; the readiness probe still keeps traffic away until it is up.
  wait_for_rollout = false

  spec {
    replicas = 1

    selector {
      match_labels = { app = "llm-gateway" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "llm-gateway" })
      }

      spec {
        # The image reads its own port from GATEWAY_PORT, and a Service named like the component injects <NAME>_PORT variables.
        enable_service_links = false

        container {
          name  = "llm-gateway"
          image = var.image

          env {
            name  = "LLM_HF_MODEL"
            value = var.llm_hf_model
          }

          env {
            name  = "LLM_CTX_SIZE"
            value = tostring(var.context_length)
          }

          port {
            name           = "http"
            container_port = 8000
          }

          volume_mount {
            name       = "models"
            mount_path = "/models"
          }

          # The LLM is downloaded on first start, which takes a long time.
          readiness_probe {
            exec {
              command = ["/usr/local/bin/healthcheck.sh"]
            }
            initial_delay_seconds = 60
            period_seconds        = 15
            timeout_seconds       = 10
            failure_threshold     = 240
          }
        }

        volume {
          name = "models"

          empty_dir {}
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "llm_gateway" {
  metadata {
    name      = "llm-gateway"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "llm-gateway" }

    port {
      port        = 8000
      target_port = "http"
    }
  }
}
