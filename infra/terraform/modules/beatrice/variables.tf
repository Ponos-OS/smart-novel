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
  description = "Container image of Beatrice"
  type        = string
}

variable "broker_url" {
  description = "AMQP URL of the message broker"
  type        = string
  sensitive   = true
}

variable "llm_base_url" {
  description = "OpenAI-compatible base URL of the LLM"
  type        = string
}

variable "llm_model" {
  description = "Name of the LLM model"
  type        = string
}

variable "llm_api_key" {
  description = "API key for the LLM; Ollama ignores it, Beatrice only requires it to be non-empty"
  type        = string
  default     = "ollama"
  sensitive   = true
}

variable "llm_timeout_ms" {
  description = "Timeout of a single LLM call"
  type        = number
  default     = 150000
}

variable "tts_base_url" {
  description = "Base URL of the OpenAI-compatible text-to-speech server"
  type        = string
}

variable "tts_api_key" {
  description = "API key for the text-to-speech server; the local shim ignores it, Beatrice only requires it to be non-empty"
  type        = string
  default     = "local-dev-key"
  sensitive   = true
}

variable "tts_model" {
  description = "Model name sent in every speech request"
  type        = string
}

variable "tts_voices" {
  description = "Voices the text-to-speech server offers, comma separated"
  type        = string
  default     = "default"
}

variable "tts_timeout_ms" {
  description = "Timeout of a single synthesis; long on purpose because CPU-only hosts are slow"
  type        = number
  default     = 1800000
}

variable "callback_allowed_hosts" {
  description = "Hosts Beatrice may call back when audio is ready, comma separated"
  type        = string
  default     = "backend,backend-e2e"
}

variable "otlp_http_endpoint" {
  description = "OTLP/HTTP endpoint to export traces to; null disables tracing"
  type        = string
  default     = null
}

variable "traces_sampler" {
  description = "OpenTelemetry head sampler"
  type        = string
  default     = "parentbased_traceidratio"
}

variable "log_level" {
  description = "Log level"
  type        = string
  default     = "info"
}
