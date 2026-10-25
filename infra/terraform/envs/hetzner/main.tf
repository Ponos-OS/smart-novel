locals {
  zitadel_ready = var.zitadel_client_id != null && nonsensitive(var.zitadel_pat != null)

  backend_environment = merge(
    var.backend_environment,
    local.zitadel_ready ? { ZITADEL_CLIENT_ID = var.zitadel_client_id } : {},
  )
  backend_secret_environment = merge(
    var.backend_secret_environment,
    local.zitadel_ready ? { ZITADEL_PAT = var.zitadel_pat } : {},
  )
  frontend_environment = merge(
    var.frontend_environment,
    local.zitadel_ready ? { VITE_OIDC_CLIENT_ID = var.zitadel_client_id } : {},
  )
}

module "app" {
  source = "../../modules/app"

  namespace = var.namespace
  labels    = var.tags
  images    = var.images

  persistent_volumes      = true
  storage_class_name      = var.storage_class
  create_zitadel_database = false
  postgres_password       = var.postgres_password
  redis_password          = var.redis_password
  object_storage_endpoint = var.object_storage_endpoint

  ingress_class_name = var.ingress_class
  ingress_host       = var.domain
  cluster_issuer     = var.cluster_issuer
  otlp_endpoint      = var.otel_collector_endpoint

  run_local_ai_models = false
  llm_base_url        = var.llm_base_url
  llm_model           = var.llm_model
  llm_api_key         = var.llm_api_key
  tts_base_url        = var.tts_base_url
  tts_model           = var.tts_model
  tts_api_key         = var.tts_api_key
  tts_voices          = var.tts_voices

  wait_for_zitadel_credentials = !local.zitadel_ready
  backend_environment          = local.backend_environment
  backend_secret_environment   = local.backend_secret_environment
  frontend_environment         = local.frontend_environment
  frontend_command             = ["/bin/sh", "/scripts/start-frontend.sh"]
  frontend_files               = { "/scripts/start-frontend.sh" = file("${path.module}/files/start-frontend.sh") }

  pre_deploy_jobs = [
    {
      name                    = "backend-migrate"
      image                   = var.migrate_image
      command                 = var.migrate_command
      use_backend_environment = true
    },
  ]
}

module "backup" {
  source = "../../modules/backup"

  namespace      = module.app.namespace
  labels         = var.tags
  postgres_image = var.images.postgres
  aws_cli_image  = var.images.aws_cli
  database_url   = module.app.database_url
  endpoint       = var.backup_endpoint
  bucket         = var.backup_bucket
  access_key     = var.backup_access_key
  secret_key     = var.backup_secret_key
}
