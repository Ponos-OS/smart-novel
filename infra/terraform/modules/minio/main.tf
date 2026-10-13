locals {
  deploy         = var.object_storage_endpoint == null
  seed_container = "/source-data"
}

resource "kubernetes_secret_v1" "minio" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "minio"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    access_key = var.access_key
    secret_key = var.secret_key
  }
}

resource "kubernetes_config_map_v1" "bucket_policy" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "minio-bucket-policy"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    "bucket-policy.json" = templatefile("${path.module}/bucket-policy.json.tftpl", { bucket = var.bucket })
  }
}

resource "kubernetes_persistent_volume_claim_v1" "minio" {
  count = local.deploy && var.persistent_volumes ? 1 : 0

  metadata {
    name      = "minio-data"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = var.storage_class_name

    resources {
      requests = {
        storage = "10Gi"
      }
    }
  }
}

resource "kubernetes_deployment_v1" "minio" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "minio"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    strategy {
      type = "Recreate"
    }

    selector {
      match_labels = { app = "minio" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "minio" })
      }

      spec {
        container {
          name    = "minio"
          image   = var.image
          command = ["minio", "server", "--console-address", ":9001", "/data"]

          port {
            name           = "api"
            container_port = 9000
          }

          port {
            name           = "console"
            container_port = 9001
          }

          env {
            name = "MINIO_ROOT_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.minio[0].metadata[0].name
                key  = "access_key"
              }
            }
          }

          env {
            name = "MINIO_ROOT_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.minio[0].metadata[0].name
                key  = "secret_key"
              }
            }
          }

          readiness_probe {
            exec {
              command = ["mc", "ready", "local"]
            }
            period_seconds  = 5
            timeout_seconds = 5
          }

          volume_mount {
            name       = "data"
            mount_path = "/data"
          }
        }

        volume {
          name = "data"

          dynamic "empty_dir" {
            for_each = var.persistent_volumes ? [] : [1]
            content {}
          }

          dynamic "persistent_volume_claim" {
            for_each = var.persistent_volumes ? [1] : []
            content {
              claim_name = kubernetes_persistent_volume_claim_v1.minio[0].metadata[0].name
            }
          }
        }
      }
    }
  }
}

# Named s3 because that is the host the application settings already use for it.
resource "kubernetes_service_v1" "s3" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "s3"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    type     = var.api_node_port == null && var.console_node_port == null ? "ClusterIP" : "NodePort"
    selector = { app = "minio" }

    port {
      name        = "api"
      port        = 9000
      target_port = "api"
      node_port   = var.api_node_port
    }

    port {
      name        = "console"
      port        = 9001
      target_port = "console"
      node_port   = var.console_node_port
    }
  }
}

resource "kubernetes_job_v1" "init" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "minio-init"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    backoff_limit = 6

    template {
      metadata {
        labels = merge(var.labels, { app = "minio-init" })
      }

      spec {
        restart_policy = "OnFailure"

        container {
          name  = "mc"
          image = var.mc_image

          command = [
            "/bin/sh", "-c",
            <<-EOT
              until mc alias set my_minio http://s3:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do sleep 2; done
              mc mb --ignore-existing my_minio/${var.bucket}
              for file in ${local.seed_container}/**/*.png ${local.seed_container}/**/**/*.png; do
                [ -f "$file" ] && mc cp "$file" my_minio/${var.bucket}/covers/
              done
              mc anonymous set-json /policy/bucket-policy.json my_minio/${var.bucket}
              echo 'MinIO initialization complete!'
            EOT
          ]

          env {
            name = "MINIO_ROOT_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.minio[0].metadata[0].name
                key  = "access_key"
              }
            }
          }

          env {
            name = "MINIO_ROOT_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.minio[0].metadata[0].name
                key  = "secret_key"
              }
            }
          }

          volume_mount {
            name       = "policy"
            mount_path = "/policy"
            read_only  = true
          }

          dynamic "volume_mount" {
            for_each = var.seed_volume == null ? [] : [1]
            content {
              name       = "seed-data"
              mount_path = local.seed_container
              read_only  = true
            }
          }
        }

        volume {
          name = "policy"

          config_map {
            name = kubernetes_config_map_v1.bucket_policy[0].metadata[0].name
          }
        }

        dynamic "volume" {
          for_each = var.seed_volume == null ? [] : [1]
          content {
            name = "seed-data"

            dynamic "host_path" {
              for_each = var.seed_volume.host_path == null ? [] : [var.seed_volume.host_path]
              content {
                path = host_path.value
                type = "Directory"
              }
            }

            dynamic "persistent_volume_claim" {
              for_each = var.seed_volume.claim_name == null ? [] : [var.seed_volume.claim_name]
              content {
                claim_name = persistent_volume_claim.value
                read_only  = true
              }
            }
          }
        }
      }
    }
  }

  wait_for_completion = true

  timeouts {
    create = "5m"
  }

  depends_on = [kubernetes_deployment_v1.minio]
}
