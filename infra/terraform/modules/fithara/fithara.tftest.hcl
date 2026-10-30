mock_provider "kubernetes" {}

variables {
  namespace    = "smart-novel"
  image        = "9109679196/fithara:2.0.0"
  llm_provider = "ollama"
  llm_base_url = "http://ollama:11434/v1"
  llm_model    = "llama3.2:3b"
}

run "the_llm_comes_from_the_variables" {
  command = plan

  assert {
    condition     = one([for e in kubernetes_deployment_v1.fithara.spec[0].template[0].spec[0].container[0].env : e.value if e.name == "LLM__BASE_URL"]) == "http://ollama:11434/v1"
    error_message = "the LLM endpoint must come from llm_base_url"
  }

  assert {
    condition     = one([for e in kubernetes_deployment_v1.fithara.spec[0].template[0].spec[0].container[0].env : e.value if e.name == "LLM__MODEL"]) == "llama3.2:3b"
    error_message = "the model must come from llm_model"
  }

  assert {
    condition     = one([for e in kubernetes_deployment_v1.fithara.spec[0].template[0].spec[0].container[0].env : e.value if e.name == "LLM__PROVIDER"]) == "ollama"
    error_message = "the provider must come from llm_provider"
  }
}

run "the_api_key_lives_in_a_secret_not_in_the_environment" {
  command = plan

  assert {
    condition     = length([for e in kubernetes_deployment_v1.fithara.spec[0].template[0].spec[0].container[0].env : e if e.name == "LLM__API_KEY"]) == 0
    error_message = "the LLM key must come from the secret"
  }
}

run "tracing_is_off_without_an_otlp_endpoint" {
  command = plan

  assert {
    condition     = one([for e in kubernetes_deployment_v1.fithara.spec[0].template[0].spec[0].container[0].env : e.value if e.name == "OTEL__ENABLED"]) == "false"
    error_message = "tracing must be disabled when no OTLP endpoint is given"
  }
}

run "tracing_is_on_with_an_otlp_endpoint" {
  command = plan

  variables {
    otlp_http_endpoint = "http://otel-collector:4318"
  }

  assert {
    condition     = one([for e in kubernetes_deployment_v1.fithara.spec[0].template[0].spec[0].container[0].env : e.value if e.name == "OTEL__ENABLED"]) == "true"
    error_message = "tracing must be enabled when an OTLP endpoint is given"
  }
}

run "it_is_reached_inside_the_cluster_only" {
  command = plan

  assert {
    condition     = kubernetes_service_v1.fithara.spec[0].type == null || kubernetes_service_v1.fithara.spec[0].type == "ClusterIP"
    error_message = "Fithara must not be exposed outside the cluster"
  }

  assert {
    condition     = kubernetes_deployment_v1.fithara.spec[0].template[0].spec[0].enable_service_links == false
    error_message = "service links would inject FITHARA_PORT into the pod"
  }

  assert {
    condition     = kubernetes_deployment_v1.fithara.spec[0].template[0].spec[0].container[0].readiness_probe[0].http_get[0].path == "/health"
    error_message = "readiness must be answered by /health"
  }
}

run "an_unset_llm_setting_is_not_passed_on" {
  command = plan

  variables {
    llm_provider   = null
    llm_base_url   = null
    llm_model      = null
    llm_api_key    = null
    llm_timeout_ms = null
  }

  assert {
    condition     = length([for e in kubernetes_deployment_v1.fithara.spec[0].template[0].spec[0].container[0].env : e if startswith(e.name, "LLM__")]) == 0
    error_message = "an unset LLM setting must be left out so that Fithara refuses to start, not replaced by a default"
  }

  assert {
    condition     = length(kubernetes_secret_v1.fithara.data) == 0
    error_message = "an unset API key must not end up in the secret"
  }
}
