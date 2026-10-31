variable "kubeconfig_path" {
  description = "Kubeconfig of the shared cluster (the kubeconfig output of the infra repo's hetzner/ root)"
  type        = string
}

variable "namespace" {
  description = "Namespace everything is deployed into"
  type        = string
  default     = "smart-novel"
}

variable "tags" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = { Project = "smart-novel" }
}

variable "domain" {
  description = "Host the app is served on"
  type        = string
}

variable "ingress_class" {
  description = "ingress_class output of the infra repo's cluster/ root"
  type        = string
}

variable "cluster_issuer" {
  description = "cluster_issuer output of the infra repo's cluster/ root"
  type        = string
}

variable "storage_class" {
  description = "storage_class output of the infra repo's cluster/ root"
  type        = string
}

variable "otel_collector_endpoint" {
  description = "otel_collector_endpoint output of the infra repo's cluster/ root; null turns tracing off"
  type        = string
  default     = null
}

variable "images" {
  description = "Container images. The backend and the frontend are the CI-built ones; the rest default to the versions the local environment runs"
  type = object({
    backend        = string
    frontend       = string
    postgres       = optional(string, "postgres:18.2-bookworm")
    redis          = optional(string, "redis:8.6-alpine3.23")
    aws_cli        = optional(string, "amazon/aws-cli:2.38.1")
    rabbitmq       = optional(string, "rabbitmq:3.13-management-alpine")
    beatrice       = string
    object_storage = optional(string, "unused")
  })
}

variable "object_storage_endpoint" {
  description = "S3 endpoint of the Cloudflare R2 bucket; nothing is deployed for object storage"
  type        = string
}

variable "llm_base_url" {
  description = "OpenAI-compatible base URL of the LLM Beatrice calls"
  type        = string
}

variable "llm_model" {
  description = "LLM model name Beatrice asks for"
  type        = string
}

variable "llm_api_key" {
  description = "API key for the LLM"
  type        = string
  sensitive   = true
}

variable "tts_base_url" {
  description = "OpenAI-compatible base URL of the text-to-speech server Beatrice calls"
  type        = string
}

variable "tts_model" {
  description = "Text-to-speech model name Beatrice asks for"
  type        = string
}

variable "tts_api_key" {
  description = "API key for the text-to-speech server"
  type        = string
  sensitive   = true
}

variable "tts_voices" {
  description = "Voices the text-to-speech server offers, comma separated; null keeps the module default"
  type        = string
  default     = null
}

variable "backend_environment" {
  description = "Settings of the backend that are not secrets: the .env keys without the VITE_ prefix, object storage and ZITADEL URLs"
  type        = map(string)
  default     = {}
}

variable "backend_secret_environment" {
  description = "Settings of the backend that are secrets (object storage keys, Redis password); stored in a Secret"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "frontend_environment" {
  description = "Settings of the frontend: the VITE_ keys of the .env"
  type        = map(string)
  default     = {}
}

variable "zitadel_client_id" {
  description = "client_id output of envs/hetzner-zitadel; null holds back the backend, the frontend and the migration until it exists"
  type        = string
  default     = null
}

variable "zitadel_org_id" {
  description = "org_id output of envs/hetzner-zitadel; the frontend signs in with this organization's login policy"
  type        = string
  default     = null
}

variable "zitadel_pat" {
  description = "Token the backend uses to create sessions in ZITADEL. Create a machine user for it; do not hand over the instance admin token"
  type        = string
  default     = null
  sensitive   = true
}

variable "zitadel_management_pat" {
  description = "backend_pat output of envs/hetzner-zitadel: the token of the machine user the backend uses to grant project roles. Only that user's token, never the instance admin token"
  type        = string
  default     = null
  sensitive   = true
}

variable "migrate_image" {
  description = "Image that has the Prisma CLI and the schema, for the migration Job; the production backend image has no CLI"
  type        = string
}

variable "migrate_command" {
  description = "Command of the migration Job"
  type        = list(string)
  default     = ["/bin/sh", "-c", "npx prisma migrate deploy --schema=./apps/backend/prisma/schema.prisma"]
}

variable "backup_endpoint" {
  description = "S3 endpoint of the backup bucket (infra repo's backup_bucket output)"
  type        = string
}

variable "backup_bucket" {
  description = "Backup bucket (infra repo's backup_bucket output)"
  type        = string
}

variable "backup_access_key" {
  description = "Access key of the backup credential"
  type        = string
  sensitive   = true
}

variable "backup_secret_key" {
  description = "Secret key of the backup credential"
  type        = string
  sensitive   = true
}

variable "postgres_password" {
  description = "Superuser password of the in-cluster PostgreSQL"
  type        = string
  sensitive   = true
}

variable "redis_password" {
  description = "Password the in-cluster Redis requires"
  type        = string
  sensitive   = true
}
