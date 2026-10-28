locals {
  deploy         = var.object_storage_endpoint == null
  seed_container = "/source-data"
}

resource "kubernetes_secret_v1" "object_storage" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "object-storage"
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
    name      = "object-storage-bucket-policy"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    "bucket-policy.json" = templatefile("${path.module}/bucket-policy.json.tftpl", { bucket = var.bucket })
    "bucket-cors.json"   = templatefile("${path.module}/bucket-cors.json.tftpl", { origins = var.cors_allowed_origins })
  }
}

resource "kubernetes_persistent_volume_claim_v1" "object_storage" {
  count = local.deploy && var.persistent_volumes ? 1 : 0

  metadata {
    name      = "object-storage-data"
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

resource "kubernetes_deployment_v1" "object_storage" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "object-storage"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    strategy {
      type = "Recreate"
    }

    selector {
      match_labels = { app = "object-storage" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "object-storage" })
      }

      spec {
        container {
          name  = "object-storage"
          image = var.image

          port {
            name           = "api"
            container_port = 9000
          }

          port {
            name           = "console"
            container_port = 9001
          }

          env {
            name = "RUSTFS_ACCESS_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.object_storage[0].metadata[0].name
                key  = "access_key"
              }
            }
          }

          env {
            name = "RUSTFS_SECRET_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.object_storage[0].metadata[0].name
                key  = "secret_key"
              }
            }
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = "api"
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
              claim_name = kubernetes_persistent_volume_claim_v1.object_storage[0].metadata[0].name
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
    type     = "ClusterIP"
    selector = { app = "object-storage" }

    port {
      name        = "api"
      port        = 9000
      target_port = "api"
    }

    port {
      name        = "console"
      port        = 9001
      target_port = "console"
    }
  }
}

resource "kubernetes_job_v1" "init" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "object-storage-init"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    backoff_limit = 6

    template {
      metadata {
        labels = merge(var.labels, { app = "object-storage-init" })
      }

      spec {
        restart_policy = "OnFailure"

        container {
          name  = "aws-cli"
          image = var.aws_cli_image

          command = [
            "/bin/sh", "-c",
            <<-EOT
              until aws --endpoint-url http://s3:9000 s3api list-buckets; do sleep 2; done
              aws --endpoint-url http://s3:9000 s3api head-bucket --bucket ${var.bucket} 2>/dev/null ||
                aws --endpoint-url http://s3:9000 s3 mb s3://${var.bucket}
              for file in ${local.seed_container}/**/*.png ${local.seed_container}/**/**/*.png; do
                [ -f "$file" ] && aws --endpoint-url http://s3:9000 s3 cp "$file" s3://${var.bucket}/covers/
              done
              aws --endpoint-url http://s3:9000 s3api put-bucket-policy --bucket ${var.bucket} --policy file:///policy/bucket-policy.json
              aws --endpoint-url http://s3:9000 s3api put-bucket-cors --bucket ${var.bucket} --cors-configuration file:///policy/bucket-cors.json
              echo 'Object storage initialization complete!'
            EOT
          ]

          env {
            name  = "AWS_DEFAULT_REGION"
            value = "us-east-1"
          }

          env {
            name = "AWS_ACCESS_KEY_ID"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.object_storage[0].metadata[0].name
                key  = "access_key"
              }
            }
          }

          env {
            name = "AWS_SECRET_ACCESS_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.object_storage[0].metadata[0].name
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

  depends_on = [kubernetes_deployment_v1.object_storage]
}
