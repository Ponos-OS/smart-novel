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

variable "images" {
  description = "Images built by infra/scripts/start-dev.sh and loaded into the kind node"
  type        = list(string)
  default     = ["smart-novel-backend:dev", "smart-novel-frontend:dev", "smart-novel-setup-zitadel:dev"]
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
  description = "Run Ollama and Qwen-TTS in the cluster. Their images bake the models in, so building and loading them is slow and large; false skips them, and with them Beatrice unless llm_base_url and tts_base_url are set"
  type        = bool
  default     = true
}

variable "ai_images" {
  description = "Images built by infra/scripts/start-dev.sh from local-setup/ollama and local-setup/qwen-tts when enable_ai is true"
  type        = map(string)
  default = {
    ollama   = "smart-novel-ollama:dev"
    qwen_tts = "smart-novel-qwen-tts:dev"
  }
}

variable "llm_base_url" {
  description = "OpenAI-compatible base URL of an LLM outside the cluster, used when enable_ai is false"
  type        = string
  default     = null
}

variable "tts_base_url" {
  description = "Base URL of a Qwen-compatible text-to-speech server outside the cluster, used when enable_ai is false"
  type        = string
  default     = null
}

variable "run_as_user" {
  description = "User ID that owns the files the codegen Job generates into apps/; use the output of `id -u`"
  type        = number
  default     = 1000
}
