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
  description = "Container image the frontend runs"
  type        = string
}

variable "port" {
  description = "Port the frontend container listens on"
  type        = number
  default     = 80
}

variable "command" {
  description = "Overrides the image's command; null keeps it"
  type        = list(string)
  default     = null
}

variable "files" {
  description = "Files to place in the container, by absolute path"
  type        = map(string)
  default     = {}
}

variable "environment" {
  description = "Environment variables of the frontend"
  type        = map(string)
  default     = {}
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
