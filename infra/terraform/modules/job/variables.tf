variable "namespace" {
  description = "Namespace to deploy into"
  type        = string
}

variable "labels" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = {}
}

variable "name" {
  description = "Name of the Job"
  type        = string
}

variable "image" {
  description = "Container image the Job runs"
  type        = string
}

variable "command" {
  description = "Command the Job runs"
  type        = list(string)
}

variable "environment" {
  description = "Environment variables of the Job"
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

variable "backoff_limit" {
  description = "Retries before the Job counts as failed"
  type        = number
  default     = 6
}

variable "timeout" {
  description = "How long to wait for the Job to complete"
  type        = string
  default     = "15m"
}
