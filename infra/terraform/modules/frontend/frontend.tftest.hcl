mock_provider "kubernetes" {}

variables {
  namespace   = "smart-novel"
  image       = "smart-novel-frontend:1.4.0"
  environment = { VITE_SERVICE_URL = "http://localhost:8080" }
}

run "by_default_runs_the_image_as_is" {
  command = plan

  assert {
    condition     = length(kubernetes_config_map_v1.files) == 0 && length(kubernetes_deployment_v1.frontend[0].spec[0].template[0].spec[0].volume) == 0
    error_message = "nothing may be mounted by default"
  }

  assert {
    condition     = kubernetes_deployment_v1.frontend[0].spec[0].template[0].spec[0].container[0].command == null
    error_message = "the image's own command must run by default"
  }
}

run "files_are_mounted_by_path_from_a_config_map" {
  command = plan

  variables {
    command = ["/bin/sh", "/scripts/start.sh"]
    files   = { "/scripts/start.sh" = "exec npx nx serve frontend --host=0.0.0.0" }
  }

  assert {
    condition     = length(kubernetes_config_map_v1.files) == 1 && [for m in kubernetes_deployment_v1.frontend[0].spec[0].template[0].spec[0].container[0].volume_mount : m.mount_path] == ["/scripts/start.sh"]
    error_message = "each file must be mounted at its path"
  }

  assert {
    condition     = join(" ", kubernetes_deployment_v1.frontend[0].spec[0].template[0].spec[0].container[0].command) == "/bin/sh /scripts/start.sh"
    error_message = "the command must come from the input"
  }
}

run "mounts_exactly_the_given_volumes" {
  command = plan

  variables {
    volumes = [
      { name = "sources", mount_path = "/app/apps/frontend", host_path = "/workspace/apps/frontend" },
    ]
  }

  assert {
    condition     = [for v in kubernetes_deployment_v1.frontend[0].spec[0].template[0].spec[0].volume : v.name] == ["sources"]
    error_message = "every given volume must be declared"
  }
}

run "static_routes_target_the_frontend" {
  command = plan

  assert {
    condition     = one([for r in output.routes : r.path if r.name == "frontend-assets"]) == "/assets"
    error_message = "the static assets must be routed to the frontend"
  }

  assert {
    condition     = one([for r in output.routes : r.path if r.name == "frontend-web"]) == "/"
    error_message = "the catch-all route must be the root path"
  }
}
