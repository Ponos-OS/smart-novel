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

run "exposes_metrics_for_prometheus" {
  command = plan

  assert {
    condition     = kubernetes_deployment_v1.rabbitmq[0].spec[0].template[0].metadata[0].annotations["prometheus.io/port"] == "15692" && strcontains(kubernetes_config_map_v1.plugins[0].data["enabled_plugins"], "rabbitmq_prometheus")
    error_message = "the Prometheus plugin must be enabled and the pod annotated for scraping"
  }
}

run "routes_the_management_ui_by_host" {
  command = plan

  assert {
    condition     = one(output.routes).rule == "Host(`rabbitmq.localhost`)" && one(output.routes).service == "http://rabbitmq:15672"
    error_message = "the management UI must be routed by host to the in-cluster service"
  }
}

run "an_external_broker_has_no_routes" {
  command = plan

  variables {
    broker_url = "amqps://smart-novel:3c9a1f0e7b2d@b-93fec4bf-2f66.mq.eu-central-1.amazonaws.com:5671"
  }

  assert {
    condition     = length(output.routes) == 0
    error_message = "an external broker must not contribute routes"
  }
}

run "every_service_port_is_named" {
  command = plan

  assert {
    condition     = alltrue([for port in kubernetes_service_v1.rabbitmq[0].spec[0].port : port.name != null && port.name != ""])
    error_message = "Kubernetes requires a name on each port of a multi-port Service"
  }
}
