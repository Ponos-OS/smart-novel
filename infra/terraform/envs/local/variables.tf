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
  description = "Images pulled once on the host if missing and loaded into the kind node, so they never download through the cluster"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = { Project = "smart-novel" }
}
