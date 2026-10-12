output "endpoint" {
  description = "Endpoint of the S3 API: the external one when given, otherwise the in-cluster service"
  value       = local.deploy ? "http://s3:9000" : var.object_storage_endpoint
}
