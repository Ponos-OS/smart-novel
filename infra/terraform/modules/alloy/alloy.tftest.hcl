mock_provider "kubernetes" {}

variables {
  namespace = "smart-novel"
  image     = "grafana/alloy:v1.21.3"
}

run "ships_the_apps_stdout_to_loki" {
  command = plan

  assert {
    condition     = strcontains(kubernetes_config_map_v1.alloy.data["config.alloy"], "regex         = \"backend|beatrice|fithara\"")
    error_message = "only the app pods' logs must be shipped"
  }

  assert {
    condition     = strcontains(kubernetes_config_map_v1.alloy.data["config.alloy"], "url = \"http://loki:3100/loki/api/v1/push\"")
    error_message = "logs must be pushed to Loki"
  }
}

run "reads_logs_only_from_its_namespace" {
  command = plan

  assert {
    condition     = strcontains(kubernetes_config_map_v1.alloy.data["config.alloy"], "names = [\"smart-novel\"]")
    error_message = "pods of other namespaces must not be discovered"
  }
}

run "the_apps_are_configurable" {
  command = plan

  variables {
    apps = ["fithara"]
  }

  assert {
    condition     = strcontains(kubernetes_config_map_v1.alloy.data["config.alloy"], "regex         = \"fithara\"")
    error_message = "the app list must come from apps"
  }
}

run "its_access_is_limited_to_its_namespace" {
  command = plan

  assert {
    condition     = kubernetes_role_v1.alloy.metadata[0].namespace == "smart-novel" && kubernetes_role_binding_v1.alloy.role_ref[0].kind == "Role"
    error_message = "Alloy must get a namespaced Role, never a ClusterRole"
  }
}
