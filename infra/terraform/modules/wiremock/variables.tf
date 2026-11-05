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
  description = "WireMock image, e.g. wiremock/wiremock:3.13.1"
  type        = string
}

variable "name" {
  description = "Name of the Deployment and the Service, so the mocked API is reached at http://<name>:8080; one instance per mocked API"
  type        = string
  default     = "wiremock"
}

variable "mappings_dir" {
  description = "Directory of WireMock mapping files (*.json) this instance serves"
  type        = string
}
