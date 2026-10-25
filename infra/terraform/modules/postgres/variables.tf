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
  description = "Container image of PostgreSQL"
  type        = string
}

variable "database" {
  description = "Name of the application database"
  type        = string
  default     = "smart_novel"
}

variable "username" {
  description = "Superuser of the application database"
  type        = string
  default     = "postgres"
}

variable "password" {
  description = "Password of the superuser"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "zitadel_password" {
  description = "Password of the zitadel role that owns the zitadel database"
  type        = string
  default     = "zitadel"
  sensitive   = true
}

variable "create_zitadel_database" {
  description = "Create the zitadel role and database on first start, for a ZITADEL that shares this PostgreSQL"
  type        = bool
  default     = true
}

variable "database_url" {
  description = "URL of an external PostgreSQL; when set, nothing is deployed"
  type        = string
  default     = null
  sensitive   = true
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
