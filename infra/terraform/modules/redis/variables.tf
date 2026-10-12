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
  description = "Container image of Redis"
  type        = string
}

variable "password" {
  description = "Password Redis requires; null means passwordless, which is fine for local development"
  type        = string
  default     = null
  sensitive   = true
}

variable "max_memory" {
  description = "Redis maxmemory setting"
  type        = string
  default     = "512mb"
}

variable "max_memory_policy" {
  description = "Redis eviction policy"
  type        = string
  default     = "allkeys-lfu"
}

variable "memory_limit" {
  description = "Memory limit of the container"
  type        = string
  default     = "640Mi"
}

variable "redis_url" {
  description = "URL of an external Redis; when set, nothing is deployed"
  type        = string
  default     = null
  sensitive   = true
}
