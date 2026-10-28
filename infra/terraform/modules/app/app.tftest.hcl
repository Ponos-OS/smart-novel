mock_provider "kubernetes" {}

variables {
  namespace = "smart-novel"
  labels    = { Project = "smart-novel" }
  images = {
    postgres              = "postgres:18.2-bookworm"
    redis                 = "redis:8.6-alpine3.23"
    object_storage        = "rustfs/rustfs:1.0.1"
    aws_cli               = "amazon/aws-cli:2.38.1"
    rabbitmq              = "rabbitmq:3.13-management-alpine"
    beatrice              = "9109679196/smart-novel-beatrice:5.0.0"
    ollama                = "smart-novel-ollama:dev"
    openai_compatible_tts = "smart-novel-openai-compatible-tts:dev"
    backend               = "smart-novel-backend:1.4.0"
    frontend              = "smart-novel-frontend:1.4.0"
    redis_insight         = "redis/redisinsight:2.70.1"
    pgadmin               = "dpage/pgadmin4:8.4"
    open_webui            = "ghcr.io/open-webui/open-webui:v0.8.0"
  }
}

run "deploys_into_the_given_namespace" {
  command = plan

  assert {
    condition     = module.namespace.name == "smart-novel"
    error_message = "the app module must create the namespace it is given"
  }
}

run "deploys_every_data_component_by_default" {
  command = plan

  assert {
    condition     = length(module.postgres.database_url) > 0 && length(module.redis.redis_url) > 0 && module.object_storage.endpoint == "http://s3:9000"
    error_message = "postgres, redis and object storage must be deployed when no external service is given"
  }
}

run "serves_backend_and_frontend_through_one_ingress" {
  command = plan

  assert {
    condition     = kubernetes_ingress_v1.app.spec[0].ingress_class_name == "traefik" && length(kubernetes_ingress_v1.app.spec[0].rule[0].http[0].path) == 4
    error_message = "one Ingress of the given class must carry the backend and frontend routes"
  }

  assert {
    condition     = length(kubernetes_ingress_v1.app.spec[0].tls) == 0 && length(kubernetes_ingress_v1.app.metadata[0].annotations) == 0
    error_message = "without an issuer the Ingress serves plain HTTP"
  }
}

run "a_host_and_an_issuer_turn_on_tls" {
  command = plan

  variables {
    ingress_class_name = "traefik"
    ingress_host       = "novel.example.com"
    cluster_issuer     = "letsencrypt-prod"
  }

  assert {
    condition     = kubernetes_ingress_v1.app.spec[0].rule[0].host == "novel.example.com" && contains(tolist(kubernetes_ingress_v1.app.spec[0].tls[0].hosts), "novel.example.com") && kubernetes_ingress_v1.app.metadata[0].annotations["cert-manager.io/cluster-issuer"] == "letsencrypt-prod"
    error_message = "the host must get a certificate from the given issuer"
  }
}

run "tracing_follows_the_otlp_endpoint" {
  command = plan

  variables {
    otlp_endpoint = "http://otel-collector.observability:4318"
  }

  assert {
    condition     = output.otlp_http_endpoint == "http://otel-collector.observability:4318"
    error_message = "the given OTLP endpoint must be the one the workloads export to"
  }
}

run "tracing_is_off_without_an_otlp_endpoint" {
  command = plan

  assert {
    condition     = output.otlp_http_endpoint == null
    error_message = "nothing is exported unless an endpoint is given"
  }
}

run "deploys_ai_and_beatrice_by_default" {
  command = plan

  assert {
    condition     = length(module.ollama) == 1 && length(module.openai_compatible_tts) == 1 && length(module.rabbitmq) == 1 && output.beatrice_url == "http://beatrice:3000/graphql"
    error_message = "ollama, openai-compatible-tts, rabbitmq and beatrice must be deployed by default"
  }
}

run "disabling_ai_without_endpoints_skips_beatrice_and_rabbitmq" {
  command = plan

  variables {
    run_local_ai_models = false
  }

  assert {
    condition     = length(module.ollama) == 0 && length(module.openai_compatible_tts) == 0 && length(module.beatrice) == 0 && length(module.rabbitmq) == 0
    error_message = "without the AI components or external endpoints nothing of the pipeline must remain"
  }
}

run "disabling_ai_with_external_endpoints_keeps_beatrice" {
  command = plan

  variables {
    run_local_ai_models = false
    llm_base_url        = "https://api.openai.com/v1"
    tts_base_url        = "https://api.openai.com/v1"
  }

  assert {
    condition     = length(module.ollama) == 0 && length(module.openai_compatible_tts) == 0 && length(module.beatrice) == 1 && length(module.rabbitmq) == 1
    error_message = "Beatrice must run against the external endpoints"
  }
}

run "broker_url_skips_rabbitmq_only" {
  command = plan

  variables {
    broker_url = "amqps://smart-novel:3c9a1f0e7b2d@b-93fec4bf-2f66.mq.eu-central-1.amazonaws.com:5671"
  }

  assert {
    condition     = output.beatrice_url != null
    error_message = "Beatrice must still be deployed with an external broker"
  }
}

