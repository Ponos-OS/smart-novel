output "name" {
  description = "Name of the Job"
  value       = kubernetes_job_v1.job.metadata[0].name
}
