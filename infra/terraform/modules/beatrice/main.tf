locals {
  tracing_enabled = var.otlp_http_endpoint != null
}

resource "kubernetes_secret_v1" "beatrice" {
  metadata {
    name      = "beatrice"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    RABBITMQ__CONNECTION_STRING = var.broker_url
    LLM__API_KEY                = var.llm_api_key
    TTS__API_KEY                = var.tts_api_key
  }
}

resource "kubernetes_deployment_v1" "beatrice" {
  metadata {
    name      = "beatrice"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "beatrice" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "beatrice" })
      }

      spec {
        container {
          name  = "beatrice"
          image = var.image

          env_from {
            secret_ref {
              name = kubernetes_secret_v1.beatrice.metadata[0].name
            }
          }

          dynamic "env" {
            for_each = {
              PORT                                    = "3000"
              SERVICE_NAME                            = "beatrice"
              LLM__BASE_URL                           = var.llm_base_url
              LLM__MODEL                              = var.llm_model
              LLM__TIMEOUT_MS                         = tostring(var.llm_timeout_ms)
              LOGGING__MODE                           = "JSON"
              LOGGING__LEVEL                          = var.log_level
              OTEL__ENABLED                           = tostring(local.tracing_enabled)
              OTEL__EXPORTER_OTLP_ENDPOINT            = local.tracing_enabled ? var.otlp_http_endpoint : ""
              OTEL__TRACES_SAMPLER                    = var.traces_sampler
              GENERATE_AUDIO__CALLBACK__ALLOWED_HOSTS = var.callback_allowed_hosts
              TTS__BASE_URL                           = var.tts_base_url
              TTS__MODEL                              = var.tts_model
              TTS__VOICES                             = var.tts_voices
              TTS__TIMEOUT_MS                         = tostring(var.tts_timeout_ms)
            }
            content {
              name  = env.key
              value = env.value
            }
          }

          port {
            name           = "http"
            container_port = 3000
          }

          readiness_probe {
            tcp_socket {
              port = "http"
            }
            period_seconds    = 5
            failure_threshold = 24
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "beatrice" {
  metadata {
    name      = "beatrice"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "beatrice" }

    port {
      port        = 3000
      target_port = "http"
    }
  }
}
