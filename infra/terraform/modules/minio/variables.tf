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
  description = "Container image of the MinIO server"
  type        = string
}

variable "mc_image" {
  description = "Container image of the MinIO client that creates the bucket"
  type        = string
}

variable "access_key" {
  description = "Root user of MinIO"
  type        = string
  default     = "minioadmin"
}

variable "secret_key" {
  description = "Root password of MinIO"
  type        = string
  default     = "minioadmin"
  sensitive   = true
}

variable "bucket" {
  description = "Bucket created at start"
  type        = string
  default     = "smart-novel"
}

variable "seed_data_path" {
  description = "Path inside the cluster node holding the seed data; its PNG files are uploaded as covers. Null uploads nothing"
  type        = string
  default     = null
}

variable "api_node_port" {
  description = "Node port of the S3 API, to reach it from the host; null keeps it cluster-internal"
  type        = number
  default     = null
}

variable "console_node_port" {
  description = "Node port of the MinIO console, to reach it from the host; null keeps it cluster-internal"
  type        = number
  default     = null
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
