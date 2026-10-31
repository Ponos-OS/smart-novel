locals {
  repo_root = abspath("${path.module}/../../../..")
  node_apps = "/workspace/apps"
  node_libs = "/workspace/libs"

  dotenv_path = "${local.repo_root}/.env"
  dotenv = fileexists(local.dotenv_path) ? {
    for match in regexall("(?m)^([A-Z][A-Z0-9_]*)=(.*)$", file(local.dotenv_path)) :
    match[0] => trim(trimspace(replace(match[1], "/\\s+#.*$/", "")), "'\"")
  } : {}

  secret_key_pattern = "PASSWORD|SECRET|MASTERKEY|ACCESS_KEY"
  backend_environment = {
    for key, value in local.dotenv : key => value
    if !startswith(key, "VITE_") && !can(regex(local.secret_key_pattern, key)) && key != "FITHARA_LLM_API_KEY"
  }
  backend_secret_environment = {
    for key, value in local.dotenv : key => value
    if !startswith(key, "VITE_") && can(regex(local.secret_key_pattern, key))
  }
  frontend_environment = merge(
    { for key, value in local.dotenv : key => value if startswith(key, "VITE_") },
    {
      VITE_EXPLAIN_CONTEXT_CHAR_SIZE     = local.dotenv["EXPLAIN_CONTEXT_CHAR_SIZE"]
      VITE_EXPLAIN_RATE_CAPACITY         = "12"
      VITE_EXPLAIN_CACHE_MAX_ENTRIES     = "12"
      VITE_EXPLAIN_RATE_REFILL_PER_SEC   = "1.5"
      VITE_EXPLAIN_SELECTION_DEBOUNCE_MS = "500"
    },
  )

  # Hot reload (dev): the development images run against the sources mounted from the node. e2e runs the production images instead; only the init Job still needs the sources, to push the schema and seed.
  hot_reload = var.mode == "dev"

  apps_volume = { name = "apps", mount_path = "/app/apps", host_path = local.node_apps }
  libs_volume = { name = "libs", mount_path = "/app/libs", host_path = local.node_libs }
  data_volume = { name = "data", mount_path = "/data", host_path = "${local.node_apps}/backend/data" }

  tooling_image  = "smart-novel-backend:dev"
  backend_image  = local.hot_reload ? local.tooling_image : "smart-novel-backend:e2e"
  frontend_image = local.hot_reload ? "smart-novel-frontend:dev" : "smart-novel-frontend:e2e"

  pre_deploy_jobs = concat(
    [
      {
        name                    = "backend-init"
        image                   = local.tooling_image
        command                 = ["/bin/sh", "-lc", "npx nx run backend:prisma:db:push && npx nx prisma:generate backend && npx nx run backend:prisma:seed"]
        use_backend_environment = true
        environment             = local.init_job_environment
        volumes                 = [local.apps_volume, local.libs_volume, local.data_volume]
      },
    ],
    local.hot_reload ? [
      {
        name  = "frontend-codegen"
        image = local.tooling_image
        # Prisma generates into the image's node_modules, so this runs as root; the files written into the mounted sources are handed back to the host user afterwards.
        command     = ["/bin/sh", "-c", "npx nx codegen frontend; status=$?; chown -R ${var.run_as_user} /app/apps; exit $status"]
        environment = { DATABASE_URL = "postgresql://dummy", BEATRICE_VERSION = local.dotenv["BEATRICE_VERSION"], FITHARA_VERSION = local.dotenv["FITHARA_VERSION"], NX_DAEMON = "false" }
        volumes     = [local.apps_volume, local.libs_volume]
      },
    ] : [],
  )

  # Stage 2 configures ZITADEL and outputs what the workloads need; the workloads are held back until it has run.
  zitadel                            = one(data.terraform_remote_state.zitadel[*].outputs)
  zitadel_backend_environment        = local.zitadel == null ? {} : { ZITADEL_CLIENT_ID = local.zitadel.client_id }
  zitadel_backend_secret_environment = local.zitadel == null ? {} : { ZITADEL_PAT = local.zitadel.pat, ZITADEL_MANAGEMENT_PAT = local.zitadel.backend_pat }
  zitadel_frontend_environment       = local.zitadel == null ? {} : { VITE_OIDC_CLIENT_ID = local.zitadel.client_id }
  init_job_environment               = local.zitadel == null ? {} : { ZITADEL_WRITER_USER_ID = local.zitadel.user_ids["writer"] }

  backend_environment_by_mode = merge(
    local.hot_reload ? local.backend_environment : merge(local.backend_environment, { OLLAMA_RETRY_COUNT = "1" }),
    local.zitadel_backend_environment,
  )
  backend_volumes = local.hot_reload ? [local.apps_volume, local.libs_volume, local.data_volume] : []

  frontend_script = local.hot_reload ? "start-frontend-dev.sh" : "start-frontend-e2e.sh"
  frontend_port   = local.hot_reload ? tonumber(local.dotenv["FRONTEND_PORT"]) : 80
  frontend_volumes = local.hot_reload ? [
    { name = "sources", mount_path = "/app/apps/frontend", host_path = "${local.node_apps}/frontend" },
    local.libs_volume,
  ] : []
  frontend_environment_by_mode = merge(local.hot_reload ? local.frontend_environment : {}, local.zitadel_frontend_environment)

  built_images = concat(
    [local.tooling_image],
    local.hot_reload ? [local.frontend_image] : [local.backend_image, local.frontend_image],
    var.run_local_ai_models ? values(var.ai_images) : [],
  )
  third_party_images = merge(var.third_party_images, var.enable_devtools ? var.devtools_images : {}, {
    beatrice = "9109679196/smart-novel-beatrice:${local.dotenv["BEATRICE_VERSION"]}"
    fithara  = "9109679196/fithara:${local.dotenv["FITHARA_VERSION"]}"
  })

  redis_node_port = 30379

  # The collector's Service name is fixed, and the app is created before the observability module because it provides the namespace.
  ingress_class_name = "traefik"
  otlp_endpoint      = var.enable_observability ? "http://otel-collector:4318" : null
  log_shipping       = lookup(local.dotenv, "OTEL_LOGS_EXPORTER", "otlp") == "otlp" ? "otlp" : "stdout"
}

