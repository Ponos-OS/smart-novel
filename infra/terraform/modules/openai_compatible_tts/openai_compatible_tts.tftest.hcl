mock_provider "kubernetes" {}

variables {
  namespace = "smart-novel"
  image     = "smart-novel-openai-compatible-tts:dev"
}

run "deploys_openai_compatible_tts_and_exposes_its_url" {
  command = plan

  assert {
    condition     = output.base_url == "http://openai-compatible-tts:8001/v1"
    error_message = "consumers must reach OpenAI-compatible TTS by the openai-compatible-tts service name"
  }
}
