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
