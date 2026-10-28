locals {
  deploy = var.broker_url == null
}

resource "kubernetes_config_map_v1" "plugins" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "rabbitmq-plugins"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    enabled_plugins = "[rabbitmq_management,rabbitmq_prometheus].\n"
  }
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

        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "15692"
        }
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

          port {
            name           = "management"
            container_port = 15672
          }

          port {
            name           = "prometheus"
            container_port = 15692
          }

          volume_mount {
            name       = "plugins"
            mount_path = "/etc/rabbitmq/enabled_plugins"
            sub_path   = "enabled_plugins"
            read_only  = true
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

        volume {
          name = "plugins"

          config_map {
            name = kubernetes_config_map_v1.plugins[0].metadata[0].name
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
      name        = "amqp"
      port        = 5672
      target_port = "amqp"
    }

    port {
      name        = "management"
      port        = 15672
      target_port = "management"
    }
  }
}
