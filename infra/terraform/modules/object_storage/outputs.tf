output "endpoint" {
  description = "Endpoint of the S3 API: the external one when given, otherwise the in-cluster service"
  value       = local.deploy ? "http://s3:9000" : var.object_storage_endpoint
}

output "routes" {
  description = "Routes for the ingress: the S3 API and the console, each on its own host; empty when the storage is external"
  value = local.deploy ? [
    {
      name     = "object-storage-api"
      rule     = "Host(`${var.api_host}`)"
      priority = 300
      service  = "http://${kubernetes_service_v1.s3[0].metadata[0].name}:9000"
    },
    {
      name     = "object-storage-console"
      rule     = "Host(`${var.console_host}`)"
      priority = 300
      service  = "http://${kubernetes_service_v1.s3[0].metadata[0].name}:9001"
    },
  ] : []
}
