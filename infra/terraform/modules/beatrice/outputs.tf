output "graphql_url" {
  description = "In-cluster GraphQL URL of Beatrice"
  value       = "http://${kubernetes_service_v1.beatrice.metadata[0].name}:3000/graphql"
}
