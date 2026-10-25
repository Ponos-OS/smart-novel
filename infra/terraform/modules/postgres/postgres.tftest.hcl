mock_provider "kubernetes" {}

variables {
  namespace = "smart-novel"
  image     = "postgres:18.2-bookworm"
}

run "without_database_url_deploys_postgres" {
  command = plan

  assert {
    condition     = length(kubernetes_deployment_v1.postgres) == 1 && length(kubernetes_service_v1.postgres) == 1
    error_message = "the in-cluster PostgreSQL must be deployed when database_url is null"
  }

  assert {
    condition     = length(kubernetes_persistent_volume_claim_v1.postgres) == 0
    error_message = "local data is throwaway unless persistent_volumes is true"
  }
}

run "with_persistent_volumes_keeps_data_on_a_claim" {
  command = plan

  variables {
    persistent_volumes = true
  }

  assert {
    condition     = length(kubernetes_persistent_volume_claim_v1.postgres) == 1
    error_message = "persistent_volumes must create the claim"
  }
}

run "with_database_url_skips_postgres" {
  command = plan

  variables {
    database_url = "postgresql://smart_novel:3c9a1f0e7b2d@db-93fec4bf.eu-central-1.rds.amazonaws.com:5432/smart_novel"
  }

  assert {
    condition     = length(kubernetes_deployment_v1.postgres) == 0 && length(kubernetes_service_v1.postgres) == 0
    error_message = "PostgreSQL must not be deployed when an external database_url is given"
  }
}

run "without_the_zitadel_database_there_is_no_init_script" {
  command = plan

  variables {
    create_zitadel_database = false
  }

  assert {
    condition     = length(kubernetes_config_map_v1.init) == 0 && length(kubernetes_deployment_v1.postgres[0].spec[0].template[0].spec[0].volume) == 1
    error_message = "the init script and its volume must be absent when ZITADEL does not share this database"
  }
}
