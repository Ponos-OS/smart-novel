variable "namespace" {
  description = "Namespace everything is deployed into"
  type        = string
  default     = "smart-novel"
}

variable "labels" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = {}
}

variable "dev_source_path" {
  description = "Path of the application sources inside the cluster node. When set, backend and frontend run the development image with these sources mounted for hot reload; null means the production image"
  type        = string
  default     = null
}
