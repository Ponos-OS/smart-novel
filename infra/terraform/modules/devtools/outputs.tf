output "routes" {
  description = "Routes for the ingress: each deployed tool on its own host, because none of them can be served under a path prefix"
  value = concat(
    [for service in kubernetes_service_v1.redis_insight : { name = "redis-insight", rule = "Host(`${var.hosts.redis_insight}`)", priority = 300, service = "http://${service.metadata[0].name}:5540" }],
    [for service in kubernetes_service_v1.pgadmin : { name = "pgadmin", rule = "Host(`${var.hosts.pgadmin}`)", priority = 300, service = "http://${service.metadata[0].name}:80" }],
    [for service in kubernetes_service_v1.open_webui : { name = "open-webui", rule = "Host(`${var.hosts.open_webui}`)", priority = 300, service = "http://${service.metadata[0].name}:8080" }],
  )
}
