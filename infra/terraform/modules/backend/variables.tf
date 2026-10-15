variable "namespace" {
  description = "Namespace to deploy into"
  type        = string
}

variable "labels" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = {}
}

variable "enabled" {
  description = "Deploy the workload; the Service stays either way, so the ingress routes are the same"
  type        = bool
  default     = true
}

variable "image" {
  description = "Container image the backend runs"
  type        = string
}

variable "port" {
  description = "Port the backend listens on"
  type        = number
  default     = 3000
}

variable "environment" {
  description = "Environment variables of the backend"
  type        = map(string)
  default     = {}
}

variable "secret_environment" {
  description = "Environment variables that hold secrets; stored in a Secret instead of the pod spec"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "volumes" {
  description = "Volumes to mount, each from a host path or a persistent volume claim"
  type = list(object({
    name       = string
    mount_path = string
    read_only  = optional(bool, false)
    host_path  = optional(string)
    claim_name = optional(string)
  }))
  default = []
}

variable "wait_for" {
  description = "Names of one-shot Jobs that must complete before the deployment starts, for example applying the database schema"
  type        = list(string)
  default     = []
}
