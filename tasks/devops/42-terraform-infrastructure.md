# Task: Create Terraform Infrastructure Modules

## Priority: LOW

## Context
Enterprise teams need Infrastructure-as-Code to provision cloud resources reproducibly. Terraform modules should cover the supporting infrastructure.

## Requirements
1. Create Terraform modules under `deploy/terraform/` for:
   - **AWS**: ECS/EKS cluster, RDS PostgreSQL, ElastiCache Redis, ALB, VPC
   - **GCP**: GKE cluster, Cloud SQL, Memorystore, Cloud Load Balancer
2. Each module should include:
   - VPC with private subnets
   - Database with encryption at rest
   - Redis with auth and TLS
   - Load balancer with TLS termination
   - IAM roles with least-privilege
   - CloudWatch/Stackdriver logging
   - Secrets Manager integration
3. Use remote state (S3/GCS backend)
4. Add `terraform plan` to CI for infrastructure PRs
5. Include cost estimation tags on all resources
6. Provide a quickstart: `terraform apply -var-file=dev.tfvars`

## Acceptance Criteria
- [ ] At least one cloud provider module complete (AWS or GCP)
- [ ] `terraform plan` succeeds from clean state
- [ ] All resources tagged for cost tracking
- [ ] IAM follows least-privilege
- [ ] README with quickstart instructions
