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
  description = "Container image of the the object storage server"
  type        = string
}

variable "aws_cli_image" {
  description = "Container image of the AWS CLI that creates the bucket"
  type        = string
}

variable "access_key" {
  description = "Root user of the object storage"
  type        = string
  default     = "rustfsadmin"
}

variable "secret_key" {
  description = "Root password of the object storage"
  type        = string
  default     = "rustfsadmin"
  sensitive   = true
}

variable "bucket" {
  description = "Bucket created at start"
  type        = string
  default     = "smart-novel"
}

variable "seed_volume" {
  description = "Where the seed data lives, from a host path or a persistent volume claim; its PNG files are uploaded as covers. Null uploads nothing"
  type = object({
    host_path  = optional(string)
    claim_name = optional(string)
  })
  default = null
}

variable "api_host" {
  description = "Host the ingress serves the S3 API on"
  type        = string
  default     = "s3.localhost"
}

variable "console_host" {
  description = "Host the ingress serves the console on"
  type        = string
  default     = "s3-console.localhost"
}

variable "object_storage_endpoint" {
  description = "Endpoint of an external S3-compatible storage; when set, nothing is deployed"
  type        = string
  default     = null
}

variable "persistent_volumes" {
  description = "Keep data on a persistent volume instead of throwaway storage"
  type        = bool
  default     = false
}

variable "storage_class_name" {
  description = "Storage class of the persistent volume; null uses the cluster default"
  type        = string
  default     = null
}
