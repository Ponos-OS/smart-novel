resource "kubernetes_secret_v1" "job" {
  metadata {
    name      = var.name
    namespace = var.namespace
    labels    = var.labels
  }

  data = var.secret_environment
}

resource "kubernetes_job_v1" "job" {
  metadata {
    name      = var.name
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    backoff_limit = var.backoff_limit

    template {
      metadata {
        labels = merge(var.labels, { app = var.name })
      }

      spec {
        restart_policy       = "OnFailure"
        enable_service_links = false

        container {
          name    = "job"
          image   = var.image
          command = var.command

          env_from {
            secret_ref {
              name = kubernetes_secret_v1.job.metadata[0].name
            }
          }

          dynamic "env" {
            for_each = var.environment
            content {
              name  = env.key
              value = env.value
            }
          }

          dynamic "volume_mount" {
            for_each = var.volumes
            content {
              name       = volume_mount.value.name
              mount_path = volume_mount.value.mount_path
              read_only  = volume_mount.value.read_only
            }
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

  wait_for_completion = true

  timeouts {
    create = var.timeout
  }
}
