# Terraform Deployment

Terraform modules for deploying MCP Notify to cloud providers.

## Supported Providers

- **AWS** - ECS/Fargate with RDS and ElastiCache
- **GCP** - Cloud Run with Cloud SQL and Memorystore
- **Azure** - Container Apps with Azure Database and Redis Cache

## Quick Start

```hcl
module "mcp_watch" {
  source = "github.com/nirholas/mcp-notify//deploy/terraform/aws"
  
  environment     = "production"
  region          = "us-east-1"
  instance_type   = "t3.small"
  
  # Database
  db_instance_class = "db.t3.micro"
  
  # Optional: Custom domain
  domain_name = "watch.example.com"
}
```

## Environment-Specific Modules

Coming soon. For now, use Docker Compose or Railway for quick deployments, 
or the Helm chart for Kubernetes.

See [DEPLOYMENT.md](../../docs/DEPLOYMENT.md) for deployment options.
