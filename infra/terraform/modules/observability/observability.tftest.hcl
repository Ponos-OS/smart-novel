mock_provider "kubernetes" {}
mock_provider "random" {}

variables {
  namespace = "smart-novel"
  images = {
    otel-collector = "otel/opentelemetry-collector-contrib:0.161.0"
    tempo          = "grafana/tempo:3.0.0"
    loki           = "grafana/loki:3.7.8"
    prometheus     = "prom/prometheus:v3.15.0"
    grafana        = "grafana/grafana:13.2.2"
  }
}

run "deploys_the_stack_with_its_routes" {
  command = plan

  assert {
    condition     = toset(keys(kubernetes_service_v1.stack)) == toset(["otel-collector", "tempo", "loki", "prometheus"]) && kubernetes_service_v1.grafana.metadata[0].name == "grafana"
    error_message = "the collector, Tempo, Loki, Prometheus and Grafana must be reachable by those names inside the cluster"
  }

  assert {
    condition     = contains([for route in output.routes : route.name], "otel-collector-web") && one([for route in output.routes : route.rule if route.name == "grafana-web"]) == "Host(`grafana.localhost`)"
    error_message = "the browser OTLP route and Grafana's host route must be contributed to the ingress"
  }
}

run "the_collector_sends_traces_to_tempo" {
  command = plan

  assert {
    condition     = strcontains(kubernetes_config_map_v1.stack["otel-collector"].data["config.yaml"], "exporters: [otlp_grpc/tempo]")
    error_message = "the traces pipeline must export to Tempo"
  }
}

run "samples_everything_by_default" {
  command = plan

  assert {
    condition     = strcontains(kubernetes_config_map_v1.stack["otel-collector"].data["config.yaml"], "sampling_percentage: 100")
    error_message = "the default sampling ratio must keep every trace"
  }
}

run "sampling_ratio_sets_the_percentage" {
  command = plan

  variables {
    sampling_ratio = 0.25
  }

  assert {
    condition     = strcontains(kubernetes_config_map_v1.stack["otel-collector"].data["config.yaml"], "sampling_percentage: 25")
    error_message = "the sampling ratio must become the collector's sampling percentage"
  }
}

run "rejects_a_sampling_ratio_above_one" {
  command = plan

  variables {
    sampling_ratio = 1.5
  }

  expect_failures = [var.sampling_ratio]
}

run "prometheus_scrapes_rabbitmq_labelled_with_the_namespace" {
  command = plan

  assert {
    condition     = strcontains(kubernetes_config_map_v1.stack["prometheus"].data["prometheus.yml"], "rabbitmq:15692") && strcontains(kubernetes_config_map_v1.stack["prometheus"].data["prometheus.yml"], "namespace: smart-novel")
    error_message = "the dashboard and alert queries filter on the namespace label, so the local series must carry it"
  }
}

run "grafana_loads_the_dashboard_and_alert_rules_from_files" {
  command = plan

  assert {
    condition     = contains(keys(kubernetes_config_map_v1.grafana.data), "smart-novel-rabbitmq.json") && contains(keys(kubernetes_config_map_v1.grafana.data), "alert-rules.yaml") && contains(keys(kubernetes_config_map_v1.grafana.data), "datasources.yaml")
    error_message = "Grafana must be provisioned with the datasources, the dashboard and the alert rules"
  }

  assert {
    condition     = anytrue([for e in kubernetes_deployment_v1.grafana.spec[0].template[0].spec[0].container[0].env : e.name == "GF_SECURITY_ADMIN_PASSWORD" && length(e.value_from) > 0])
    error_message = "the administrator password must come from the Secret, not a literal value"
  }
}
