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
  seed_data_path          = var.dev_source_path == null ? null : "${var.dev_source_path}/backend/data"
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

module "ingress" {
  source = "../ingress"

  namespace   = module.namespace.name
  labels      = var.labels
  image       = var.images["traefik"]
  routes      = module.zitadel.routes
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
