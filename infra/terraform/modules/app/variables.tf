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

variable "images" {
  description = "Container images: postgres, redis, minio, minio_mc, traefik, zitadel, zitadel_login, busybox, otel_collector, jaeger, rabbitmq, beatrice, ollama, openai_compatible_tts, backend and frontend, plus redis_insight, pgadmin and open_webui when enable_devtools is true"
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

variable "redis_node_port" {
  description = "Node port that exposes Redis to the host; null keeps it cluster-internal"
  type        = number
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
  description = "Deploy Ollama and OpenAI-compatible TTS, the heavy models Beatrice uses. When false, Beatrice is deployed only if llm_base_url and tts_base_url point at other services"
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

variable "tts_model" {
  description = "Text-to-speech model name Beatrice sends in every speech request; with enable_ai it is the model baked into the OpenAI-compatible TTS image"
  type        = string
  default     = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
}

variable "llm_api_key" {
  description = "API key for the external LLM; null keeps the module default, which Ollama accepts"
  type        = string
  default     = null
  sensitive   = true
}

variable "tts_api_key" {
  description = "API key for the external text-to-speech server; null keeps the module default, which the local shim accepts"
  type        = string
  default     = null
  sensitive   = true
}

variable "tts_voices" {
  description = "Voices the text-to-speech server offers, comma separated; null keeps the module default"
  type        = string
  default     = null
}

variable "tts_base_url" {
  description = "Base URL of an external OpenAI-compatible text-to-speech server; used when enable_ai is false"
  type        = string
  default     = null
}

variable "broker_url" {
  description = "AMQP URL of an external broker; when set, RabbitMQ is not deployed"
  type        = string
  default     = null
  sensitive   = true
}

variable "wait_for_zitadel_credentials" {
  description = "Hold back the workloads that need what ZITADEL's configuration generates (the client ID, tokens, user IDs), which reach them as environment settings. Set it until those values exist, then unset it"
  type        = bool
  default     = false
}

variable "backend_port" {
  description = "Port the backend listens on"
  type        = number
  default     = 3000
}

variable "frontend_port" {
  description = "Port the frontend container listens on"
  type        = number
  default     = 80
}

variable "backend_environment" {
  description = "Application settings of the backend. Values that depend on the deployed components (object storage endpoint, Beatrice URL, tracing) are filled in by this module and win over these"
  type        = map(string)
  default     = {}
}

variable "backend_secret_environment" {
  description = "Application settings of the backend that hold secrets. DATABASE_URL and REDIS_URL are filled in by this module"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "frontend_environment" {
  description = "The VITE_ settings of the frontend"
  type        = map(string)
  default     = {}
}

variable "backend_volumes" {
  description = "Volumes of the backend, from a host path or a persistent volume claim"
  type = list(object({
    name       = string
    mount_path = string
    read_only  = optional(bool, false)
    host_path  = optional(string)
    claim_name = optional(string)
  }))
  default = []
}

variable "frontend_volumes" {
  description = "Volumes of the frontend; same shape as backend_volumes"
  type = list(object({
    name       = string
    mount_path = string
    read_only  = optional(bool, false)
    host_path  = optional(string)
    claim_name = optional(string)
  }))
  default = []
}

variable "frontend_command" {
  description = "Overrides the frontend image's command; null keeps it"
  type        = list(string)
  default     = null
}

variable "frontend_files" {
  description = "Files to place in the frontend container, by absolute path"
  type        = map(string)
  default     = {}
}

variable "minio_seed_volume" {
  description = "Where the seed covers live, from a host path or a persistent volume claim; null uploads none"
  type = object({
    host_path  = optional(string)
    claim_name = optional(string)
  })
  default = null
}

variable "pre_deploy_jobs" {
  description = "One-shot Jobs that must complete before the backend and the frontend start, for example applying the database schema. use_backend_environment gives a Job the backend's environment, including what this module fills in"
  type = list(object({
    name                    = string
    image                   = string
    command                 = list(string)
    environment             = optional(map(string), {})
    use_backend_environment = optional(bool, false)
    volumes = optional(list(object({
      name       = string
      mount_path = string
      read_only  = optional(bool, false)
      host_path  = optional(string)
      claim_name = optional(string)
    })), [])
  }))
  default = []
}

variable "enable_devtools" {
  description = "Deploy RedisInsight, pgAdmin and Open WebUI for the components that run in the cluster. For development only"
  type        = bool
  default     = false
}

variable "devtools_node_ports" {
  description = "Node ports that expose each devtool outside the cluster; null keeps a tool cluster-internal"
  type = object({
    redis_insight = optional(number)
    pgadmin       = optional(number)
    open_webui    = optional(number)
  })
  default = {}
}
