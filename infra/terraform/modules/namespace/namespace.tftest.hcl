mock_provider "kubernetes" {}

run "creates_a_labelled_namespace" {
  command = plan

  variables {
    name   = "smart-novel"
    labels = { Project = "smart-novel" }
  }

  assert {
    condition     = kubernetes_namespace_v1.this.metadata[0].name == "smart-novel"
    error_message = "the namespace must carry the given name"
  }

  assert {
    condition     = kubernetes_namespace_v1.this.metadata[0].labels["Project"] == "smart-novel"
    error_message = "the namespace must carry the given labels"
  }
}
