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
