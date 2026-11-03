output "base_url" {
  description = "OpenAI-compatible base URL of the in-cluster gateway; serves both /chat/completions and /audio/speech"
  value       = "http://${kubernetes_service_v1.llm_gateway.metadata[0].name}:8000/v1"
}
