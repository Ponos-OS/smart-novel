variable "org_name" {
  description = "Name of the organization everything is created in; ZITADEL's first instance names it ZITADEL"
  type        = string
  default     = "ZITADEL"
}

variable "project_name" {
  description = "Name of the ZITADEL project the application and its roles belong to"
  type        = string
  default     = "smart-novel"
}

variable "application_name" {
  description = "Name of the public OIDC application, the single-page app users log in with"
  type        = string
  default     = "smart-novel"
}

variable "roles" {
  description = "Project roles users can be granted"
  type = list(object({
    key          = string
    display_name = string
  }))
  default = [
    { key = "admin", display_name = "Admin" },
    { key = "writer", display_name = "Writer" },
    { key = "user", display_name = "User" },
  ]
}

variable "redirect_uris" {
  description = "Where ZITADEL may send the browser after login"
  type        = list(string)
}

variable "post_logout_redirect_uris" {
  description = "Where ZITADEL may send the browser after logout"
  type        = list(string)
}

variable "dev_mode" {
  description = "Relax the redirect URI validation, so plain HTTP and localhost are accepted. Never in production"
  type        = bool
  default     = false
}
