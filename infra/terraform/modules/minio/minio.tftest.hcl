mock_provider "kubernetes" {}

variables {
  namespace = "smart-novel"
  image     = "quay.io/minio/minio:RELEASE.2025-04-08T15-41-24Z"
  mc_image  = "quay.io/minio/mc:RELEASE.2025-04-08T15-39-49Z"
}

run "without_endpoint_deploys_minio_and_initializes_the_bucket" {
  command = plan

  assert {
    condition     = length(kubernetes_deployment_v1.minio) == 1 && length(kubernetes_job_v1.init) == 1
    error_message = "the in-cluster MinIO and its init job must be deployed when object_storage_endpoint is null"
  }

  assert {
    condition     = kubernetes_service_v1.s3[0].spec[0].type == "ClusterIP"
    error_message = "the service is cluster-internal unless a node port is given"
  }
}

run "with_node_ports_exposes_the_service_to_the_host" {
  command = plan

  variables {
    api_node_port     = 30900
    console_node_port = 30901
  }

  assert {
    condition     = kubernetes_service_v1.s3[0].spec[0].type == "NodePort"
    error_message = "node ports must turn the service into a NodePort"
  }
}

run "with_seed_data_path_mounts_the_covers_into_the_init_job" {
  command = plan

  variables {
    seed_data_path = "/workspace/apps/backend/data"
  }

  assert {
    condition     = length(kubernetes_job_v1.init[0].spec[0].template[0].spec[0].volume) == 2
    error_message = "the seed data must be mounted next to the bucket policy"
  }
}

run "without_seed_data_path_mounts_only_the_policy" {
  command = plan

  assert {
    condition     = length(kubernetes_job_v1.init[0].spec[0].template[0].spec[0].volume) == 1
    error_message = "no seed data means nothing to mount besides the bucket policy"
  }
}

run "with_endpoint_skips_minio" {
  command = plan

  variables {
    object_storage_endpoint = "https://s3.eu-central-1.amazonaws.com"
  }

  assert {
    condition     = length(kubernetes_deployment_v1.minio) == 0 && length(kubernetes_job_v1.init) == 0
    error_message = "MinIO must not be deployed when an external object_storage_endpoint is given"
  }
}
