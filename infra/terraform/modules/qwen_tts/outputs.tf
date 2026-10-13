output "base_url" {
  description = "Base URL of the in-cluster Qwen-TTS server"
  value       = "http://${kubernetes_service_v1.qwen_tts.metadata[0].name}:8001"
}
