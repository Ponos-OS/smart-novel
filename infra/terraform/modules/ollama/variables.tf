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
  description = "Image built from local-setup/ollama, with the model already pulled"
  type        = string
}

variable "model" {
  description = "Model baked into the image; shown here so consumers take the same name"
  type        = string
}
