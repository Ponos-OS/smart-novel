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
  persistent_volumes = var.persistent_volumes
  storage_class_name = var.storage_class_name
}

module "redis" {
  source = "../redis"

  namespace = module.namespace.name
  labels    = var.labels
  image     = var.images["redis"]
  redis_url = var.redis_url
  node_port = var.redis_node_port
}

module "minio" {
  source = "../minio"

  namespace               = module.namespace.name
  labels                  = var.labels
  image                   = var.images["minio"]
  mc_image                = var.images["minio_mc"]
  object_storage_endpoint = var.object_storage_endpoint
  api_node_port           = var.object_storage_api_node_port
  console_node_port       = var.object_storage_console_node_port
  seed_volume             = var.minio_seed_volume
  persistent_volumes      = var.persistent_volumes
  storage_class_name      = var.storage_class_name
}

module "zitadel" {
  source = "../zitadel"

  namespace     = module.namespace.name
  labels        = var.labels
  image         = var.images["zitadel"]
  login_image   = var.images["zitadel_login"]
  busybox_image = var.images["busybox"]
  external_port = var.external_port

  depends_on = [module.postgres]
}

module "observability" {
  source = "../observability"
  count  = var.enable_observability ? 1 : 0

  namespace       = module.namespace.name
  labels          = var.labels
  collector_image = var.images["otel_collector"]
  jaeger_image    = var.images["jaeger"]
  sampling_ratio  = var.trace_sampling_ratio
}

locals {
  llm_base_url    = var.enable_ai ? module.ollama[0].base_url : var.llm_base_url
  tts_base_url    = var.enable_ai ? module.qwen_tts[0].base_url : var.tts_base_url
  deploy_beatrice = local.llm_base_url != null && local.tts_base_url != null
  otlp_endpoint   = one(module.observability[*].otlp_http_endpoint)
  beatrice_url    = one(module.beatrice[*].graphql_url)

  backend_environment = merge(
    var.backend_environment,
    { OBJECT_STORAGE_ENDPOINT = module.minio.endpoint },
    local.beatrice_url == null ? {} : { BEATRICE_URL = local.beatrice_url },
    local.otlp_endpoint == null ? { OTEL_ENABLED = "false" } : { OTEL_ENABLED = "true", OTEL_EXPORTER_OTLP_ENDPOINT = local.otlp_endpoint },
  )
  backend_secret_environment = merge(
    var.backend_secret_environment,
    { DATABASE_URL = module.postgres.database_url, REDIS_URL = module.redis.redis_url },
  )
}

module "ollama" {
  source = "../ollama"
  count  = var.enable_ai ? 1 : 0

  namespace = module.namespace.name
  labels    = var.labels
  image     = var.images["ollama"]
  model     = var.llm_model
}

module "qwen_tts" {
  source = "../qwen_tts"
  count  = var.enable_ai ? 1 : 0

  namespace = module.namespace.name
  labels    = var.labels
  image     = var.images["qwen_tts"]
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

  # Beatrice does not reconnect when the broker is unreachable at startup.
  depends_on = [module.rabbitmq, module.ollama, module.qwen_tts]
}

locals {
  credentials = module.zitadel_setup.credentials

  backend_volumes = concat(
    [{ name = "credentials", mount_path = local.credentials.mount_path, read_only = true, host_path = null, claim_name = local.credentials.claim_name }],
    [for volume in var.backend_volumes : merge(volume, { claim_name = volume.zitadel_credentials ? local.credentials.claim_name : volume.claim_name })],
  )
  frontend_volumes = [
    for volume in var.frontend_volumes : merge(volume, { claim_name = volume.zitadel_credentials ? local.credentials.claim_name : volume.claim_name })
  ]
}

module "pre_deploy_job" {
  source   = "../job"
  for_each = { for job in var.pre_deploy_jobs : job.name => job }

  namespace          = module.namespace.name
  labels             = var.labels
  name               = each.value.name
  image              = each.value.image
  command            = each.value.command
  environment        = merge(each.value.use_backend_environment ? local.backend_environment : {}, each.value.environment)
  secret_environment = each.value.use_backend_environment ? local.backend_secret_environment : {}
  volumes            = [for volume in each.value.volumes : merge(volume, { claim_name = volume.zitadel_credentials ? local.credentials.claim_name : volume.claim_name })]

  depends_on = [module.postgres, module.redis, module.minio, module.beatrice, module.observability, module.zitadel_setup]
}

module "backend" {
  source = "../backend"

  namespace          = module.namespace.name
  labels             = var.labels
  image              = var.images["backend"]
  port               = var.backend_port
  environment        = local.backend_environment
  secret_environment = local.backend_secret_environment
  volumes            = local.backend_volumes
  wait_for           = [for job in module.pre_deploy_job : job.name]
}

module "frontend" {
  source = "../frontend"

  namespace   = module.namespace.name
  labels      = var.labels
  image       = var.images["frontend"]
  port        = var.frontend_port
  command     = var.frontend_command
  files       = var.frontend_files
  environment = var.frontend_environment
  volumes     = local.frontend_volumes
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
  node_ports          = var.devtools_node_ports
}

module "ingress" {
  source = "../ingress"

  namespace   = module.namespace.name
  labels      = var.labels
  image       = var.images["traefik"]
  routes      = concat(module.zitadel.routes, flatten(module.observability[*].routes), module.backend.routes, module.frontend.routes)
  middlewares = module.zitadel.middlewares
}

module "zitadel_setup" {
  source = "../zitadel_setup"

  namespace   = module.namespace.name
  labels      = var.labels
  image       = var.images["setup_zitadel"]
  zitadel_url = module.ingress.internal_url
  credentials = module.zitadel.credentials

  depends_on = [module.zitadel, module.ingress]
}
