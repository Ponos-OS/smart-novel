mock_provider "kubernetes" {}

variables {
  namespace = "smart-novel"
  name      = "backend-init"
  image     = "smart-novel-backend:dev"
  command   = ["/bin/sh", "-c", "npx nx run backend:prisma:db:push"]
}

run "secrets_stay_out_of_the_pod_spec" {
  command = plan

  variables {
    environment        = { LOG_LEVEL = "http" }
    secret_environment = { DATABASE_URL = "postgresql://postgres:postgres@postgres:5432/smart_novel" }
  }

  assert {
    condition     = length(kubernetes_job_v1.job.spec[0].template[0].spec[0].container[0].env) == 1
    error_message = "only the plain variables belong in the pod spec"
  }

  assert {
    condition     = toset(keys(nonsensitive(kubernetes_secret_v1.job.data))) == toset(["DATABASE_URL"])
    error_message = "the database URL carries a password and must be in the secret"
  }
}

run "volumes_come_from_the_input" {
  command = plan

  variables {
    volumes = [
      { name = "apps", mount_path = "/app/apps", host_path = "/workspace/apps" },
      { name = "credentials", mount_path = "/zitadel-pat", claim_name = "zitadel-credentials", read_only = true },
    ]
  }

  assert {
    condition     = [for v in kubernetes_job_v1.job.spec[0].template[0].spec[0].volume : v.name] == ["apps", "credentials"]
    error_message = "every given volume must be declared on the pod"
  }

  assert {
    condition     = length(kubernetes_job_v1.job.spec[0].template[0].spec[0].container[0].volume_mount) == 2
    error_message = "every given volume must be mounted"
  }
}

run "without_volumes_nothing_is_mounted" {
  command = plan

  assert {
    condition     = length(kubernetes_job_v1.job.spec[0].template[0].spec[0].volume) == 0
    error_message = "a Job without volumes must mount nothing"
  }
}
