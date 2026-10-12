mock_provider "kubernetes" {}

run "deploys_into_the_given_namespace" {
  command = plan

  variables {
    namespace = "smart-novel"
    labels    = { Project = "smart-novel" }
  }

  assert {
    condition     = module.namespace.name == "smart-novel"
    error_message = "the app module must create the namespace it is given"
  }
}
