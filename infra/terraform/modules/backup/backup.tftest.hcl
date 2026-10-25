mock_provider "kubernetes" {}

variables {
  namespace      = "smart-novel"
  postgres_image = "postgres:18.2-bookworm"
  aws_cli_image  = "amazon/aws-cli:2.38.1"
  database_url   = "postgresql://smart_novel:3c9a1f0e7b2d@postgres:5432/smart_novel"
  endpoint       = "https://fsn1.your-objectstorage.com"
  bucket         = "ponos-backups"
  access_key     = "AKIAEXAMPLE"
  secret_key     = "c2VjcmV0LWtleS1leGFtcGxl"
}

run "writes_daily_and_monthly_dumps_under_the_agreed_keys" {
  command = plan

  assert {
    condition     = toset(keys(kubernetes_cron_job_v1.backup)) == toset(["daily", "monthly"])
    error_message = "there must be one CronJob per prefix"
  }

  assert {
    condition     = strcontains(kubernetes_cron_job_v1.backup["daily"].spec[0].job_template[0].spec[0].template[0].spec[0].container[0].command[2], "s3://ponos-backups/daily/smart-novel/smart_novel/$(date -u +%Y-%m-%dT%H-%MZ).dump") && strcontains(kubernetes_cron_job_v1.backup["monthly"].spec[0].job_template[0].spec[0].template[0].spec[0].container[0].command[2], "s3://ponos-backups/monthly/smart-novel/smart_novel/$(date -u +%Y-%m).dump")
    error_message = "keys must follow <daily|monthly>/<project>/<database>/<stamp>.dump"
  }
}

run "credentials_stay_out_of_the_pod_spec" {
  command = plan

  assert {
    condition     = alltrue([for k in keys(kubernetes_cron_job_v1.backup) : [for e in kubernetes_cron_job_v1.backup[k].spec[0].job_template[0].spec[0].template[0].spec[0].container[0].env : e.name] == ["AWS_DEFAULT_REGION"]]) && toset(keys(kubernetes_secret_v1.backup.data)) == toset(["DATABASE_URL", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"])
    error_message = "the database password and the keys must come from the Secret"
  }
}
