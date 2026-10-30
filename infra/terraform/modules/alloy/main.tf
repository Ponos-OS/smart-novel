locals {
  config = templatefile("${path.module}/config.alloy.tftpl", {
    namespace     = var.namespace
    apps_regex    = join("|", var.apps)
    loki_push_url = var.loki_push_url
  })
}

resource "kubernetes_service_account_v1" "alloy" {
  metadata {
    name      = "alloy"
    namespace = var.namespace
    labels    = var.labels
  }
}

# Alloy reads container logs through the Kubernetes API, so it needs no host mounts, and only in its own namespace.
resource "kubernetes_role_v1" "alloy" {
  metadata {
    name      = "alloy"
    namespace = var.namespace
    labels    = var.labels
  }

  rule {
    api_groups = [""]
    resources  = ["pods", "pods/log"]
    verbs      = ["get", "list", "watch"]
  }
}

resource "kubernetes_role_binding_v1" "alloy" {
  metadata {
    name      = "alloy"
    namespace = var.namespace
    labels    = var.labels
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role_v1.alloy.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account_v1.alloy.metadata[0].name
    namespace = var.namespace
  }
}

resource "kubernetes_config_map_v1" "alloy" {
  metadata {
    name      = "alloy"
    namespace = var.namespace
    labels    = var.labels
  }

  data = { "config.alloy" = local.config }
}

resource "kubernetes_deployment_v1" "alloy" {
  metadata {
    name      = "alloy"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "alloy" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "alloy" })
        annotations = {
          config-hash = sha256(local.config)
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.alloy.metadata[0].name

        container {
          name  = "alloy"
          image = var.image
          args = [
            "run",
            "/etc/alloy/config.alloy",
            "--server.http.listen-addr=0.0.0.0:12345",
            "--storage.path=/var/lib/alloy/data",
          ]

          port {
            name           = "http"
            container_port = 12345
          }

          readiness_probe {
            http_get {
              path = "/-/ready"
              port = "http"
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/alloy"
            read_only  = true
          }

          volume_mount {
            name       = "data"
            mount_path = "/var/lib/alloy/data"
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map_v1.alloy.metadata[0].name
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
