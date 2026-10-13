output "broker_url" {
  description = "AMQP URL of the broker: the external one when given, otherwise the in-cluster service"
  value       = local.deploy ? "amqp://${var.username}:${var.password}@rabbitmq:5672/" : var.broker_url
  sensitive   = true
}
