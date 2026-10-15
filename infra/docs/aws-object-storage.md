# AWS Object Storage (Future Enhancement)

Not part of the compose-to-kind feature. Do this together with the future `envs/aws` environment.

## Context

Locally, `modules/object_storage` runs a RustFS server and a Job that uses the AWS CLI to create the bucket, upload the seed covers and apply the bucket policy. RustFS only exists as a local stand-in for S3. In production we use AWS S3.

## Decision

- Do **not** use the `aminueza/minio` Terraform provider. It would manage a server that never runs in production, and Terraform would need to reach RustFS from outside the cluster.
- Do **not** point the `aws` provider at RustFS locally either; it has the same reachability problem and manages the bucket differently from production.
- Keep `modules/object_storage` and its AWS CLI Job as the local-only implementation, used by `envs/local`.
- Add `modules/aws_storage` (like Nestral's `aws_data`), used only by `envs/aws`, with the `aws` provider:
  - `aws_s3_bucket` and the public access block.
  - The bucket policy.
  - IAM permissions for the backend (and Beatrice, if it writes narrations) through the service account, as Nestral does with `service_account_annotations`.
- `envs/aws` passes the result to `module "app"` as `object_storage_endpoint` (plus the bucket name). That input already skips RustFS, so `modules/app` does not change.

## Open Questions

- Public access: locally the policy makes `covers/*` and `narrations/*` publicly readable so the browser loads them directly. In AWS a private bucket behind CloudFront (origin access control) is likely better. Decide this when building `envs/aws`.
- How the backend gets credentials in AWS (IAM role on the service account instead of access keys), and what that does to the `OBJECT_STORAGE_*` settings the backend reads today.
- Whether the seed covers are uploaded in AWS at all, or only come from the application's own seed.
