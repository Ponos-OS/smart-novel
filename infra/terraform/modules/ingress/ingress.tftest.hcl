mock_provider "kubernetes" {}

variables {
  namespace = "smart-novel"
  image     = "traefik:v3.6.8"
}

run "contributed_routes_appear_in_the_dynamic_config" {
  command = plan

  variables {
    routes = [
      {
        name     = "backend-web"
        rule     = "PathPrefix(`/graphql`)"
        priority = 300
        service  = "http://backend:3000"
      },
      {
        name        = "zitadel-web"
        rule        = "PathPrefix(`/oidc`)"
        priority    = 100
        service     = "h2c://zitadel:8080"
        middlewares = ["zitadel-fwd"]
      },
    ]
    middlewares = {
      zitadel-fwd = {
        custom_request_headers = { "X-Forwarded-Proto" = "http" }
      }
    }
  }

  assert {
    condition     = yamldecode(kubernetes_config_map_v1.dynamic.data["routes.yml"]).http.routers["backend-web"].priority == 300 && yamldecode(kubernetes_config_map_v1.dynamic.data["routes.yml"]).http.services["zitadel-web"].loadBalancer.servers[0].url == "h2c://zitadel:8080"
    error_message = "every contributed route and its service must be in the dynamic config"
  }

  assert {
    condition     = yamldecode(kubernetes_config_map_v1.dynamic.data["routes.yml"]).http.middlewares["zitadel-fwd"].headers.customRequestHeaders["X-Forwarded-Proto"] == "http"
    error_message = "the middleware headers must be in the dynamic config"
  }
}

run "without_routes_the_dynamic_config_has_none" {
  command = plan

  assert {
    condition     = length(yamldecode(kubernetes_config_map_v1.dynamic.data["routes.yml"]).http.routers) == 0
    error_message = "no routes are registered unless a module contributes one"
  }
}

run "serves_the_ingress_class_through_the_kubernetes_provider" {
  command = plan

  variables {
    ingress_class_name = "smart-novel"
  }

  assert {
    condition     = kubernetes_ingress_class_v1.traefik.metadata[0].name == "smart-novel" && contains(kubernetes_deployment_v1.traefik.spec[0].template[0].spec[0].container[0].args, "--providers.kubernetesingress.ingressclass=smart-novel")
    error_message = "Traefik must watch the Ingress objects of its class"
  }
}

run "only_ingress_classes_and_nodes_are_read_cluster_wide" {
  command = plan

  assert {
    condition     = toset(flatten([for rule in kubernetes_cluster_role_v1.traefik.rule : tolist(rule.resources)])) == toset(["ingressclasses", "nodes"])
    error_message = "everything but the cluster-scoped IngressClass and Node must be granted inside the namespace; without Node access the Ingress provider never syncs"
  }
}
