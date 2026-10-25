locals {
  deploy = var.database_url == null
  init   = local.deploy && var.create_zitadel_database
}

resource "kubernetes_secret_v1" "postgres" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "postgres"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    password = var.password
  }
}

# Runs only on an empty data directory, which is what a throwaway local database always starts with.
resource "kubernetes_config_map_v1" "init" {
  count = local.init ? 1 : 0

  metadata {
    name      = "postgres-init"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    "zitadel.sql" = <<-EOT
      CREATE ROLE zitadel LOGIN PASSWORD '${replace(var.zitadel_password, "'", "''")}';
      CREATE DATABASE zitadel OWNER zitadel;
    EOT
  }
}

resource "kubernetes_persistent_volume_claim_v1" "postgres" {
  count = local.deploy && var.persistent_volumes ? 1 : 0

  metadata {
    name      = "postgres-data"
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

resource "kubernetes_deployment_v1" "postgres" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "postgres"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    strategy {
      type = "Recreate"
    }

    selector {
      match_labels = { app = "postgres" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "postgres" })
      }

      spec {
        container {
          name  = "postgres"
          image = var.image

          port {
            name           = "postgres"
            container_port = 5432
          }

          env {
            name  = "POSTGRES_DB"
            value = var.database
          }

          env {
            name  = "POSTGRES_USER"
            value = var.username
          }

          env {
            name = "POSTGRES_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.postgres[0].metadata[0].name
                key  = "password"
              }
            }
          }

          readiness_probe {
            exec {
              command = ["pg_isready", "-U", var.username, "-d", var.database]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }

          volume_mount {
            name       = "data"
            mount_path = "/var/lib/postgresql"
          }

          dynamic "volume_mount" {
            for_each = local.init ? [1] : []

            content {
              name       = "init"
              mount_path = "/docker-entrypoint-initdb.d"
              read_only  = true
            }
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
              claim_name = kubernetes_persistent_volume_claim_v1.postgres[0].metadata[0].name
            }
          }
        }

        dynamic "volume" {
          for_each = local.init ? [1] : []

          content {
            name = "init"

            config_map {
              name = kubernetes_config_map_v1.init[0].metadata[0].name
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "postgres" {
  count = local.deploy ? 1 : 0

  metadata {
    name      = "postgres"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "postgres" }

    port {
      port        = 5432
      target_port = "postgres"
    }
  }
}
