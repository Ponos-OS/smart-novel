mock_provider "kubernetes" {}

variables {
  namespace   = "smart-novel"
  image       = "smart-novel-setup-zitadel:dev"
  zitadel_url = "http://traefik:80"
  credentials = {
    claim_name = "zitadel-credentials"
    mount_path = "/zitadel-pat"
    pat_file   = "/zitadel-pat/token"
  }
}

run "exposes_the_client_id_file_of_the_app" {
  command = plan

  variables {
    app_name = "smart-novel"
  }

  assert {
    condition     = output.credentials.client_id_file == "/zitadel-pat/client/smart-novel-client-id"
    error_message = "consumers must find the client ID where the setup script writes it"
  }

  assert {
    condition     = output.credentials.claim_name == "zitadel-credentials"
    error_message = "the claim of the credentials volume must be passed through"
  }
}

run "refuses_a_mount_path_the_script_does_not_use" {
  command = plan

  variables {
    credentials = {
      claim_name = "zitadel-credentials"
      mount_path = "/credentials"
      pat_file   = "/credentials/token"
    }
  }

  expect_failures = [kubernetes_job_v1.setup]
}
