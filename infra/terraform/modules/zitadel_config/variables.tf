variable "org_name" {
  description = "Name of the organization everything is created in. An existing one by default (ZITADEL's first instance names it ZITADEL); with create_org, the name of the new one"
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
  description = "Human users to create, by username. Each one is granted its role in the project; instance_roles (for example IAM_OWNER) make a user an administrator of the whole ZITADEL instance, including its console. A user without a password cannot log in, which suits users that are only impersonated. Empty creates none"
  type = map(object({
    email          = string
    first_name     = string
    last_name      = string
    password       = optional(string)
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

variable "impersonation" {
  description = "Lets an integration-test bot act as any user through token exchange: turns on impersonation in the security policy, and creates a confidential application and the bot, with a key, a PAT and access to the project without roles. credential_expiration_date (RFC 3339) is when the bot's key and PAT stop working. null creates none of it"
  type = object({
    redirect_uris              = list(string)
    credential_expiration_date = optional(string, "9999-12-31T23:59:59Z")
  })
  default = null
}

variable "backend_access" {
  description = "Gives the backend a machine user with a PAT and the organization role ORG_USER_PERMISSION_EDITOR, enough to manage user grants and nothing else; it holds no project role. credential_expiration_date (RFC 3339) is when the PAT stops working. null creates none of it"
  type = object({
    credential_expiration_date = optional(string, "9999-12-31T23:59:59Z")
  })
  default = null
}

variable "manage_instance_settings" {
  description = "Set the instance-wide default login policy and security settings. Turn it off on a ZITADEL that other projects share and whose owner sets them"
  type        = bool
  default     = true
}

variable "create_org" {
  description = "Create the organization org_name instead of using an existing one, with its own login policy. Logins reach it only when the sign-in request carries the scope urn:zitadel:iam:org:id:<org_id>"
  type        = bool
  default     = false
}

variable "branding" {
  description = "Colors of the login page, the frontend's Tailwind palette (gray and blue), light and dark, so the two look the same: change them together. ZITADEL knows four colors, so the surfaces are not set, and links take the primary color"
  type = object({
    light = optional(object({
      background_color = optional(string, "#f9fafb") # Tailwind gray-50, the page background
      font_color       = optional(string, "#111827") # Tailwind gray-900, the text
      primary_color    = optional(string, "#2563eb") # Tailwind blue-600, buttons and links
      warn_color       = optional(string, "#dc2626") # Tailwind red-600, errors
    }), {})
    dark = optional(object({
      background_color = optional(string, "#111827") # Tailwind gray-900
      font_color       = optional(string, "#f3f4f6") # Tailwind gray-100
      primary_color    = optional(string, "#3b82f6") # Tailwind blue-500
      warn_color       = optional(string, "#f87171") # Tailwind red-400
    }), {})
  })
  default = {}

  validation {
    condition     = alltrue([for theme in [var.branding.light, var.branding.dark] : alltrue([for color in values(theme) : can(regex("^#[0-9a-fA-F]{6}$", color))])])
    error_message = "Every color must be a hex value such as #111827"
  }
}
