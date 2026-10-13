locals {
  file_paths = sort(keys(var.files))
}

resource "kubernetes_config_map_v1" "files" {
  count = length(local.file_paths) == 0 ? 0 : 1

  metadata {
    name      = "frontend-files"
    namespace = var.namespace
    labels    = var.labels
  }

  data = { for index, path in local.file_paths : "file-${index}" => var.files[path] }
}

# Ordering goes through a value instead of a module-level depends_on, which would make the routes output wait for the Jobs and close a cycle with the ingress.
resource "terraform_data" "wait_for" {
  input = var.wait_for
}

resource "kubernetes_deployment_v1" "frontend" {
  metadata {
    name      = "frontend"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "frontend" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "frontend" })
      }

      spec {
        # A Service named frontend would otherwise inject FRONTEND_PORT=tcp://..., shadowing the application setting of that name.
        enable_service_links = false

        container {
          name    = "frontend"
          image   = var.image
          command = var.command

          dynamic "env" {
            for_each = var.environment
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

          dynamic "volume_mount" {
            for_each = local.file_paths
            content {
              name       = "files"
              mount_path = volume_mount.value
              sub_path   = "file-${volume_mount.key}"
              read_only  = true
            }
          }

          startup_probe {
            http_get {
              path = "/"
              port = "http"
            }
            period_seconds    = 10
            failure_threshold = 60
          }

          readiness_probe {
            http_get {
              path = "/"
              port = "http"
            }
            period_seconds = 15
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

        dynamic "volume" {
          for_each = kubernetes_config_map_v1.files
          content {
            name = "files"

            config_map {
              name = volume.value.metadata[0].name
            }
          }
        }
      }
    }
  }

  depends_on = [terraform_data.wait_for]
}

resource "kubernetes_service_v1" "frontend" {
  metadata {
    name      = "frontend"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "frontend" }

    port {
      port        = var.port
      target_port = "http"
    }
  }
}
