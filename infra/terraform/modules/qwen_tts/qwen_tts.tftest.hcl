mock_provider "kubernetes" {}

variables {
  namespace = "smart-novel"
  image     = "smart-novel-qwen-tts:dev"
}

run "deploys_qwen_tts_and_exposes_its_url" {
  command = plan

  assert {
    condition     = output.base_url == "http://qwen-tts:8001/v1"
    error_message = "consumers must reach Qwen-TTS by the qwen-tts service name"
  }
}
