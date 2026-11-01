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
  description = "Host ZITADEL is reached on from the browser. It is its own host, never the host of the frontend, so no path of ZITADEL can shadow a page of the app (the frontend has `/admin/...` pages, ZITADEL has `/admin/v1`)"
  type        = string
  default     = "auth.localhost"
}

variable "internal_hosts" {
  description = "Hosts other workloads in the cluster reach ZITADEL with, through the ingress (its Service name). Nothing else is served on them"
  type        = list(string)
  default     = ["traefik"]
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

variable "otlp_grpc_endpoint" {
  description = "host:port of an OTLP/gRPC endpoint without TLS that ZITADEL exports its traces to; null exports none. Incoming trace context is trusted then, so only set it for an endpoint and callers you control"
  type        = string
  default     = null
}
