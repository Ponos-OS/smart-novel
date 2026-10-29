output "url" {
  description = "In-cluster URL of Fithara; it has no ingress route, only the backend reaches it"
  value       = "http://${kubernetes_service_v1.fithara.metadata[0].name}:8000"
}

output "llm_provider" {
  description = "Provider id Fithara talks to its LLM with"
  value       = var.llm_provider
}

output "llm_model" {
  description = "Model Fithara asks its LLM for"
  value       = var.llm_model
}
