module "namespace" {
  source = "../namespace"

  name   = var.namespace
  labels = var.labels
}

module "postgres" {
  source = "../postgres"

  namespace          = module.namespace.name
  labels             = var.labels
  image              = var.images["postgres"]
  database_url       = var.database_url
  password           = coalesce(var.postgres_password, "postgres")
  persistent_volumes = var.persistent_volumes
  storage_class_name = var.storage_class_name

  create_zitadel_database = var.create_zitadel_database
}

module "redis" {
  source = "../redis"

  namespace = module.namespace.name
  labels    = var.labels
  image     = var.images["redis"]
  redis_url = var.redis_url
  password  = var.redis_password
  node_port = var.redis_node_port
}

module "object_storage" {
  source = "../object_storage"

  namespace               = module.namespace.name
  labels                  = var.labels
  image                   = var.images["object_storage"]
  aws_cli_image           = var.images["aws_cli"]
  object_storage_endpoint = var.object_storage_endpoint
  seed_volume             = var.object_storage_seed_volume
  # One source of truth: the browser origins the backend already allows.
  cors_allowed_origins = [for origin in split(",", lookup(var.backend_environment, "CORS_ALLOWED_ORIGINS", "http://localhost:8080")) : trimspace(origin) if trimspace(origin) != ""]
  persistent_volumes   = var.persistent_volumes
  storage_class_name   = var.storage_class_name
}

locals {
  llm_base_url    = var.run_local_ai_models ? module.ollama[0].base_url : var.llm_base_url
  tts_base_url    = var.run_local_ai_models ? module.openai_compatible_tts[0].base_url : var.tts_base_url
  deploy_beatrice = local.llm_base_url != null && local.tts_base_url != null
  otlp_endpoint   = var.otlp_endpoint
  otlp_logs       = var.log_shipping == "otlp"
  beatrice_url    = one(module.beatrice[*].graphql_url)
  fithara_url     = module.fithara.url

  backend_environment = merge(
    var.backend_environment,
    { OBJECT_STORAGE_ENDPOINT = module.object_storage.endpoint },
    local.beatrice_url == null ? {} : { BEATRICE_URL = local.beatrice_url },
    { FITHARA_URL = local.fithara_url },
    local.otlp_endpoint == null ? { OTEL_ENABLED = "false" } : { OTEL_ENABLED = "true", OTEL_EXPORTER_OTLP_ENDPOINT = local.otlp_endpoint },
    { OTEL_LOGS_EXPORTER = local.otlp_logs ? "otlp" : "none" },
  )
  backend_secret_environment = merge(
    var.backend_secret_environment,
    { DATABASE_URL = module.postgres.database_url, REDIS_URL = module.redis.redis_url },
  )
}

module "ollama" {
  source = "../ollama"
  count  = var.run_local_ai_models ? 1 : 0

  namespace = module.namespace.name
  labels    = var.labels
  image     = var.images["ollama"]
  model     = var.llm_model
}

module "openai_compatible_tts" {
  source = "../openai_compatible_tts"
  count  = var.run_local_ai_models ? 1 : 0

  namespace = module.namespace.name
  labels    = var.labels
  image     = var.images["openai_compatible_tts"]
}

module "rabbitmq" {
  source = "../rabbitmq"
  count  = local.deploy_beatrice ? 1 : 0

  namespace  = module.namespace.name
  labels     = var.labels
  image      = var.images["rabbitmq"]
  broker_url = var.broker_url
}

module "beatrice" {
  source = "../beatrice"
  count  = local.deploy_beatrice ? 1 : 0

  namespace          = module.namespace.name
  labels             = var.labels
  image              = var.images["beatrice"]
  broker_url         = module.rabbitmq[0].broker_url
  llm_base_url       = local.llm_base_url
  llm_model          = var.llm_model
  tts_base_url       = local.tts_base_url
  tts_model          = var.tts_model
  llm_api_key        = coalesce(var.llm_api_key, "ollama")
  tts_api_key        = coalesce(var.tts_api_key, "local-dev-key")
  tts_voices         = coalesce(var.tts_voices, "default")
  otlp_http_endpoint = local.otlp_endpoint
  log_shipping       = var.log_shipping

