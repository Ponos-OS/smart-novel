output "base_url" {
  description = "OpenAI-compatible base URL of the in-cluster Ollama"
  value       = "http://${kubernetes_service_v1.ollama.metadata[0].name}:11434/v1"
}

output "model" {
  description = "Model the image serves"
  value       = var.model
}