run "the_frontend_serves_on_port_80_by_default" {
  command = plan

  assert {
    condition     = alltrue([for r in module.frontend.routes : r.service_port == 80])
    error_message = "the frontend routes must target port 80 by default"
  }
}

run "the_frontend_port_is_configurable" {
  command = plan

  variables {
    frontend_port = 4300
  }

  assert {
    condition     = alltrue([for r in module.frontend.routes : r.service_port == 4300]) && module.backend.internal_url == "http://backend:3000"
    error_message = "the frontend routes must target the given port and the backend must be reachable by its service name"
  }
}

run "no_pre_deploy_jobs_by_default" {
  command = plan

  assert {
    condition     = length(module.pre_deploy_job) == 0
    error_message = "nothing runs before the deployments unless asked to"
  }
}

run "pre_deploy_jobs_are_created_from_their_specs" {
  command = plan

  variables {
    pre_deploy_jobs = [
      {
        name                    = "backend-init"
        image                   = "smart-novel-backend:dev"
        command                 = ["/bin/sh", "-c", "npx nx run backend:prisma:db:push"]
        use_backend_environment = true
        volumes                 = [{ name = "data", mount_path = "/data", host_path = "/workspace/apps/backend/data" }]
      },
      {
        name    = "frontend-codegen"
        image   = "smart-novel-backend:dev"
        command = ["/bin/sh", "-c", "npx nx codegen frontend"]
      },
    ]
  }

  assert {
    condition     = toset(keys(module.pre_deploy_job)) == toset(["backend-init", "frontend-codegen"])
    error_message = "each spec must become a Job"
  }
}

run "devtools_are_off_by_default" {
  command = plan

  assert {
    condition     = length(module.devtools) == 0
    error_message = "devtools must not be deployed unless asked for"
  }
}

run "devtools_are_deployed_when_enabled" {
  command = plan

  variables {
    enable_devtools = true
  }

  assert {
    condition     = length(module.devtools) == 1
    error_message = "enable_devtools must deploy the devtools module"
  }
}

run "workloads_are_deployed_by_default" {
  command = plan

  assert {
    condition     = module.backend.enabled && module.frontend.enabled
    error_message = "the backend and the frontend must be deployed by default"
  }
}

run "without_workloads_only_the_infrastructure_remains" {
  command = plan

  variables {
    wait_for_zitadel_credentials = true
    pre_deploy_jobs = [
      {
        name    = "backend-init"
        image   = "smart-novel-backend:dev"
        command = ["/bin/sh", "-c", "npx nx run backend:prisma:db:push"]
      },
    ]
  }

  assert {
    condition     = !module.backend.enabled && !module.frontend.enabled && length(module.pre_deploy_job) == 0
    error_message = "nothing that needs the generated credentials may remain"
  }
}

run "a_password_protects_the_in_cluster_stores" {
  command = plan

  variables {
    postgres_password = "7c1e0a9d4b2f6e83"
    redis_password    = "a41d9e07c3b85f26"
  }

  assert {
    condition     = nonsensitive(strcontains(module.postgres.database_url, "7c1e0a9d4b2f6e83") && strcontains(module.redis.redis_url, "a41d9e07c3b85f26"))
    error_message = "the given passwords must protect PostgreSQL and Redis"
  }
}

run "no_grafana_configmaps_by_default" {
  command = plan

  assert {
    condition     = length(kubernetes_config_map_v1.shared_dashboard) == 0 && length(kubernetes_config_map_v1.shared_alert_rules) == 0
    error_message = "a stack with its own Grafana must not ship ConfigMaps for another one"
  }
}

run "the_dashboards_and_alert_rules_are_published_for_a_shared_grafana" {
  command = plan

  variables {
    publish_grafana_configmaps = true
  }

  assert {
    condition     = toset(keys(kubernetes_config_map_v1.shared_dashboard)) == toset(["smart-novel-rabbitmq.json"]) && kubernetes_config_map_v1.shared_dashboard["smart-novel-rabbitmq.json"].metadata[0].labels["grafana_dashboard"] == "1" && kubernetes_config_map_v1.shared_dashboard["smart-novel-rabbitmq.json"].metadata[0].namespace == "smart-novel"
    error_message = "the dashboard must be a ConfigMap labelled grafana_dashboard=1 in the app's namespace"
  }

  assert {
    condition     = kubernetes_config_map_v1.shared_alert_rules[0].metadata[0].labels["grafana_alert"] == "1" && kubernetes_config_map_v1.shared_alert_rules[0].metadata[0].namespace == "smart-novel" && toset(keys(kubernetes_config_map_v1.shared_alert_rules[0].data)) == toset(["smart-novel-alert-rules.yaml"])
    error_message = "the alert rules must be a ConfigMap labelled grafana_alert=1 in the app's namespace"
  }
}

run "routes_the_in_cluster_tools_by_host" {
  command = plan

  assert {
    condition     = contains([for route in output.tool_routes : route.rule], "Host(`s3.localhost`)") && contains([for route in output.tool_routes : route.rule], "Host(`s3-console.localhost`)")
    error_message = "the S3 API and the console must be routed"
  }
}
