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

variable "users" {
  description = "Human users to create, by username. Each one is granted its role in the project; instance_roles (for example IAM_OWNER) make a user an administrator of the whole ZITADEL instance, including its console. Empty creates none"
  type = map(object({
    email          = string
    first_name     = string
    last_name      = string
    password       = string
    role           = string
    instance_roles = optional(list(string), [])
  }))
  default   = {}
  sensitive = true
}

variable "allow_self_registration" {
  description = "Let people register themselves in the login UI. They are granted self_registration_role_key by an action that runs after they are created, and registration fails when the action does"
  type        = bool
  default     = false
}

variable "self_registration_role_key" {
  description = "Role granted to self-registered users"
  type        = string
  default     = "user"
}

variable "login_default_redirect_uri" {
  description = "Where the login UI sends people who start without an application, for example from an email"
  type        = string
  default     = ""
}
