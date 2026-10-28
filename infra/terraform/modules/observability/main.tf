locals {
  observability_dir = "${path.module}/../../../observability"
  grafana_dir       = "${local.observability_dir}/grafana/provisioning"
  dashboards        = fileset("${local.grafana_dir}/dashboards/definitions", "*.json")

  # Data is throwaway locally, so every store writes to an emptyDir.
  retention = { traces = "168h", logs = "30d", metrics = "15d" }

  grafana_files = merge(
    {
      "datasources.yaml" = file("${local.grafana_dir}/datasources/datasources.yaml")
      "dashboards.yaml"  = file("${local.grafana_dir}/dashboards/dashboards.yaml")
      "alert-rules.yaml" = file("${local.grafana_dir}/alerting/alert-rules.yaml")
    },
    { for name in local.dashboards : name => file("${local.grafana_dir}/dashboards/definitions/${name}") },
  )

  grafana_items = concat(
    [
      { key = "datasources.yaml", path = "datasources/datasources.yaml" },
      { key = "dashboards.yaml", path = "dashboards/dashboards.yaml" },
      { key = "alert-rules.yaml", path = "alerting/alert-rules.yaml" },
    ],
    [for name in local.dashboards : { key = name, path = "dashboards/definitions/${name}" }],
  )

  # One entry per component of the stack. `config_file` is the ConfigMap mounted at `config_path`; `data_path` is
  # where the component writes.
  stack = {
    otel-collector = {
      args        = ["--config=/etc/otelcol/config.yaml"]
      config_path = "/etc/otelcol"
      config_file = {
        "config.yaml" = templatefile("${path.module}/otel-collector-config.yaml.tftpl", {
          sampling_percentage = var.sampling_ratio * 100
        })
      }
      data_path = null
      user      = 10001
      ports     = { otlp-grpc = 4317, otlp-http = 4318, health = 13133 }
      probe     = { path = "/", port = 13133 }
      env       = {}
    }
    tempo = {
      args        = ["-config.file=/etc/tempo/tempo.yaml", "-config.expand-env=true"]
      config_path = "/etc/tempo"
      config_file = { "tempo.yaml" = file("${local.observability_dir}/tempo.yaml") }
      data_path   = "/var/tempo"
      user        = 10001
      ports       = { http = 3200, otlp-grpc = 4317 }
      probe       = { path = "/ready", port = 3200 }
      env         = { TRACES_RETENTION = local.retention.traces }
    }
    loki = {
      args        = ["-config.file=/etc/loki/loki.yaml", "-config.expand-env=true"]
      config_path = "/etc/loki"
      config_file = { "loki.yaml" = file("${local.observability_dir}/loki.yaml") }
      data_path   = "/var/loki"
      user        = 10001
      ports       = { http = 3100 }
      probe       = { path = "/ready", port = 3100 }
      env         = { LOGS_RETENTION = local.retention.logs }
    }
    prometheus = {
      args = [
        "--config.file=/etc/prometheus/prometheus.yml",
        "--storage.tsdb.path=/prometheus",
        "--storage.tsdb.retention.time=${local.retention.metrics}",
      ]
      config_path = "/etc/prometheus"
      config_file = { "prometheus.yml" = file("${local.observability_dir}/prometheus.yaml") }
      data_path   = "/prometheus"
      user        = 65534
      ports       = { http = 9090 }
      probe       = { path = "/-/ready", port = 9090 }
      env         = {}
    }
  }
}

resource "kubernetes_config_map_v1" "stack" {
  for_each = local.stack

  metadata {
    name      = each.key
    namespace = var.namespace
    labels    = var.labels
  }

  data = each.value.config_file
}

resource "kubernetes_deployment_v1" "stack" {
  for_each = local.stack

  metadata {
    name      = each.key
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = each.key }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = each.key })
        annotations = {
          config-hash = sha256(jsonencode(each.value.config_file))
        }
      }

      spec {
        security_context {
          fs_group = each.value.user
        }

        container {
          name  = each.key
          image = var.images[each.key]
          args  = each.value.args

          dynamic "port" {
            for_each = each.value.ports
            content {
              name           = port.key
              container_port = port.value
            }
          }

          dynamic "env" {
            for_each = each.value.env
            content {
              name  = env.key
              value = env.value
            }
          }

          readiness_probe {
            http_get {
              path = each.value.probe.path
              port = each.value.probe.port
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 3
          }

          volume_mount {
            name       = "config"
            mount_path = each.value.config_path
            read_only  = true
          }

          dynamic "volume_mount" {
            for_each = each.value.data_path == null ? [] : [each.value.data_path]
            content {
              name       = "data"
              mount_path = volume_mount.value
            }
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map_v1.stack[each.key].metadata[0].name
          }
        }

        dynamic "volume" {
          for_each = each.value.data_path == null ? [] : [1]
          content {
            name = "data"
            empty_dir {}
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "stack" {
  for_each = local.stack

  metadata {
    name      = each.key
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = each.key }

    dynamic "port" {
      for_each = each.value.ports
      content {
        name        = port.key
        port        = port.value
        target_port = port.value
      }
    }
  }
}

resource "random_password" "grafana_admin" {
  length  = 24
  special = false
}

resource "kubernetes_secret_v1" "grafana" {
  metadata {
    name      = "grafana-admin"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    password = random_password.grafana_admin.result
  }
}

resource "kubernetes_config_map_v1" "grafana" {
  metadata {
    name      = "grafana-provisioning"
    namespace = var.namespace
    labels    = var.labels
  }

  data = local.grafana_files
}

resource "kubernetes_deployment_v1" "grafana" {
  metadata {
    name      = "grafana"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "grafana" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "grafana" })
        annotations = {
          config-hash = sha256(jsonencode(local.grafana_files))
        }
      }

      spec {
        security_context {
          fs_group = 472
        }

        container {
          name  = "grafana"
          image = var.images["grafana"]

          port {
            name           = "http"
            container_port = 3000
          }

          env {
            name = "GF_SECURITY_ADMIN_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.grafana.metadata[0].name
                key  = "password"
              }
            }
          }

          env {
            name  = "GF_SERVER_ROOT_URL"
            value = var.grafana_root_url
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 5
          }

          volume_mount {
            name       = "provisioning"
            mount_path = "/etc/grafana/provisioning"
            read_only  = true
          }

          volume_mount {
            name       = "data"
            mount_path = "/var/lib/grafana"
          }
        }

        volume {
          name = "provisioning"
          config_map {
            name = kubernetes_config_map_v1.grafana.metadata[0].name

            dynamic "items" {
              for_each = local.grafana_items
              content {
                key  = items.value.key
                path = items.value.path
              }
            }
          }
        }

        volume {
          name = "data"
          empty_dir {}
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "grafana" {
  metadata {
    name      = "grafana"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "grafana" }

    port {
      name        = "http"
      port        = 3000
      target_port = 3000
    }
  }
}

moved {
  from = kubernetes_config_map_v1.collector
  to   = kubernetes_config_map_v1.stack["otel-collector"]
}

moved {
  from = kubernetes_deployment_v1.collector
  to   = kubernetes_deployment_v1.stack["otel-collector"]
}

moved {
  from = kubernetes_service_v1.collector
  to   = kubernetes_service_v1.stack["otel-collector"]
}
