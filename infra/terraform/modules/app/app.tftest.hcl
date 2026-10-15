mock_provider "kubernetes" {}

variables {
  namespace = "smart-novel"
  labels    = { Project = "smart-novel" }
  images = {
    postgres              = "postgres:18.2-bookworm"
    redis                 = "redis:8.6-alpine3.23"
    minio                 = "quay.io/minio/minio:RELEASE.2025-04-08T15-41-24Z"
    minio_mc              = "quay.io/minio/mc:RELEASE.2025-04-08T15-39-49Z"
    traefik               = "traefik:v3.6.8"
    zitadel               = "ghcr.io/zitadel/zitadel:v4.12.3"
    zitadel_login         = "ghcr.io/zitadel/zitadel-login:v4.12.3"
    busybox               = "busybox:1.37"
    rabbitmq              = "rabbitmq:3.13-management-alpine"
    beatrice              = "9109679196/smart-novel-beatrice:5.0.0"
    ollama                = "smart-novel-ollama:dev"
    openai_compatible_tts = "smart-novel-openai-compatible-tts:dev"
    backend               = "smart-novel-backend:1.4.0"
    frontend              = "smart-novel-frontend:1.4.0"
    redis_insight         = "redis/redisinsight:2.70.1"
    pgadmin               = "dpage/pgadmin4:8.4"
    open_webui            = "ghcr.io/open-webui/open-webui:v0.8.0"
    otel_collector        = "otel/opentelemetry-collector-contrib:0.110.0"
    jaeger                = "jaegertracing/all-in-one:1.62.0"
    setup_zitadel         = "smart-novel-setup-zitadel:dev"
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
    condition     = length(module.postgres.database_url) > 0 && length(module.redis.redis_url) > 0 && module.minio.endpoint == "http://s3:9000"
    error_message = "postgres, redis and minio must be deployed when no external service is given"
  }
}

run "routes_the_zitadel_endpoints_through_the_ingress" {
  command = plan

  assert {
    condition     = strcontains(module.ingress.internal_url, "traefik") && length(module.zitadel.routes) == 2
    error_message = "the ingress must be wired with the routes the zitadel module contributes"
  }
}

run "deploys_observability_by_default" {
  command = plan

  assert {
    condition     = length(module.observability) == 1 && output.otlp_http_endpoint == "http://otel-collector:4318"
    error_message = "the collector and Jaeger must be deployed by default"
  }
}

run "disabling_observability_deploys_neither" {
  command = plan

  variables {
    enable_observability = false
  }

  assert {
    condition     = length(module.observability) == 0 && output.otlp_http_endpoint == null
    error_message = "nothing observability related must remain when it is disabled"
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
    enable_ai = false
  }

  assert {
    condition     = length(module.ollama) == 0 && length(module.openai_compatible_tts) == 0 && length(module.beatrice) == 0 && length(module.rabbitmq) == 0
    error_message = "without the AI components or external endpoints nothing of the pipeline must remain"
  }
}

run "disabling_ai_with_external_endpoints_keeps_beatrice" {
  command = plan

  variables {
    enable_ai    = false
    llm_base_url = "https://api.openai.com/v1"
    tts_base_url = "https://api.openai.com/v1"
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
    condition     = alltrue([for r in module.frontend.routes : endswith(r.service, ":80")])
    error_message = "the frontend routes must target port 80 by default"
  }
}

run "the_frontend_port_is_configurable" {
  command = plan

  variables {
    frontend_port = 4300
  }

  assert {
    condition     = alltrue([for r in module.frontend.routes : endswith(r.service, ":4300")]) && module.backend.internal_url == "http://backend:3000"
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
        volumes                 = [{ name = "credentials", mount_path = "/zitadel-pat", zitadel_credentials = true }]
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
    condition     = length(module.zitadel_setup) == 1 && module.backend.enabled && module.frontend.enabled
    error_message = "the backend, the frontend and the setup must be deployed by default"
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
    condition     = length(module.zitadel_setup) == 0 && !module.backend.enabled && !module.frontend.enabled && length(module.pre_deploy_job) == 0 && output.zitadel_credentials == null
    error_message = "nothing that needs the generated credentials may remain"
  }

  assert {
    condition     = length(module.zitadel.routes) == 2 && length(module.ingress.internal_url) > 0
    error_message = "ZITADEL must stay reachable through the ingress"
  }
}
