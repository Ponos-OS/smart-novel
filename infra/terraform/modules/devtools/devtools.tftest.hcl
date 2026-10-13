mock_provider "kubernetes" {}

variables {
  namespace           = "smart-novel"
  redis_insight_image = "redis/redisinsight:2.70.1"
  pgadmin_image       = "dpage/pgadmin4:8.4"
  open_webui_image    = "ghcr.io/open-webui/open-webui:v0.8.0"
}

run "nothing_is_created_without_anything_to_inspect" {
  command = plan

  assert {
    condition     = length(kubernetes_deployment_v1.redis_insight) == 0 && length(kubernetes_deployment_v1.pgadmin) == 0 && length(kubernetes_deployment_v1.open_webui) == 0
    error_message = "a tool must not be deployed without the service it inspects"
  }
}

run "each_tool_follows_the_service_it_inspects" {
  command = plan

  variables {
    redis           = { host = "redis", port = 6379 }
    postgres        = { host = "postgres", port = 5432, database = "smart_novel", username = "postgres" }
    ollama_base_url = "http://ollama:11434"
  }

  assert {
    condition     = length(kubernetes_deployment_v1.redis_insight) == 1 && length(kubernetes_deployment_v1.pgadmin) == 1 && length(kubernetes_deployment_v1.open_webui) == 1
    error_message = "every tool must be deployed when its service is given"
  }

  assert {
    condition     = jsondecode(kubernetes_config_map_v1.pgadmin[0].data["servers.json"]).Servers["1"].MaintenanceDB == "smart_novel"
    error_message = "pgAdmin must be registered with the application database"
  }
}

run "node_ports_expose_only_the_tools_that_get_one" {
  command = plan

  variables {
    redis      = { host = "redis", port = 6379 }
    postgres   = { host = "postgres", port = 5432, database = "smart_novel", username = "postgres" }
    node_ports = { redis_insight = 30540 }
  }

  assert {
    condition     = kubernetes_service_v1.redis_insight[0].spec[0].type == "NodePort" && kubernetes_service_v1.pgadmin[0].spec[0].type == "ClusterIP"
    error_message = "only a tool with a node port may be exposed"
  }
}

run "the_pgadmin_password_stays_in_a_secret" {
  command = plan

  variables {
    postgres = { host = "postgres", port = 5432, database = "smart_novel", username = "postgres" }
  }

  assert {
    condition     = length([for e in kubernetes_deployment_v1.pgadmin[0].spec[0].template[0].spec[0].container[0].env : e if e.name == "PGADMIN_DEFAULT_PASSWORD" && e.value != null]) == 0
    error_message = "the password must come from the secret, not the pod spec"
  }
}
