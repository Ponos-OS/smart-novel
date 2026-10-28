variable "namespace" {
  description = "Namespace to deploy into"
  type        = string
}

variable "labels" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = {}
}

variable "images" {
  description = "Container images of the stack: otel-collector (contrib distribution, for tail sampling), tempo, loki, prometheus and grafana"
  type        = map(string)

  validation {
    condition     = toset(keys(var.images)) == toset(["otel-collector", "tempo", "loki", "prometheus", "grafana"])
    error_message = "images needs exactly otel-collector, tempo, loki, prometheus and grafana."
  }
}

variable "sampling_ratio" {
  description = "Share of the non-noisy traces that are kept, between 0 and 1; errors are always kept"
  type        = number
  default     = 1.0

  validation {
    condition     = var.sampling_ratio >= 0 && var.sampling_ratio <= 1
    error_message = "sampling_ratio must be between 0 and 1"
  }
}

variable "grafana_host" {
  description = "Host the ingress serves Grafana on, for example grafana.localhost"
  type        = string
  default     = "grafana.localhost"
}

variable "grafana_root_url" {
  description = "Public URL of Grafana, which it uses in the links it generates"
  type        = string
  default     = "http://grafana.localhost:8080"
}
