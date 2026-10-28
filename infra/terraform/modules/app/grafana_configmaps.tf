locals {
  grafana_dir = "${path.module}/../../../observability/grafana/provisioning"
  dashboards  = var.publish_grafana_configmaps ? fileset("${local.grafana_dir}/dashboards/definitions", "*.json") : toset([])
}

# For a Grafana that is not deployed here: its sidecars copy ConfigMaps with these labels into it.
resource "kubernetes_config_map_v1" "shared_dashboard" {
  for_each = local.dashboards

  metadata {
    name      = "dashboard-${trimsuffix(each.key, ".json")}"
    namespace = module.namespace.name
    labels    = merge(var.labels, { grafana_dashboard = "1" })
  }

  data = { (each.key) = file("${local.grafana_dir}/dashboards/definitions/${each.key}") }
}

resource "kubernetes_config_map_v1" "shared_alert_rules" {
  count = var.publish_grafana_configmaps ? 1 : 0

  metadata {
    name      = "alert-rules"
    namespace = module.namespace.name
    labels    = merge(var.labels, { grafana_alert = "1" })
  }

  data = { "smart-novel-alert-rules.yaml" = file("${local.grafana_dir}/alerting/alert-rules.yaml") }
}
