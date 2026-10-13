mock_provider "kubernetes" {}

variables {
  namespace = "smart-novel"
  labels    = { Project = "smart-novel" }
  images = {
    postgres       = "postgres:18.2-bookworm"
    redis          = "redis:8.6-alpine3.23"
    minio          = "quay.io/minio/minio:RELEASE.2025-04-08T15-41-24Z"
    minio_mc       = "quay.io/minio/mc:RELEASE.2025-04-08T15-39-49Z"
    traefik        = "traefik:v3.6.8"
    zitadel        = "ghcr.io/zitadel/zitadel:v4.12.3"
    zitadel_login  = "ghcr.io/zitadel/zitadel-login:v4.12.3"
    busybox        = "busybox:1.37"
    rabbitmq       = "rabbitmq:3.13-management-alpine"
    beatrice       = "9109679196/smart-novel-beatrice:4.1.0"
    ollama         = "smart-novel-ollama:dev"
    qwen_tts       = "smart-novel-qwen-tts:dev"
    otel_collector = "otel/opentelemetry-collector-contrib:0.110.0"
    jaeger         = "jaegertracing/all-in-one:1.62.0"
    setup_zitadel  = "smart-novel-setup-zitadel:dev"
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
    condition     = length(module.ollama) == 1 && length(module.qwen_tts) == 1 && length(module.rabbitmq) == 1 && output.beatrice_url == "http://beatrice:3000/graphql"
    error_message = "ollama, qwen-tts, rabbitmq and beatrice must be deployed by default"
  }
}

run "disabling_ai_without_endpoints_skips_beatrice_and_rabbitmq" {
  command = plan

  variables {
    enable_ai = false
  }

  assert {
    condition     = length(module.ollama) == 0 && length(module.qwen_tts) == 0 && length(module.beatrice) == 0 && length(module.rabbitmq) == 0
    error_message = "without the AI components or external endpoints nothing of the pipeline must remain"
  }
}

run "disabling_ai_with_external_endpoints_keeps_beatrice" {
  command = plan

  variables {
    enable_ai    = false
    llm_base_url = "https://api.openai.com/v1"
    tts_base_url = "https://dashscope-intl.aliyuncs.com"
  }

  assert {
    condition     = length(module.ollama) == 0 && length(module.qwen_tts) == 0 && length(module.beatrice) == 1 && length(module.rabbitmq) == 1
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
