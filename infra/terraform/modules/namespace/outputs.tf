output "name" {
  description = "Name of the namespace; depending on it orders a module after the namespace exists"
  value       = kubernetes_namespace_v1.this.metadata[0].name
}
