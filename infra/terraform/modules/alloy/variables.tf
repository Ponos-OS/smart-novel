variable "namespace" {
  description = "Namespace to deploy into, and the only one whose pods' logs are collected"
  type        = string
}

variable "labels" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = {}
}

variable "image" {
  description = "Grafana Alloy image"
  type        = string
}

variable "apps" {
  description = "Values of the `app` pod label whose stdout is shipped; each becomes the service_name of its logs"
  type        = list(string)
  default     = ["backend", "beatrice", "fithara"]
}

variable "loki_push_url" {
  description = "Loki push endpoint"
  type        = string
  default     = "http://loki:3100/loki/api/v1/push"
}
