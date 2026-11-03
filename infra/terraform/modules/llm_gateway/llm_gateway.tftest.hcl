mock_provider "kubernetes" {}

variables {
  namespace    = "smart-novel"
  image        = "9109679196/smart-novel-llm-gateway:1.0.1"
  llm_hf_model = "unsloth/Qwen3.6-35B-A3B-GGUF:Q4_K_M"
}

run "deploys_the_gateway_and_exposes_its_openai_endpoint" {
  command = plan

  assert {
    condition     = output.base_url == "http://llm-gateway:8000/v1"
    error_message = "consumers must reach both OpenAI-compatible APIs by the llm-gateway service name"
  }
}

run "serves_a_context_long_enough_for_drafting_licenses" {
  command = plan

  assert {
    condition     = one([for e in kubernetes_deployment_v1.llm_gateway.spec[0].template[0].spec[0].container[0].env : e.value if e.name == "LLM_CTX_SIZE"]) == "32768"
    error_message = "the gateway must be told the context length to serve"
  }
}

run "turns_reasoning_off_by_default" {
  command = plan

  assert {
    condition     = one([for e in kubernetes_deployment_v1.llm_gateway.spec[0].template[0].spec[0].container[0].env : e.value if e.name == "LLM_EXTRA_ARGS"]) == "--reasoning off"
    error_message = "thinking tokens outlast the callers' timeouts on a CPU-only model, so reasoning must be off unless overridden"
  }
}
