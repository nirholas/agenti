# Task: Integrate Secrets Management

## Priority: MEDIUM

## Context
All secrets are currently loaded from environment variables. Enterprise deployments need integration with secrets managers for rotation, auditing, and access control.

## Requirements
1. Create a `SecretsProvider` interface with implementations for:
   - Environment variables (default, for development)
   - AWS Secrets Manager
   - HashiCorp Vault
   - Google Secret Manager
   - Azure Key Vault
2. Support secret rotation without server restart
3. Cache secrets with configurable TTL (default 5 minutes)
4. Audit logging: log all secret access (without the secret value)
5. Support secret versioning for rollback
6. Integrate with Docker Secrets for containerized deployments
7. Add CLI command: `agenti secrets validate` to verify all required secrets are accessible
8. Never log, serialize, or include secrets in error messages or stack traces
9. Add secret redaction middleware for all log outputs

## Acceptance Criteria
- [ ] `SecretsProvider` interface with env var implementation
- [ ] At least one cloud provider implementation (AWS or Vault)
- [ ] Secret rotation works without restart
- [ ] Access audit logging active
- [ ] Log redaction prevents secret leakage
