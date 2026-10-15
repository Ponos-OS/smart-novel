mock_provider "kubernetes" {}

variables {
  namespace    = "smart-novel"
  image        = "9109679196/smart-novel-beatrice:5.0.0"
  broker_url   = "amqp://guest:guest@rabbitmq:5672/"
  llm_base_url = "http://ollama:11434/v1"
  llm_model    = "llama3.2:3b"
  tts_base_url = "http://openai-compatible-tts:8001/v1"
  tts_model    = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
}

run "endpoints_come_from_the_variables" {
  command = plan

  assert {
    condition     = one([for e in kubernetes_deployment_v1.beatrice.spec[0].template[0].spec[0].container[0].env : e.value if e.name == "TTS__BASE_URL"]) == "http://openai-compatible-tts:8001/v1"
    error_message = "the text-to-speech endpoint must come from tts_base_url"
  }

  assert {
    condition     = one([for e in kubernetes_deployment_v1.beatrice.spec[0].template[0].spec[0].container[0].env : e.value if e.name == "LLM__BASE_URL"]) == "http://ollama:11434/v1"
    error_message = "the LLM endpoint must come from llm_base_url"
  }
}

run "tracing_is_off_without_an_otlp_endpoint" {
  command = plan

  assert {
    condition     = one([for e in kubernetes_deployment_v1.beatrice.spec[0].template[0].spec[0].container[0].env : e.value if e.name == "OTEL__ENABLED"]) == "false"
    error_message = "tracing must be disabled when no OTLP endpoint is given"
  }
}

run "tracing_is_on_with_an_otlp_endpoint" {
  command = plan

  variables {
    otlp_http_endpoint = "http://otel-collector:4318"
  }

  assert {
    condition     = one([for e in kubernetes_deployment_v1.beatrice.spec[0].template[0].spec[0].container[0].env : e.value if e.name == "OTEL__ENABLED"]) == "true"
    error_message = "tracing must be enabled when an OTLP endpoint is given"
  }
}

run "credentials_live_in_a_secret_not_in_the_environment" {
  command = plan

  assert {
    condition     = length([for e in kubernetes_deployment_v1.beatrice.spec[0].template[0].spec[0].container[0].env : e if e.name == "RABBITMQ__CONNECTION_STRING"]) == 0
    error_message = "the broker URL carries a password and must come from the secret"
  }
}
