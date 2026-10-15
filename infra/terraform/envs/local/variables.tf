variable "cluster_name" {
  description = "Name of the kind cluster"
  type        = string
  default     = "smart-novel"
}

variable "host_port" {
  description = "Port on the host that reaches the ingress controller; ZITADEL's external domain and the OIDC redirect URIs expect 8080"
  type        = number
  default     = 8080
}

variable "mode" {
  description = "dev runs the development images against the mounted sources, for hot reload. e2e runs the production images, as the end-to-end suites need; infra/scripts/start-dev.sh e2e builds them"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "e2e"], var.mode)
    error_message = "mode must be dev or e2e"
  }
}

variable "third_party_images" {
  description = "Images of the third-party components, pulled once on the host if missing and loaded into the kind node, so they never download through the cluster"
  type        = map(string)
  default = {
    postgres       = "postgres:18.2-bookworm"
    redis          = "redis:8.6-alpine3.23"
    minio          = "quay.io/minio/minio:RELEASE.2025-04-08T15-41-24Z"
    minio_mc       = "quay.io/minio/mc:RELEASE.2025-04-08T15-39-49Z"
    traefik        = "traefik:v3.6.8"
    zitadel        = "ghcr.io/zitadel/zitadel:v4.12.3"
    zitadel_login  = "ghcr.io/zitadel/zitadel-login:v4.12.3"
    busybox        = "busybox:1.37"
    otel_collector = "otel/opentelemetry-collector-contrib:0.110.0"
    jaeger         = "jaegertracing/all-in-one:1.62.0"
    rabbitmq       = "rabbitmq:3.13-management-alpine"
  }
}

variable "s3_port" {
  description = "Port on the host that reaches the S3 API; the covers' public URL in .env expects 9000"
  type        = number
  default     = 9000
}

variable "s3_console_port" {
  description = "Port on the host that reaches the MinIO console"
  type        = number
  default     = 9001
}

variable "tags" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = { Project = "smart-novel" }
}

variable "enable_ai" {
  description = "Run Ollama and OpenAI-compatible TTS in the cluster. Their images bake the models in, so building and loading them is slow and large; false skips them, and with them Beatrice unless llm_base_url and tts_base_url are set"
  type        = bool
  default     = true
}

variable "ai_images" {
  description = "Images built by infra/scripts/start-dev.sh from local-setup/ollama and local-setup/openai-compatible-tts when enable_ai is true"
  type        = map(string)
  default = {
    ollama   = "smart-novel-ollama:dev"
    openai_compatible_tts = "smart-novel-openai-compatible-tts:dev"
  }
}

variable "llm_base_url" {
  description = "OpenAI-compatible base URL of an LLM outside the cluster, used when enable_ai is false"
  type        = string
  default     = null
}

variable "tts_base_url" {
  description = "Base URL of a OpenAI-compatible text-to-speech server outside the cluster, used when enable_ai is false"
  type        = string
  default     = null
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

variable "run_as_user" {
  description = "User ID that owns the files the codegen Job generates into apps/; use the output of `id -u`"
  type        = number
  default     = 1000
}

variable "enable_devtools" {
  description = "Run RedisInsight, pgAdmin and Open WebUI in the cluster, on localhost:5540, :5050 and :8090. Their images are large, so they are only pulled when this is true"
  type        = bool
  default     = false
}

variable "devtools_images" {
  description = "Images of the devtools, pulled once on the host if missing and loaded into the kind node when enable_devtools is true"
  type        = map(string)
  default = {
    redis_insight = "redis/redisinsight:2.70.1"
    pgadmin       = "dpage/pgadmin4:8.4"
    open_webui    = "ghcr.io/open-webui/open-webui:v0.8.0"
  }
}

variable "redis_insight_port" {
  description = "Port on the host that reaches RedisInsight"
  type        = number
  default     = 5540
}

variable "pgadmin_port" {
  description = "Port on the host that reaches pgAdmin"
  type        = number
  default     = 5050
}

variable "open_webui_port" {
  description = "Port on the host that reaches Open WebUI"
  type        = number
  default     = 8090
}

variable "redis_port" {
  description = "Port on the host that reaches Redis; the backend-e2e suites subscribe to it directly"
  type        = number
  default     = 6379
}
