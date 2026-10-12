mock_provider "kubernetes" {}

variables {
  namespace = "smart-novel"
  labels    = { Project = "smart-novel" }
  images = {
    postgres      = "postgres:18.2-bookworm"
    redis         = "redis:8.6-alpine3.23"
    minio         = "quay.io/minio/minio:RELEASE.2025-04-08T15-41-24Z"
    minio_mc      = "quay.io/minio/mc:RELEASE.2025-04-08T15-39-49Z"
    traefik       = "traefik:v3.6.8"
    zitadel       = "ghcr.io/zitadel/zitadel:v4.12.3"
    zitadel_login = "ghcr.io/zitadel/zitadel-login:v4.12.3"
    busybox       = "busybox:1.37"
    setup_zitadel = "smart-novel-setup-zitadel:dev"
  }
}

run "deploys_into_the_given_namespace" {
  command = plan

  assert {
    condition     = module.namespace.name == "smart-novel"
    error_message = "the app module must create the namespace it is given"
  }
}

run "deploys_every_data_component_by_default" {
  command = plan

  assert {
    condition     = length(module.postgres.database_url) > 0 && length(module.redis.redis_url) > 0 && module.minio.endpoint == "http://s3:9000"
    error_message = "postgres, redis and minio must be deployed when no external service is given"
  }
}

run "routes_the_zitadel_endpoints_through_the_ingress" {
  command = plan

  assert {
    condition     = strcontains(module.ingress.internal_url, "traefik") && length(module.zitadel.routes) == 2
    error_message = "the ingress must be wired with the routes the zitadel module contributes"
  }
}
