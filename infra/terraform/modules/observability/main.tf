resource "kubernetes_config_map_v1" "collector" {
  metadata {
    name      = "otel-collector"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    "config.yaml" = templatefile("${path.module}/otel-collector-config.yaml.tftpl", {
      sampling_percentage = var.sampling_ratio * 100
    })
  }
}

resource "kubernetes_deployment_v1" "collector" {
  metadata {
    name      = "otel-collector"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "otel-collector" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "otel-collector" })
        annotations = {
          config-hash = sha256(kubernetes_config_map_v1.collector.data["config.yaml"])
        }
      }

      spec {
        container {
          name  = "otel-collector"
          image = var.collector_image
          args  = ["--config=/etc/otel/config.yaml"]

          port {
            name           = "otlp-http"
            container_port = 4318
          }

          port {
            name           = "otlp-grpc"
            container_port = 4317
          }

          port {
            name           = "health"
            container_port = 13133
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/otel"
            read_only  = true
          }

          readiness_probe {
            http_get {
              path = "/"
              port = "health"
            }
            period_seconds  = 5
            timeout_seconds = 3
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map_v1.collector.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "collector" {
  metadata {
    name      = "otel-collector"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "otel-collector" }

    port {
      name        = "otlp-http"
      port        = 4318
      target_port = "otlp-http"
    }

    port {
      name        = "otlp-grpc"
      port        = 4317
      target_port = "otlp-grpc"
    }
  }
}

resource "kubernetes_deployment_v1" "jaeger" {
  metadata {
    name      = "jaeger"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "jaeger" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "jaeger" })
      }

      spec {
        container {
          name  = "jaeger"
          image = var.jaeger_image

          env {
            name  = "COLLECTOR_OTLP_ENABLED"
            value = "true"
          }

          env {
            name  = "QUERY_BASE_PATH"
            value = var.jaeger_path
          }

          port {
            name           = "ui"
            container_port = 16686
          }

          port {
            name           = "otlp-grpc"
            container_port = 4317
          }

          port {
            name           = "health"
            container_port = 14269
          }

          readiness_probe {
            http_get {
              path = "/"
              port = "health"
            }
            period_seconds  = 5
            timeout_seconds = 3
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "jaeger" {
  metadata {
    name      = "jaeger"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "jaeger" }

    port {
      name        = "ui"
      port        = 16686
      target_port = "ui"
    }

    port {
      name        = "otlp-grpc"
      port        = 4317
      target_port = "otlp-grpc"
    }
  }
}
