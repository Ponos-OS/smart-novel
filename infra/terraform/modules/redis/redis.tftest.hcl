mock_provider "kubernetes" {}

variables {
  namespace = "smart-novel"
  image     = "redis:8.6-alpine3.23"
}

run "without_redis_url_deploys_passwordless_redis" {
  command = plan

  assert {
    condition     = length(kubernetes_deployment_v1.redis) == 1 && length(kubernetes_service_v1.redis) == 1
    error_message = "the in-cluster Redis must be deployed when redis_url is null"
  }

  assert {
    condition     = length(kubernetes_secret_v1.redis) == 0
    error_message = "no secret is needed without a password"
  }
}

run "with_password_stores_it_in_a_secret" {
  command = plan

  variables {
    password = "7d1e5b9a4c20"
  }

  assert {
    condition     = length(kubernetes_secret_v1.redis) == 1
    error_message = "the password must be stored in a secret"
  }
}

run "with_redis_url_skips_redis" {
  command = plan

  variables {
    redis_url = "rediss://:3c9a1f0e7b2d@smart-novel.93fec4.ng.0001.euc1.cache.amazonaws.com:6379"
  }

  assert {
    condition     = length(kubernetes_deployment_v1.redis) == 0 && length(kubernetes_service_v1.redis) == 0
    error_message = "Redis must not be deployed when an external redis_url is given"
  }
}
