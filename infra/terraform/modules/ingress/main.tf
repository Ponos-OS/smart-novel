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

# The Ingress objects of the app are read through the Kubernetes Ingress provider, which needs read access to them. ZITADEL and the observability routes below come through the file provider, so no CRDs are needed.
resource "kubernetes_service_account_v1" "traefik" {
  metadata {
    name      = "traefik"
    namespace = var.namespace
    labels    = var.labels
  }
}

resource "kubernetes_role_v1" "traefik" {
  metadata {
    name      = "traefik"
    namespace = var.namespace
    labels    = var.labels
  }

  rule {
    api_groups = [""]
    resources  = ["services", "secrets", "configmaps"]
    verbs      = ["list", "watch"]
  }

  rule {
    api_groups = ["discovery.k8s.io"]
    resources  = ["endpointslices"]
    verbs      = ["list", "watch"]
  }

  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingresses"]
    verbs      = ["list", "watch"]
  }

  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingresses/status"]
    verbs      = ["update"]
  }
}

resource "kubernetes_role_binding_v1" "traefik" {
  metadata {
    name      = "traefik"
    namespace = var.namespace
    labels    = var.labels
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role_v1.traefik.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account_v1.traefik.metadata[0].name
    namespace = var.namespace
  }
}

# IngressClass is cluster-scoped, so this is the only cluster-wide permission.
resource "kubernetes_cluster_role_v1" "traefik" {
  metadata {
    name   = "${var.namespace}-traefik"
    labels = var.labels
  }

  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["ingressclasses"]
    verbs      = ["list", "watch"]
  }
}

resource "kubernetes_cluster_role_binding_v1" "traefik" {
  metadata {
    name   = "${var.namespace}-traefik"
    labels = var.labels
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role_v1.traefik.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account_v1.traefik.metadata[0].name
    namespace = var.namespace
  }
}

resource "kubernetes_ingress_class_v1" "traefik" {
  metadata {
    name   = var.ingress_class_name
    labels = var.labels
  }

  spec {
    controller = "traefik.io/ingress-controller"
  }
}

# Traefik reads this through its file provider.
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
        service_account_name = kubernetes_service_account_v1.traefik.metadata[0].name

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
            "--providers.kubernetesingress=true",
            "--providers.kubernetesingress.ingressclass=${var.ingress_class_name}",
            "--providers.kubernetesingress.namespaces=${var.namespace}",
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
