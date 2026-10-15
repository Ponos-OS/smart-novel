locals {
  health_check = "curl -sf -H 'Content-Type: application/json' --data '{\"query\":\"{ health }\"}' http://localhost:${var.port}/graphql"
}

resource "kubernetes_secret_v1" "backend" {
  count = var.enabled ? 1 : 0

  metadata {
    name      = "backend"
    namespace = var.namespace
    labels    = var.labels
  }

  data = var.secret_environment
}

# Ordering goes through a value instead of a module-level depends_on, which would make the routes output wait for the Jobs and close a cycle with the ingress.
resource "terraform_data" "wait_for" {
  count = var.enabled ? 1 : 0

  input = var.wait_for
}

resource "kubernetes_deployment_v1" "backend" {
  count = var.enabled ? 1 : 0

  metadata {
    name      = "backend"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "backend" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "backend" })
      }

      spec {
        # A Service named backend would otherwise inject BACKEND_PORT=tcp://..., shadowing the application setting of that name.
        enable_service_links = false

        container {
          name  = "backend"
          image = var.image

          env_from {
            secret_ref {
              name = kubernetes_secret_v1.backend[0].metadata[0].name
            }
          }

          dynamic "env" {
            for_each = merge(var.environment, { PORT = tostring(var.port) })
            content {
              name  = env.key
              value = env.value
            }
          }

          port {
            name           = "http"
            container_port = var.port
          }

          dynamic "volume_mount" {
            for_each = var.volumes
            content {
              name       = volume_mount.value.name
              mount_path = volume_mount.value.mount_path
              read_only  = volume_mount.value.read_only
            }
          }

          startup_probe {
            exec {
              command = ["/bin/sh", "-c", local.health_check]
            }
            period_seconds    = 10
            timeout_seconds   = 10
            failure_threshold = 60
          }

          readiness_probe {
            exec {
              command = ["/bin/sh", "-c", local.health_check]
            }
            period_seconds  = 15
            timeout_seconds = 10
          }
        }

        dynamic "volume" {
          for_each = var.volumes
          content {
            name = volume.value.name

            dynamic "persistent_volume_claim" {
              for_each = volume.value.claim_name == null ? [] : [volume.value.claim_name]
              content {
                claim_name = persistent_volume_claim.value
                read_only  = volume.value.read_only
              }
            }

            dynamic "host_path" {
              for_each = volume.value.host_path == null ? [] : [volume.value.host_path]
              content {
                path = host_path.value
                type = "Directory"
              }
            }
          }
        }
      }
    }
  }

  depends_on = [terraform_data.wait_for]
}

resource "kubernetes_service_v1" "backend" {
  metadata {
    name      = "backend"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "backend" }

    port {
      port        = var.port
      target_port = "http"
    }
  }
}
