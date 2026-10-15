variable "kubeconfig_path" {
  description = "Kubeconfig of the cluster ZITADEL runs in, written by envs/local"
  type        = string
  default     = "../local/smart-novel-config"
}

variable "namespace" {
  description = "Namespace ZITADEL runs in"
  type        = string
  default     = "smart-novel"
}

variable "host_port" {
  description = "Port on the host that reaches ZITADEL through the ingress, same as in envs/local"
  type        = number
  default     = 8080
}
