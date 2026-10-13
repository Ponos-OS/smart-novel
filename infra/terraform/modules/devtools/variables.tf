variable "namespace" {
  description = "Namespace to deploy into"
  type        = string
}

variable "labels" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = {}
}

variable "redis_insight_image" {
  description = "Container image of RedisInsight"
  type        = string
}

variable "pgadmin_image" {
  description = "Container image of pgAdmin"
  type        = string
}

variable "open_webui_image" {
  description = "Container image of Open WebUI"
  type        = string
}

variable "redis" {
  description = "Where Redis is reachable; null skips RedisInsight"
  type = object({
    host = string
    port = number
  })
  default = null
}

variable "redis_password" {
  description = "Password of Redis, if it requires one"
  type        = string
  default     = null
  sensitive   = true
}

variable "postgres" {
  description = "Where PostgreSQL is reachable; null skips pgAdmin"
  type = object({
    host     = string
    port     = number
    database = string
    username = string
  })
  default = null
}

variable "pgadmin_email" {
  description = "Login e-mail of pgAdmin"
  type        = string
  default     = "admin@admin.com"
}

variable "pgadmin_password" {
  description = "Login password of pgAdmin"
  type        = string
  default     = "admin"
  sensitive   = true
}

variable "ollama_base_url" {
  description = "Base URL of Ollama's native API; null skips Open WebUI"
  type        = string
  default     = null
}

variable "node_ports" {
  description = "Node ports that expose each tool outside the cluster; null keeps a tool cluster-internal"
  type = object({
    redis_insight = optional(number)
    pgadmin       = optional(number)
    open_webui    = optional(number)
  })
  default = {}
}
