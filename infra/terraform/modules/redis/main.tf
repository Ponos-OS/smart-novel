locals {
  deploy       = var.redis_url == null
  has_password = var.password != null
}

resource "kubernetes_secret_v1" "redis" {
  count = local.deploy && local.has_password ? 1 : 0

  metadata {
    name      = "redis"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    password = var.password
  }
}

resource "kubernetes_deployment_v1" "redis" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "redis"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "redis" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "redis" })
      }

      spec {
        container {
          name  = "redis"
          image = var.image

          # exec lets Redis receive signals directly, for a graceful shutdown.
          command = [
            "/bin/sh", "-c",
            "exec redis-server --maxmemory \"${var.max_memory}\" --maxmemory-policy \"${var.max_memory_policy}\" $${REDIS_PASSWORD:+--requirepass \"$REDIS_PASSWORD\"}",
          ]

          port {
            name           = "redis"
            container_port = 6379
          }

          dynamic "env" {
            for_each = local.has_password ? [1] : []
            content {
              name = "REDIS_PASSWORD"
              value_from {
                secret_key_ref {
                  name = kubernetes_secret_v1.redis[0].metadata[0].name
                  key  = "password"
                }
              }
            }
          }

          resources {
            limits = {
              memory = var.memory_limit
            }
          }

          readiness_probe {
            exec {
              command = ["/bin/sh", "-c", "redis-cli $${REDIS_PASSWORD:+-a \"$REDIS_PASSWORD\"} ping | grep PONG"]
            }
            period_seconds  = 5
            timeout_seconds = 3
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "redis" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "redis"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    type     = var.node_port == null ? "ClusterIP" : "NodePort"
    selector = { app = "redis" }

    port {
      port        = 6379
      target_port = "redis"
      node_port   = var.node_port
    }
  }
}
