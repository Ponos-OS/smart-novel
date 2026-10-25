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
  description = "Container image of Traefik"
  type        = string
}

variable "ingress_class_name" {
  description = "Name of the IngressClass Traefik serves; the app's Ingress objects use it"
  type        = string
  default     = "traefik"
}

variable "routes" {
  description = "Routes contributed by the other modules; the service is the URL Traefik forwards to (h2c:// for HTTP/2 without TLS)"
  type = list(object({
    name        = string
    rule        = string
    priority    = number
    service     = string
    middlewares = optional(list(string), [])
  }))
  default = []
}

variable "middlewares" {
  description = "Request-header middlewares that routes can reference by name"
  type = map(object({
    custom_request_headers = map(string)
  }))
  default = {}
}
