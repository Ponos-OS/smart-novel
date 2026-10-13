mock_provider "kubernetes" {}

variables {
  namespace = "smart-novel"
  image     = "rabbitmq:3.13-management-alpine"
}

run "without_broker_url_deploys_rabbitmq" {
  command = plan

  assert {
    condition     = length(kubernetes_deployment_v1.rabbitmq) == 1 && length(kubernetes_service_v1.rabbitmq) == 1
    error_message = "the in-cluster RabbitMQ must be deployed when broker_url is null"
  }

  assert {
    condition     = output.broker_url == "amqp://guest:guest@rabbitmq:5672/"
    error_message = "the broker URL must point at the in-cluster service"
  }
}

run "with_broker_url_skips_rabbitmq" {
  command = plan

  variables {
    broker_url = "amqps://smart-novel:3c9a1f0e7b2d@b-93fec4bf-2f66.mq.eu-central-1.amazonaws.com:5671"
  }

  assert {
    condition     = length(kubernetes_deployment_v1.rabbitmq) == 0 && length(kubernetes_service_v1.rabbitmq) == 0
    error_message = "RabbitMQ must not be deployed when an external broker_url is given"
  }

  assert {
    condition     = output.broker_url == var.broker_url
    error_message = "the external broker URL must be passed through"
  }
}
