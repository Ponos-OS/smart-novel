locals {
  repo_root = abspath("${path.module}/../../../..")
  node_apps = "/workspace/apps"

  dotenv_path = "${local.repo_root}/.env"
  dotenv = fileexists(local.dotenv_path) ? {
    for match in regexall("(?m)^([A-Z][A-Z0-9_]*)=(\\S*)", file(local.dotenv_path)) : match[0] => match[1]
  } : {}

  built_images = concat(var.images, var.enable_ai ? values(var.ai_images) : [])
  third_party_images = merge(var.third_party_images, {
    beatrice = "9109679196/smart-novel-beatrice:${local.dotenv["BEATRICE_VERSION"]}"
  })

  s3_api_node_port     = 30900
  s3_console_node_port = 30901
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
        container_port = local.s3_api_node_port
        host_port      = var.s3_port
        listen_address = "127.0.0.1"
      }

      extra_port_mappings {
        container_port = local.s3_console_node_port
        host_port      = var.s3_console_port
        listen_address = "127.0.0.1"
      }

      extra_mounts {
        host_path      = "${local.repo_root}/apps"
        container_path = local.node_apps
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

  labels          = var.tags
  dev_source_path = local.node_apps
  images          = merge(local.third_party_images, var.ai_images, { setup_zitadel = "smart-novel-setup-zitadel:dev" })
  enable_ai       = var.enable_ai
  llm_base_url    = var.llm_base_url
  llm_model       = lookup(local.dotenv, "OLLAMA_MODEL", "llama3.2:1b")
  tts_base_url    = var.tts_base_url
  external_port   = var.host_port

  object_storage_api_node_port     = local.s3_api_node_port
  object_storage_console_node_port = local.s3_console_node_port

  depends_on = [terraform_data.load_images]
}
