mock_provider "kubernetes" {}

variables {
  namespace       = "smart-novel"
  collector_image = "otel/opentelemetry-collector-contrib:0.110.0"
  jaeger_image    = "jaegertracing/all-in-one:1.62.0"
}

run "deploys_collector_and_jaeger_with_their_routes" {
  command = plan

  assert {
    condition     = kubernetes_service_v1.collector.metadata[0].name == "otel-collector" && kubernetes_service_v1.jaeger.metadata[0].name == "jaeger"
    error_message = "the collector and Jaeger must be reachable by those names inside the cluster"
  }

  assert {
    condition     = contains([for route in output.routes : route.name], "otel-collector-web") && contains([for route in output.routes : route.name], "jaeger-web")
    error_message = "the browser OTLP route and the Jaeger UI route must be contributed to the ingress"
  }
}

run "samples_everything_by_default" {
  command = plan

  assert {
    condition     = strcontains(kubernetes_config_map_v1.collector.data["config.yaml"], "sampling_percentage: 100")
    error_message = "the default sampling ratio must keep every trace"
  }
}

run "sampling_ratio_sets_the_percentage" {
  command = plan

  variables {
    sampling_ratio = 0.25
  }

  assert {
    condition     = strcontains(kubernetes_config_map_v1.collector.data["config.yaml"], "sampling_percentage: 25")
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

run "jaeger_serves_under_the_configured_path" {
  command = plan

  variables {
    jaeger_path = "/tracing"
  }

  assert {
    condition     = one([for route in output.routes : route.rule if route.name == "jaeger-web"]) == "PathPrefix(`/tracing`)"
    error_message = "the Jaeger route must follow jaeger_path"
  }
}
