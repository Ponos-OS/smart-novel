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
  description = "Container image of RabbitMQ"
  type        = string
}

variable "username" {
  description = "Default user"
  type        = string
  default     = "guest"
}

variable "password" {
  description = "Password of the default user"
  type        = string
  default     = "guest"
  sensitive   = true
}

variable "broker_url" {
  description = "URL of an external broker; when set, nothing is deployed"
  type        = string
  default     = null
  sensitive   = true
}
