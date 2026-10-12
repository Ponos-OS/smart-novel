variable "cluster_name" {
  description = "Name of the kind cluster"
  type        = string
  default     = "smart-novel"
}

variable "host_port" {
  description = "Port on the host that reaches the ingress controller; ZITADEL's external domain and the OIDC redirect URIs expect 8080"
  type        = number
  default     = 8080
}

variable "images" {
  description = "Images built by infra/scripts/start-dev.sh and loaded into the kind node"
  type        = list(string)
  default     = ["smart-novel-backend:dev", "smart-novel-frontend:dev"]
}

variable "third_party_images" {
  description = "Images of the third-party components, pulled once on the host if missing and loaded into the kind node, so they never download through the cluster"
  type        = map(string)
  default = {
    postgres = "postgres:18.2-bookworm"
    redis    = "redis:8.6-alpine3.23"
    minio    = "quay.io/minio/minio:RELEASE.2025-04-08T15-41-24Z"
    minio_mc = "quay.io/minio/mc:RELEASE.2025-04-08T15-39-49Z"
  }
}

variable "s3_port" {
  description = "Port on the host that reaches the S3 API; the covers' public URL in .env expects 9000"
  type        = number
  default     = 9000
}

variable "s3_console_port" {
  description = "Port on the host that reaches the MinIO console"
  type        = number
  default     = 9001
}

variable "tags" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = { Project = "smart-novel" }
}
