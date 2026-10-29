mock_provider "kubernetes" {}

variables {
  namespace = "smart-novel"
  image     = "smart-novel-ollama:dev"
  model     = "llama3.2:3b"
}

run "deploys_ollama_and_exposes_its_openai_endpoint" {
  command = plan

  assert {
    condition     = output.base_url == "http://ollama:11434/v1" && output.model == "llama3.2:3b"
    error_message = "consumers must reach Ollama's OpenAI-compatible API by the ollama service name"
  }
}

run "serves_a_context_long_enough_for_drafting_licenses" {
  command = plan

  assert {
    condition     = one([for e in kubernetes_deployment_v1.ollama.spec[0].template[0].spec[0].container[0].env : e.value if e.name == "OLLAMA_CONTEXT_LENGTH"]) == "32768"
    error_message = "Ollama must be told the context length to serve"
  }
}
