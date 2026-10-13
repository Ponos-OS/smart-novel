locals {
  deploy = var.broker_url == null
}

resource "kubernetes_deployment_v1" "rabbitmq" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "rabbitmq"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "rabbitmq" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "rabbitmq" })
      }

      spec {
        container {
          name  = "rabbitmq"
          image = var.image

          env {
            name  = "RABBITMQ_DEFAULT_USER"
            value = var.username
          }

          env {
            name  = "RABBITMQ_DEFAULT_PASS"
            value = var.password
          }

          port {
            name           = "amqp"
            container_port = 5672
          }

          readiness_probe {
            exec {
              command = ["rabbitmq-diagnostics", "-q", "ping"]
            }
            initial_delay_seconds = 10
            period_seconds        = 10
            timeout_seconds       = 10
            failure_threshold     = 12
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "rabbitmq" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "rabbitmq"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "rabbitmq" }

    port {
      port        = 5672
      target_port = "amqp"
    }
  }
}