check "otlp_endpoint_matches_the_collector" {
  assert {
    condition     = !var.enable_observability || local.otlp_endpoint == module.observability[0].otlp_http_endpoint
    error_message = "the OTLP endpoint given to the app must be the one the observability module serves"
  }
}

data "terraform_remote_state" "zitadel" {
  count   = var.wait_for_zitadel_credentials ? 0 : 1
  backend = "local"

  config = {
    path = "${path.module}/../local-zitadel/terraform.tfstate"
  }
}

resource "kind_cluster" "this" {
  name            = var.cluster_name
  wait_for_ready  = true
  kubeconfig_path = "${path.module}/${var.cluster_name}-config"

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    node {
      role = "control-plane"

      kubeadm_config_patches = [
        "kind: InitConfiguration\nnodeRegistration:\n  kubeletExtraArgs:\n    node-labels: \"ingress-ready=true\"\n"
      ]

      extra_port_mappings {
        container_port = 80
        host_port      = var.host_port
        listen_address = "127.0.0.1"
      }

      extra_port_mappings {
        container_port = local.redis_node_port
        host_port      = var.redis_port
        listen_address = "127.0.0.1"
      }

      extra_mounts {
        host_path      = "${local.repo_root}/apps"
        container_path = local.node_apps
      }

      extra_mounts {
        host_path      = "${local.repo_root}/libs"
        container_path = local.node_libs
      }
    }
  }
}

# Makes the images that start-dev.sh built, plus the third-party ones (pulled once on the host if missing), available inside the kind node. Third-party images are exported for the host platform only: with Docker's containerd image store a pulled image is a multi-platform index whose other blobs were never downloaded, which `kind load docker-image` cannot import.
resource "terraform_data" "load_images" {
  triggers_replace = [kind_cluster.this.id, timestamp()]

  provisioner "local-exec" {
    command = <<-EOT
      kind load docker-image ${join(" ", local.built_images)} --name ${var.cluster_name} || exit 1
      platform="$(docker version --format '{{.Server.Os}}/{{.Server.Arch}}')"
      archive_dir="$(mktemp -d)"
      trap 'rm -rf "$archive_dir"' EXIT
      for image in ${join(" ", values(local.third_party_images))}; do
        docker image inspect "$image" > /dev/null 2>&1 || docker pull "$image" || exit 1
        docker save --platform "$platform" "$image" -o "$archive_dir/image.tar" || exit 1
        kind load image-archive "$archive_dir/image.tar" --name ${var.cluster_name} || exit 1
      done
    EOT
  }
}

