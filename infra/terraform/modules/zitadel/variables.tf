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
  description = "Container image of ZITADEL"
  type        = string
}

variable "login_image" {
  description = "Container image of the ZITADEL login UI"
  type        = string
}

variable "busybox_image" {
  description = "Container image used for the one-line init steps (volume permissions, waiting for a file)"
  type        = string
}

variable "external_domain" {
  description = "Domain ZITADEL is reached on from the browser"
  type        = string
  default     = "localhost"
}

variable "external_port" {
  description = "Port ZITADEL is reached on from the browser (the ingress port on the host)"
  type        = number
  default     = 8080
}

variable "admin_username" {
  description = "Username of the first human admin"
  type        = string
  default     = "admin"
}

variable "admin_password" {
  description = "Password of the first human admin"
  type        = string
  default     = "Admin123!"
  sensitive   = true
}

variable "database_host" {
  description = "Host of the PostgreSQL ZITADEL stores its data in"
  type        = string
  default     = "postgres"
}

variable "database_port" {
  description = "Port of the PostgreSQL ZITADEL stores its data in"
  type        = number
  default     = 5432
}

variable "database_admin_username" {
  description = "PostgreSQL superuser; used once by the init step"
  type        = string
  default     = "postgres"
}

variable "database_admin_password" {
  description = "Password of the PostgreSQL superuser"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "database_password" {
  description = "Password of the zitadel database role"
  type        = string
  default     = "zitadel"
  sensitive   = true
}

variable "credentials_storage_class_name" {
  description = "Storage class of the volume the generated credentials are written to; null uses the cluster default"
  type        = string
  default     = null
}
