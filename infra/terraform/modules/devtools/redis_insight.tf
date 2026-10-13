resource "kubernetes_deployment_v1" "redis_insight" {
  count = var.redis == null ? 0 : 1

  metadata {
    name      = "redis-insight"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "redis-insight" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "redis-insight" })
      }

      spec {
        container {
          name  = "redis-insight"
          image = var.redis_insight_image

          dynamic "env" {
            for_each = merge(
              {
                RI_APP_PORT                    = "5540"
                RI_ACCEPT_TERMS_AND_CONDITIONS = "true"
                RI_REDIS_HOST                  = var.redis.host
                RI_REDIS_PORT                  = tostring(var.redis.port)
                RI_REDIS_ALIAS                 = "Smart Novel Redis"
                RI_REDIS_USERNAME              = "default"
              },
              var.redis_password == null ? {} : { RI_REDIS_PASSWORD = var.redis_password },
            )
            content {
              name  = env.key
              value = env.value
            }
          }

          port {
            name           = "http"
            container_port = 5540
          }

          readiness_probe {
            http_get {
              path = "/api/health/"
              port = "http"
            }
            period_seconds    = 10
            failure_threshold = 12
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "redis_insight" {
  count = var.redis == null ? 0 : 1

  metadata {
    name      = "redis-insight"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    type     = var.node_ports.redis_insight == null ? "ClusterIP" : "NodePort"
    selector = { app = "redis-insight" }

    port {
      port        = 5540
      target_port = "http"
      node_port   = var.node_ports.redis_insight
    }
  }
}
