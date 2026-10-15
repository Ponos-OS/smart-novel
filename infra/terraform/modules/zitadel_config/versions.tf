terraform {
  required_version = ">= 1.9"

  required_providers {
    zitadel = {
      source  = "zitadel/zitadel"
      version = "~> 2.0"
    }
  }
}
