output "base_url" {
  description = "OpenAI-compatible base URL of the in-cluster Ollama"
  value       = "http://${kubernetes_service_v1.ollama.metadata[0].name}:11434/v1"
}

output "model" {
  description = "Model the image serves"
  value       = var.model
}

output "host_url" {
  description = "Base URL of the in-cluster Ollama, for clients of its native API"
  value       = "http://${kubernetes_service_v1.ollama.metadata[0].name}:11434"
}
