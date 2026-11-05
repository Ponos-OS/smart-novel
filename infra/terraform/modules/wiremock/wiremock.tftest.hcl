mock_provider "kubernetes" {}

variables {
  namespace    = "smart-novel"
  image        = "wiremock/wiremock:3.13.1"
  name         = "wiremock-payments"
  mappings_dir = "./tests/mappings"
}

run "is_reached_by_its_name" {
  command = plan

  assert {
    condition     = output.base_url == "http://wiremock-payments:8080"
    error_message = "consumers must reach the mock by the name it is given"
  }
}

run "serves_every_mapping_of_its_directory" {
  command = plan

  assert {
    condition     = toset(keys(kubernetes_config_map_v1.mappings.data)) == toset(["ping.json"])
    error_message = "exactly the mapping files of mappings_dir must be served"
  }
}
