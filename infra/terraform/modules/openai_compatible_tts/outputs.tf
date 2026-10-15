output "base_url" {
  description = "Base URL of the in-cluster OpenAI-compatible TTS server"
  value       = "http://${kubernetes_service_v1.openai_compatible_tts.metadata[0].name}:8001/v1"
}
