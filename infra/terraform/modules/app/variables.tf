variable "namespace" {
  description = "Namespace everything is deployed into"
  type        = string
  default     = "smart-novel"
}

variable "labels" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = {}
}

variable "dev_source_path" {
  description = "Path of the application sources inside the cluster node. When set, backend and frontend run the development image with these sources mounted for hot reload; null means the production image"
  type        = string
  default     = null
}

variable "images" {
  description = "Container images: postgres, redis, minio, minio_mc, traefik, zitadel, zitadel_login, busybox, otel_collector, jaeger, rabbitmq, beatrice, ollama, qwen_tts and setup_zitadel"
  type        = map(string)
}

variable "persistent_volumes" {
  description = "Keep data on persistent volumes instead of throwaway storage"
  type        = bool
  default     = false
}

variable "storage_class_name" {
  description = "Storage class of the persistent volumes; null uses the cluster default"
  type        = string
  default     = null
}

variable "database_url" {
  description = "URL of an external PostgreSQL; when set, PostgreSQL is not deployed"
  type        = string
  default     = null
  sensitive   = true
}

variable "redis_url" {
  description = "URL of an external Redis; when set, Redis is not deployed"
  type        = string
  default     = null
  sensitive   = true
}

variable "object_storage_endpoint" {
  description = "Endpoint of an external S3-compatible storage; when set, MinIO is not deployed"
  type        = string
  default     = null
}

variable "object_storage_api_node_port" {
  description = "Node port that exposes the S3 API to the host; null keeps it cluster-internal"
  type        = number
  default     = null
}

variable "object_storage_console_node_port" {
  description = "Node port that exposes the MinIO console to the host; null keeps it cluster-internal"
  type        = number
  default     = null
}

variable "external_port" {
  description = "Port the application is reached on from the browser; ZITADEL's external port and redirect URIs are built from it"
  type        = number
  default     = 8080
}

variable "enable_observability" {
  description = "Deploy the OpenTelemetry Collector and Jaeger"
  type        = bool
  default     = true
}

variable "trace_sampling_ratio" {
  description = "Share of the non-noisy traces that are kept, between 0 and 1"
  type        = number
  default     = 1.0
}

variable "enable_ai" {
  description = "Deploy Ollama and Qwen-TTS, the heavy models Beatrice uses. When false, Beatrice is deployed only if llm_base_url and tts_base_url point at other services"
  type        = bool
  default     = true
}

variable "llm_base_url" {
  description = "OpenAI-compatible base URL of an external LLM; used when enable_ai is false"
  type        = string
  default     = null
}

variable "llm_model" {
  description = "LLM model name Beatrice asks for; with enable_ai it is the model baked into the Ollama image"
  type        = string
  default     = "llama3.2:1b"
}

variable "tts_base_url" {
  description = "Base URL of an external Qwen-compatible text-to-speech server; used when enable_ai is false"
  type        = string
  default     = null
}

variable "broker_url" {
  description = "AMQP URL of an external broker; when set, RabbitMQ is not deployed"
  type        = string
  default     = null
  sensitive   = true
}
