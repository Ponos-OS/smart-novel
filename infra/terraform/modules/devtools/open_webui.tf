resource "kubernetes_deployment_v1" "open_webui" {
  count = var.ollama_base_url == null ? 0 : 1

  metadata {
    name      = "open-webui"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "open-webui" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "open-webui" })
      }

      spec {
        container {
          name  = "open-webui"
          image = var.open_webui_image

          env {
            name  = "OLLAMA_BASE_URL"
            value = var.ollama_base_url
          }

          env {
            name  = "WEBUI_AUTH"
            value = "False"
          }

          port {
            name           = "http"
            container_port = 8080
          }

          # Takes up to a minute to start.
          readiness_probe {
            http_get {
              path = "/health"
              port = "http"
            }
            period_seconds    = 10
            failure_threshold = 30
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "open_webui" {
  count = var.ollama_base_url == null ? 0 : 1

  metadata {
    name      = "open-webui"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    type     = var.node_ports.open_webui == null ? "ClusterIP" : "NodePort"
    selector = { app = "open-webui" }

    port {
      port        = 8080
      target_port = "http"
      node_port   = var.node_ports.open_webui
    }
  }
}
