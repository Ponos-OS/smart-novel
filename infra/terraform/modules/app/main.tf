module "namespace" {
  source = "../namespace"

  name   = var.namespace
  labels = var.labels
}
