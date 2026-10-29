locals {
  tracing_enabled = var.otlp_http_endpoint != null
}

resource "kubernetes_secret_v1" "fithara" {
  metadata {
    name      = "fithara"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    LLM__API_KEY = var.llm_api_key
  }
}

resource "kubernetes_deployment_v1" "fithara" {
  metadata {
    name      = "fithara"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "fithara" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "fithara" })
      }

      spec {
        # A Service named after the component injects FITHARA_PORT=tcp://<ip>:<port> into the pod.
        enable_service_links = false

        container {
          name  = "fithara"
          image = var.image

          env_from {
            secret_ref {
              name = kubernetes_secret_v1.fithara.metadata[0].name
            }
          }

          dynamic "env" {
            for_each = {
              PORT                         = "8000"
              SERVICE_NAME                 = "fithara"
              LLM__PROVIDER                = var.llm_provider
              LLM__MODEL                   = var.llm_model
              LLM__BASE_URL                = var.llm_base_url
              LLM__TIMEOUT_MS              = tostring(var.llm_timeout_ms)
              RATE_LIMIT__PER_MINUTE       = tostring(var.rate_limit_per_minute)
              LOGGING__MODE                = "JSON"
              LOGGING__LEVEL               = var.log_level
              OTEL__ENABLED                = tostring(local.tracing_enabled)
              OTEL__EXPORTER_OTLP_ENDPOINT = local.tracing_enabled ? var.otlp_http_endpoint : ""
            }
            content {
              name  = env.key
              value = env.value
            }
          }

          port {
            name           = "http"
            container_port = 8000
          }

          # Starting takes a while: the model capability catalog is read on boot.
          readiness_probe {
            http_get {
              path = "/health"
              port = "http"
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            failure_threshold     = 36
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "fithara" {
  metadata {
    name      = "fithara"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "fithara" }

    port {
      port        = 8000
      target_port = "http"
    }
  }
}
