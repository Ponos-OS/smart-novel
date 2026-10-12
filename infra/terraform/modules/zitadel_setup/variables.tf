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
  description = "Image that runs the setup script (local-setup/setup-zitadel)"
  type        = string
}

variable "zitadel_url" {
  description = "URL the script reaches ZITADEL on; it must go through the ingress so the Host header matches ZITADEL's external domain"
  type        = string
}

variable "app_name" {
  description = "Name of the application, used for the ZITADEL project's OIDC application and the client ID file"
  type        = string
  default     = "smart-novel"
}

variable "credentials" {
  description = "The credentials volume from the zitadel module"
  type = object({
    claim_name = string
    mount_path = string
    pat_file   = string
  })
}
