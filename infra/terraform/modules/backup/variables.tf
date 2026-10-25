variable "namespace" {
  description = "Namespace to deploy into"
  type        = string
}

variable "labels" {
  description = "Labels on every Kubernetes resource, to filter them by"
  type        = map(string)
  default     = {}
}

variable "postgres_image" {
  description = "Container image with pg_dump; use the server's own image so the versions match"
  type        = string
}

variable "aws_cli_image" {
  description = "Container image of the AWS CLI that uploads the dump"
  type        = string
}

variable "database_url" {
  description = "URL of the PostgreSQL to dump"
  type        = string
  sensitive   = true
}

variable "database_name" {
  description = "Name of the database, used in the object key"
  type        = string
  default     = "smart_novel"
}

variable "project" {
  description = "Project name, the first level under daily/ and monthly/"
  type        = string
  default     = "smart-novel"
}

variable "endpoint" {
  description = "S3 endpoint of the backup bucket"
  type        = string
}

variable "region" {
  description = "Region used to sign requests to the endpoint"
  type        = string
  default     = "fsn1"
}

variable "bucket" {
  description = "Backup bucket"
  type        = string
}

variable "access_key" {
  description = "Access key of the backup credential"
  type        = string
  sensitive   = true
}

variable "secret_key" {
  description = "Secret key of the backup credential"
  type        = string
  sensitive   = true
}

variable "daily_schedule" {
  description = "Cron schedule of the daily dump, in UTC; off-peak"
  type        = string
  default     = "0 3 * * *"
}

variable "monthly_schedule" {
  description = "Cron schedule of the monthly dump, in UTC"
  type        = string
  default     = "0 4 1 * *"
}