module "app" {
  source = "../../modules/app"

  labels = var.tags
  images = merge(local.third_party_images, var.ai_images, {
    backend  = local.backend_image
    frontend = local.frontend_image
  })
  wait_for_zitadel_credentials = var.wait_for_zitadel_credentials
  run_local_ai_models          = var.run_local_ai_models
  llm_base_url                 = var.llm_base_url
  llm_model                    = lookup(local.dotenv, "BEATRICE_LLM_MODEL", "llama3.2:1b")
  fithara_llm_provider         = lookup(local.dotenv, "FITHARA_LLM_PROVIDER", null)
  fithara_llm_model            = lookup(local.dotenv, "FITHARA_LLM_MODEL", null)
  fithara_llm_base_url         = lookup(local.dotenv, "FITHARA_LLM_BASE_URL", null)
  fithara_llm_api_key          = lookup(local.dotenv, "FITHARA_LLM_API_KEY", null)
  fithara_llm_timeout_ms       = tonumber(lookup(local.dotenv, "FITHARA_LLM_TIMEOUT_MS", null))
  tts_model                    = lookup(local.dotenv, "BEATRICE_TTS_MODEL", "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice")
  tts_base_url                 = var.tts_base_url
  llm_api_key                  = var.llm_api_key
  tts_api_key                  = var.tts_api_key
  tts_voices                   = var.tts_voices

  backend_port               = tonumber(local.dotenv["BACKEND_PORT"])
  backend_environment        = local.backend_environment_by_mode
  backend_secret_environment = merge(local.backend_secret_environment, local.zitadel_backend_secret_environment)
  backend_volumes            = local.backend_volumes

  frontend_port        = local.frontend_port
  frontend_environment = local.frontend_environment_by_mode
  frontend_command     = ["/bin/sh", "/scripts/${local.frontend_script}"]
  frontend_files       = { "/scripts/${local.frontend_script}" = file("${path.module}/files/${local.frontend_script}") }
  frontend_volumes     = local.frontend_volumes

  enable_devtools = var.enable_devtools

  pre_deploy_jobs            = local.pre_deploy_jobs
  object_storage_seed_volume = { host_path = "${local.node_apps}/backend/data" }
  otlp_endpoint              = local.otlp_endpoint
  log_shipping               = local.log_shipping
  ingress_class_name         = local.ingress_class_name

  redis_node_port = local.redis_node_port

  depends_on = [terraform_data.load_images]
}

module "observability" {
  source = "../../modules/observability"
  count  = var.enable_observability ? 1 : 0

  namespace = module.app.namespace
  labels    = var.tags
  images = {
    otel-collector = local.third_party_images["otel_collector"]
    tempo          = local.third_party_images["tempo"]
    loki           = local.third_party_images["loki"]
    prometheus     = local.third_party_images["prometheus"]
    grafana        = local.third_party_images["grafana"]
  }
  sampling_ratio   = var.trace_sampling_ratio
  grafana_root_url = "http://grafana.localhost:${var.host_port}"
}

module "alloy" {
  source = "../../modules/alloy"
  count  = var.enable_observability && local.log_shipping == "stdout" ? 1 : 0

  namespace = module.app.namespace
  labels    = var.tags
  image     = local.third_party_images["alloy"]
}

module "zitadel" {
  source = "../../modules/zitadel"

  namespace     = module.app.namespace
  labels        = var.tags
  image         = local.third_party_images["zitadel"]
  login_image   = local.third_party_images["zitadel_login"]
  busybox_image = local.third_party_images["busybox"]
  external_port = var.host_port

  depends_on = [module.app]
}

module "ingress" {
  source = "../../modules/ingress"

  namespace          = module.app.namespace
  labels             = var.tags
  image              = local.third_party_images["traefik"]
  ingress_class_name = local.ingress_class_name
  routes             = concat(module.zitadel.routes, flatten(module.observability[*].routes), module.app.tool_routes)
  middlewares        = module.zitadel.middlewares
}

moved {
  from = module.app.module.zitadel
  to   = module.zitadel
}

moved {
  from = module.app.module.observability
  to   = module.observability
}

moved {
  from = module.app.module.ingress
  to   = module.ingress
}
