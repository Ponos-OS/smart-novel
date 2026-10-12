locals {
  dynamic_config = {
    http = {
      routers = {
        for route in var.routes : route.name => merge(
          {
            rule        = route.rule
            entryPoints = ["web"]
            service     = route.name
            priority    = route.priority
          },
          length(route.middlewares) > 0 ? { middlewares = route.middlewares } : {},
        )
      }
      services = {
        for route in var.routes : route.name => {
          loadBalancer = { servers = [{ url = route.service }] }
        }
      }
      middlewares = {
        for name, middleware in var.middlewares : name => {
          headers = { customRequestHeaders = middleware.custom_request_headers }
        }
      }
    }
  }
  dynamic_config_yaml = yamlencode(local.dynamic_config)
}

# Traefik reads this through its file provider, so it needs no Kubernetes API access and no CRDs.
resource "kubernetes_config_map_v1" "dynamic" {
  metadata {
    name      = "traefik-dynamic"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    "routes.yml" = local.dynamic_config_yaml
  }
}

resource "kubernetes_deployment_v1" "traefik" {
  metadata {
    name      = "traefik"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "traefik" }
    }

    template {
      metadata {
        labels = merge(var.labels, { app = "traefik" })

        annotations = {
          "checksum/routes" = sha256(local.dynamic_config_yaml)
        }
      }

      spec {
        # The kind node that maps the host port carries this label; hostPort 80 is what that mapping reaches.
        node_selector = { "ingress-ready" = "true" }

        toleration {
          key      = "node-role.kubernetes.io/control-plane"
          operator = "Exists"
          effect   = "NoSchedule"
        }

        container {
          name  = "traefik"
          image = var.image

          args = [
            "--providers.file.directory=/etc/traefik/dynamic",
            "--providers.file.watch=true",
            "--entrypoints.web.address=:80",
            "--api.dashboard=false",
            "--api.insecure=false",
            "--ping=true",
            "--log.level=INFO",
            "--accesslog=true",
          ]

          port {
            name           = "web"
            container_port = 80
            host_port      = 80
          }

          readiness_probe {
            http_get {
              path = "/ping"
              port = 8080
            }
            period_seconds = 5
          }

          volume_mount {
            name       = "dynamic"
            mount_path = "/etc/traefik/dynamic"
            read_only  = true
          }
        }

        volume {
          name = "dynamic"

          config_map {
            name = kubernetes_config_map_v1.dynamic.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "traefik" {
  metadata {
    name      = "traefik"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = { app = "traefik" }

    port {
      port        = 80
      target_port = "web"
    }
  }
}
