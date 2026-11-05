mock_provider "kubernetes" {
  mock_data "kubernetes_secret_v1" {
    defaults = {
      data = { jwt_profile_json = "{\"type\":\"serviceaccount\",\"keyId\":\"312345678901234567\"}" }
    }
  }
}

mock_provider "zitadel" {}

variables {
  kubeconfig_path         = "/dev/null"
  zitadel_domain          = "auth.novel.example.com"
  zitadel_pat             = "pat-example-token"
  domain                  = "novel.example.com"
  ingress_class           = "traefik"
  cluster_issuer          = "letsencrypt-prod"
  storage_class           = "local-path"
  otel_collector_endpoint = "http://otel-collector.observability:4318"
  images = {
    backend  = "ghcr.io/example/smart-novel-backend:1.4.0"
    frontend = "ghcr.io/example/smart-novel-frontend:1.4.0"
    beatrice = "9109679196/smart-novel-beatrice:5.0.0"
    fithara  = "9109679196/fithara:2.3.0"
  }
  object_storage_endpoint = "https://0123456789abcdef.r2.cloudflarestorage.com"
  beatrice_llm_base_url   = "https://api.openai.com/v1"
  beatrice_llm_model      = "gpt-4o-mini"
  beatrice_llm_api_key    = "sk-example"
  fithara_llm_provider    = "openai"
  fithara_llm_base_url    = "https://api.openai.com/v1"
  fithara_llm_model       = "gpt-4.1-mini"
  fithara_llm_api_key     = "sk-example"
  beatrice_tts_base_url   = "https://api.openai.com/v1"
  beatrice_tts_model      = "gpt-4o-mini-tts"
  beatrice_tts_api_key    = "sk-example"
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

run "zitadel_is_configured_on_the_shared_instance" {
  command = plan

  assert {
    condition     = module.app.workloads_enabled
    error_message = "the workloads run in one apply with the ZITADEL configuration"
  }
}
