mock_provider "kubernetes" {}
mock_provider "random" {}

variables {
  namespace     = "smart-novel"
  image         = "ghcr.io/zitadel/zitadel:v4.12.3"
  login_image   = "ghcr.io/zitadel/zitadel-login:v4.12.3"
  busybox_image = "busybox:1.37"
}

run "server_environment_contains_the_external_port_from_the_input" {
  command = plan

  variables {
    external_port = 8080
  }

  assert {
    condition = contains(
      [for env in kubernetes_deployment_v1.zitadel.spec[0].template[0].spec[0].container[0].env : "${env.name}=${env.value}" if env.value != null],
      "ZITADEL_EXTERNALPORT=8080",
    )
    error_message = "ZITADEL must be told the port it is reached on from the browser"
  }

  assert {
    condition = contains(
      [for env in kubernetes_deployment_v1.zitadel.spec[0].template[0].spec[0].container[0].env : "${env.name}=${env.value}" if env.value != null],
      "ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_BASEURI=http://localhost:8080/ui/v2/login/",
    )
    error_message = "the login UI base URI must use the external domain and port"
  }
}

run "another_external_port_reaches_the_forwarded_host_header" {
  command = plan

  variables {
    external_port = 9090
  }

  assert {
    condition     = output.middlewares["zitadel-fwd"].custom_request_headers["X-Forwarded-Host"] == "localhost:9090"
    error_message = "the forwarded host must follow the external port"
  }
}

run "contributes_the_zitadel_and_login_routes" {
  command = plan

  assert {
    condition     = [for route in output.routes : route.name] == ["zitadel-web", "zitadel-login-web"]
    error_message = "the module must contribute both routes"
  }

  assert {
    condition     = output.routes[0].service == "h2c://zitadel:8080" && output.routes[0].priority < output.routes[1].priority
    error_message = "ZITADEL is served over h2c and the login UI wins over its catch-all routes"
  }
}

run "the_readiness_probe_allows_a_slow_host" {
  command = plan

  assert {
    condition     = kubernetes_deployment_v1.zitadel.spec[0].template[0].spec[0].container[0].readiness_probe[0].timeout_seconds >= 5
    error_message = "zitadel ready takes more than the default 1 second on a busy machine, and a probe that always times out keeps ZITADEL unready"
  }
}
