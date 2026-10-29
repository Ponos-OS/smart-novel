variable "namespace" {
  description = "Namespace to deploy into"
  type        = string
}

variable "labels" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = {}
}

variable "image" {
  description = "Container image of Fithara"
  type        = string
}

variable "llm_provider" {
  description = "PydanticAI provider id Fithara uses to talk to the LLM, e.g. ollama or openai"
  type        = string
}

variable "llm_base_url" {
  description = "OpenAI-compatible base URL of the LLM"
  type        = string
}

variable "llm_model" {
  description = "Name of the LLM model; the model capability catalog Fithara reads its limits from must know it, or Fithara refuses to start"
  type        = string
}

variable "llm_api_key" {
  description = "API key for the LLM; Ollama ignores it, Fithara only requires it to be non-empty"
  type        = string
  default     = "ollama"
  sensitive   = true
}

variable "llm_timeout_ms" {
  description = "Timeout of a single LLM call; a draft turn can run a long generation and CPU-only hosts are slow"
  type        = number
  default     = 120000
}

variable "rate_limit_per_minute" {
  description = "Requests per minute Fithara accepts from one client; all users reach it through the backend, so this is shared by every user"
  type        = number
  default     = 300
}

variable "log_level" {
  description = "Log level of Fithara"
  type        = string
  default     = "info"
}

variable "otlp_http_endpoint" {
  description = "OTLP/HTTP endpoint to export traces to; null disables tracing"
  type        = string
  default     = null
}
