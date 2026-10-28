output "broker_url" {
  description = "AMQP URL of the broker: the external one when given, otherwise the in-cluster service"
  value       = local.deploy ? "amqp://${var.username}:${var.password}@rabbitmq:5672/" : var.broker_url
  sensitive   = true
}

output "routes" {
  description = "Routes for the ingress: the management UI on its own host; empty when the broker is external"
  value = nonsensitive(local.deploy) ? [
    {
      name     = "rabbitmq-management"
      rule     = "Host(`${var.management_host}`)"
      priority = 300
      service  = "http://${kubernetes_service_v1.rabbitmq[0].metadata[0].name}:15672"
    },
  ] : []
}
