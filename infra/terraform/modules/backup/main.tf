locals {
  stamp_format = {
    daily   = "%Y-%m-%dT%H-%MZ"
    monthly = "%Y-%m"
  }
  schedule = {
    daily   = var.daily_schedule
    monthly = var.monthly_schedule
  }
}

resource "kubernetes_secret_v1" "backup" {
  metadata {
    name      = "backup"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    DATABASE_URL          = var.database_url
    AWS_ACCESS_KEY_ID     = var.access_key
    AWS_SECRET_ACCESS_KEY = var.secret_key
  }
}

# Keys follow infra/docs/backups.md: <daily|monthly>/<project>/<database>/<stamp>.dump, a new key per run.
resource "kubernetes_cron_job_v1" "backup" {
  for_each = local.schedule

  metadata {
    name      = "backup-${each.key}"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    schedule                      = each.value
    concurrency_policy            = "Forbid"
    successful_jobs_history_limit = 1
    failed_jobs_history_limit     = 3

    job_template {
      metadata {
        labels = var.labels
      }

      spec {
        backoff_limit = 2

        template {
          metadata {
            labels = merge(var.labels, { app = "backup-${each.key}" })
          }

          spec {
            restart_policy       = "OnFailure"
            enable_service_links = false

            init_container {
              name    = "dump"
              image   = var.postgres_image
              command = ["/bin/sh", "-c", "pg_dump --format=custom --file=/backup/dump \"$DATABASE_URL\""]

              env_from {
                secret_ref {
                  name = kubernetes_secret_v1.backup.metadata[0].name
                }
              }

              volume_mount {
                name       = "backup"
                mount_path = "/backup"
              }
            }

            container {
              name  = "upload"
              image = var.aws_cli_image
              command = [
                "/bin/sh", "-c",
                "aws s3 cp /backup/dump \"s3://${var.bucket}/${each.key}/${var.project}/${var.database_name}/$(date -u +${local.stamp_format[each.key]}).dump\" --endpoint-url ${var.endpoint}",
              ]

              env {
                name  = "AWS_DEFAULT_REGION"
                value = var.region
              }

              env_from {
                secret_ref {
                  name = kubernetes_secret_v1.backup.metadata[0].name
                }
              }

              volume_mount {
                name       = "backup"
                mount_path = "/backup"
              }
            }

            volume {
              name = "backup"

              empty_dir {}
            }
          }
        }
      }
    }
  }
}
