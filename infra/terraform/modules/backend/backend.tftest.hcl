mock_provider "kubernetes" {}

variables {
  namespace   = "smart-novel"
  image       = "smart-novel-backend:1.4.0"
  port        = 3000
  environment = { LOG_LEVEL = "http" }
  secret_environment = {
    DATABASE_URL = "postgresql://postgres:postgres@postgres:5432/smart_novel"
  }
}

run "mounts_exactly_the_given_volumes" {
  command = plan

  variables {
    volumes = [
      { name = "credentials", mount_path = "/zitadel-pat", claim_name = "zitadel-credentials", read_only = true },
      { name = "data", mount_path = "/data", host_path = "/workspace/apps/backend/data" },
    ]
  }

  assert {
    condition     = [for v in kubernetes_deployment_v1.backend[0].spec[0].template[0].spec[0].volume : v.name] == ["credentials", "data"]
    error_message = "every given volume must be declared"
  }

  assert {
    condition     = length(kubernetes_deployment_v1.backend[0].spec[0].template[0].spec[0].container[0].volume_mount) == 2
    error_message = "every given volume must be mounted"
  }
}

run "without_volumes_nothing_is_mounted" {
  command = plan

  assert {
    condition     = length(kubernetes_deployment_v1.backend[0].spec[0].template[0].spec[0].volume) == 0
    error_message = "a backend without volumes must mount nothing"
  }
}

run "the_port_reaches_the_container_and_the_routes" {
  command = plan

  variables {
    port = 4000
  }

  assert {
    condition     = one([for e in kubernetes_deployment_v1.backend[0].spec[0].template[0].spec[0].container[0].env : e.value if e.name == "PORT"]) == "4000"
    error_message = "the backend must listen on the given port"
  }

  assert {
    condition     = alltrue([for r in output.routes : endswith(r.service, ":4000")]) && contains([for r in output.routes : r.rule], "PathPrefix(`/graphql`)") && contains([for r in output.routes : r.rule], "PathPrefix(`/beatrice-callbacks`)")
    error_message = "the GraphQL and callback routes must target the given port"
  }
}

run "secrets_stay_out_of_the_pod_spec" {
  command = plan

  assert {
    condition     = length([for e in kubernetes_deployment_v1.backend[0].spec[0].template[0].spec[0].container[0].env : e if e.name == "DATABASE_URL"]) == 0
    error_message = "the database URL carries a password and must come from the secret"
  }
}