  # Beatrice does not reconnect when the broker is unreachable at startup.
  depends_on = [module.rabbitmq, module.ollama, module.openai_compatible_tts]
}

module "fithara" {
  source = "../fithara"

  namespace          = module.namespace.name
  labels             = var.labels
  image              = var.images["fithara"]
  llm_provider       = var.fithara_llm_provider
  llm_base_url       = var.fithara_llm_base_url
  llm_model          = var.fithara_llm_model
  llm_api_key        = var.fithara_llm_api_key
  llm_timeout_ms     = var.fithara_llm_timeout_ms
  otlp_http_endpoint = local.otlp_endpoint
  log_shipping       = var.log_shipping

  depends_on = [module.ollama]
}

module "pre_deploy_job" {
  source   = "../job"
  for_each = { for job in var.pre_deploy_jobs : job.name => job if !var.wait_for_zitadel_credentials }

  namespace          = module.namespace.name
  labels             = var.labels
  name               = each.value.name
  image              = each.value.image
  command            = each.value.command
  environment        = merge(each.value.use_backend_environment ? local.backend_environment : {}, each.value.environment)
  secret_environment = each.value.use_backend_environment ? local.backend_secret_environment : {}
  volumes            = each.value.volumes

  depends_on = [module.postgres, module.redis, module.object_storage, module.beatrice]
}

module "backend" {
  source = "../backend"

  namespace          = module.namespace.name
  labels             = var.labels
  enabled            = !var.wait_for_zitadel_credentials
  image              = var.images["backend"]
  port               = var.backend_port
  environment        = local.backend_environment
  secret_environment = local.backend_secret_environment
  volumes            = var.backend_volumes
  wait_for           = [for job in module.pre_deploy_job : job.name]
}

module "frontend" {
  source = "../frontend"

  namespace   = module.namespace.name
  labels      = var.labels
  enabled     = !var.wait_for_zitadel_credentials
  image       = var.images["frontend"]
  port        = var.frontend_port
  command     = var.frontend_command
  files       = var.frontend_files
  environment = var.frontend_environment
  volumes     = var.frontend_volumes
  wait_for    = [for job in module.pre_deploy_job : job.name]
}

module "devtools" {
  source = "../devtools"
  count  = var.enable_devtools ? 1 : 0

  namespace           = module.namespace.name
  labels              = var.labels
  redis_insight_image = var.images["redis_insight"]
  pgadmin_image       = var.images["pgadmin"]
  open_webui_image    = var.images["open_webui"]
  redis               = module.redis.connection
  postgres            = module.postgres.connection
  ollama_base_url     = one(module.ollama[*].host_url)
}

resource "kubernetes_ingress_v1" "app" {
  metadata {
    name      = "app"
    namespace = module.namespace.name
    labels    = var.labels

    annotations = var.cluster_issuer == null ? {} : { "cert-manager.io/cluster-issuer" = var.cluster_issuer }
  }

  spec {
    ingress_class_name = var.ingress_class_name

    rule {
      host = var.ingress_host

      http {
        dynamic "path" {
          for_each = { for route in concat(module.backend.routes, module.frontend.routes) : route.name => route }

          content {
            path      = path.value.path
            path_type = "Prefix"

            backend {
              service {
                name = path.value.service_name

                port {
                  number = path.value.service_port
                }
              }
            }
          }
        }
      }
    }

    dynamic "tls" {
      for_each = var.cluster_issuer != null && var.ingress_host != null ? [var.ingress_host] : []

      content {
        hosts       = [tls.value]
        secret_name = "app-tls"
      }
    }
  }
}
