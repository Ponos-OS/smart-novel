mock_provider "kubernetes" {}

variables {
  kubeconfig_path         = "/dev/null"
  domain                  = "novel.example.com"
  ingress_class           = "traefik"
  cluster_issuer          = "letsencrypt-prod"
  storage_class           = "local-path"
  otel_collector_endpoint = "http://otel-collector.observability:4318"
  images = {
    backend  = "ghcr.io/example/smart-novel-backend:1.4.0"
    frontend = "ghcr.io/example/smart-novel-frontend:1.4.0"
    beatrice = "9109679196/smart-novel-beatrice:5.0.0"
  }
  object_storage_endpoint = "https://0123456789abcdef.r2.cloudflarestorage.com"
  llm_base_url            = "https://api.openai.com/v1"
  llm_model               = "gpt-4o-mini"
  llm_api_key             = "sk-example"
  tts_base_url            = "https://api.openai.com/v1"
  tts_model               = "gpt-4o-mini-tts"
  tts_api_key             = "sk-example"
  migrate_image           = "ghcr.io/example/smart-novel-migrate:1.4.0"
  backup_endpoint         = "https://fsn1.your-objectstorage.com"
  backup_bucket           = "ponos-backups"
  backup_access_key       = "AKIAEXAMPLE"
  backup_secret_key       = "c2VjcmV0LWtleS1leGFtcGxl"
  postgres_password       = "7c1e0a9d4b2f6e83"
  redis_password          = "a41d9e07c3b85f26"
}

run "passes_the_contract_values_to_the_app_layer" {
  command = plan

  assert {
    condition     = output.url == "https://novel.example.com" && output.namespace == "smart-novel" && module.app.otlp_http_endpoint == "http://otel-collector.observability:4318"
    error_message = "the domain, namespace and collector endpoint must reach the app layer"
  }

  assert {
    condition     = module.app.object_storage_endpoint == "https://0123456789abcdef.r2.cloudflarestorage.com" && module.app.beatrice_url != null
    error_message = "R2 and the external LLM and TTS must replace the local components"
  }
}

run "the_dashboards_and_alert_rules_go_to_the_shared_grafana" {
  command = plan

  assert {
    condition     = toset(module.app.grafana_configmaps) == toset(["dashboard-smart-novel-rabbitmq", "alert-rules"])
    error_message = "the shared Grafana must receive the dashboard and the alert rules"
  }
}

run "without_the_zitadel_values_the_workloads_are_held_back" {
  command = plan

  assert {
    condition     = !module.app.workloads_enabled
    error_message = "the backend needs the client ID and token at startup"
  }
}

run "with_the_zitadel_values_the_workloads_run" {
  command = plan

  variables {
    zitadel_client_id = "312345678901234567"
    zitadel_pat       = "pat-example-token"
  }

  assert {
    condition     = module.app.workloads_enabled
    error_message = "the workloads must run once ZITADEL's values exist"
  }
}
