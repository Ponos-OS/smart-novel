variable "namespace" {
  description = "Namespace to deploy into"
  type        = string
}

variable "labels" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = {}
}

variable "collector_image" {
  description = "Container image of the OpenTelemetry Collector (contrib distribution, for tail sampling)"
  type        = string
}

variable "jaeger_image" {
  description = "Container image of Jaeger all-in-one"
  type        = string
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

variable "jaeger_path" {
  description = "Path prefix the Jaeger UI is served under on the ingress"
  type        = string
  default     = "/jaeger"
}
