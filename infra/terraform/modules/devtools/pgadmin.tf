locals {
  pgadmin_files = var.postgres == null ? {} : {
    "servers.json" = jsonencode({
      Servers = {
        "1" = {
          Group         = "Servers"
          Name          = "Smart Novel Database"
          Host          = var.postgres.host
          Port          = var.postgres.port
          MaintenanceDB = var.postgres.database
          Username      = var.postgres.username
          SSLMode       = "prefer"
          BGColor       = "#FF4500"
          FGColor       = "#222222"
        }
      }
    })
    "preferences.json" = jsonencode({
      preferences = {
        "misc:themes:theme"                           = "dark"
        "browser:display:show_system_objects"         = true
        "browser:display:confirm_on_refresh_close"    = false
        "browser:display:show_user_defined_templates" = true
      }
    })
  }
}

resource "kubernetes_secret_v1" "pgadmin" {
  count = var.postgres == null ? 0 : 1

  metadata {
    name      = "pgadmin"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    PGADMIN_DEFAULT_PASSWORD = var.pgadmin_password
  }
}

resource "kubernetes_config_map_v1" "pgadmin" {
  count = var.postgres == null ? 0 : 1

  metadata {
    name      = "pgadmin"
    namespace = var.namespace
    labels    = var.labels
  }

  data = local.pgadmin_files
}

resource "kubernetes_deployment_v1" "pgadmin" {
  count = var.postgres == null ? 0 : 1

  metadata {
    name      = "pgadmin"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "pgadmin" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "pgadmin" })
      }

      spec {
        container {
          name  = "pgadmin"
          image = var.pgadmin_image

          env {
            name  = "PGADMIN_DEFAULT_EMAIL"
            value = var.pgadmin_email
          }

          env {
            name = "PGADMIN_DEFAULT_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.pgadmin[0].metadata[0].name
                key  = "PGADMIN_DEFAULT_PASSWORD"
              }
            }
          }

          port {
            name           = "http"
            container_port = 80
          }

          dynamic "volume_mount" {
            for_each = keys(local.pgadmin_files)
            content {
              name       = "config"
              mount_path = "/pgadmin4/${volume_mount.value}"
              sub_path   = volume_mount.value
              read_only  = true
            }
          }

          readiness_probe {
            http_get {
              path = "/misc/ping"
              port = "http"
            }
            period_seconds    = 10
            failure_threshold = 12
          }
        }

        volume {
          name = "config"

          config_map {
            name = kubernetes_config_map_v1.pgadmin[0].metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "pgadmin" {
  count = var.postgres == null ? 0 : 1

  metadata {
    name      = "pgadmin"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    type     = var.node_ports.pgadmin == null ? "ClusterIP" : "NodePort"
    selector = { app = "pgadmin" }

    port {
      port        = 80
      target_port = "http"
      node_port   = var.node_ports.pgadmin
    }
  }
}
