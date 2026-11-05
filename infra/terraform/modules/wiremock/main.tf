locals {
  mapping_files = fileset(var.mappings_dir, "*.json")
}

resource "kubernetes_config_map_v1" "mappings" {
  metadata {
    name      = "${var.name}-mappings"
    namespace = var.namespace
    labels    = var.labels
  }

  data = { for file in local.mapping_files : file => file("${var.mappings_dir}/${file}") }
}

resource "kubernetes_deployment_v1" "wiremock" {
  metadata {
    name      = var.name
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = var.name }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = var.name })
      }

      spec {
        container {
          name  = var.name
          image = var.image

          port {
            name           = "http"
            container_port = 8080
          }

          volume_mount {
            name       = "mappings"
            mount_path = "/home/wiremock/mappings"
          }

          readiness_probe {
            http_get {
              path = "/__admin/mappings"
              port = "http"
            }
            period_seconds = 5
          }
        }

        volume {
          name = "mappings"

          config_map {
            name = kubernetes_config_map_v1.mappings.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "wiremock" {
  metadata {
    name      = var.name
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = var.name }

    port {
      port        = 8080
      target_port = "http"
    }
  }
}
