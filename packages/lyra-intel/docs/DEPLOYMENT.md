# Production Deployment Guide

## Overview

This guide covers deploying Lyra Intel to production environments across different platforms.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Options](#deployment-options)
3. [AWS Deployment](#aws-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Docker Deployment](#docker-deployment)
6. [Configuration](#configuration)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)
9. [Security Best Practices](#security-best-practices)

## Prerequisites

- Docker 20.10+
- Kubernetes 1.23+ (for K8s deployment)
- Terraform 1.0+ (for AWS deployment)
- PostgreSQL 14+
- Redis 7+
- Domain name with SSL certificate

## Deployment Options

### Option 1: AWS with Terraform (Recommended for Enterprise)

**Pros:**
- Fully managed infrastructure
- Auto-scaling capabilities
- High availability
- Automated backups

**Cons:**
- Higher cost
- AWS vendor lock-in

### Option 2: Kubernetes (Recommended for Multi-Cloud)

**Pros:**
- Cloud-agnostic
- Excellent scaling
- Self-healing
- Flexible

**Cons:**
- Complex setup
- Requires K8s expertise

### Option 3: Docker Compose (Small Teams)

**Pros:**
- Simple setup
- Low cost
- Easy to manage

**Cons:**
- Limited scaling
- Manual backup management

## AWS Deployment

### Step 1: Prepare AWS Account

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure credentials
aws configure
```

### Step 2: Initialize Terraform

```bash
cd deploy/terraform/aws

# Initialize Terraform
terraform init

# Create terraform.tfvars
cat > terraform.tfvars <<EOF
aws_region = "us-east-1"
domain_name = "api.yourdomain.com"
db_password = "$(openssl rand -base64 32)"
openai_api_key = "sk-your-key"
anthropic_api_key = "sk-ant-your-key"
EOF
```

### Step 3: Deploy Infrastructure

```bash
# Review deployment plan
terraform plan

# Apply infrastructure
terraform apply

# Get outputs
terraform output alb_dns_name
terraform output ecr_repository_url
```

### Step 4: Build and Push Docker Image

```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t lyra-intel .

# Tag and push
docker tag lyra-intel:latest $(terraform output -raw ecr_repository_url):latest
docker push $(terraform output -raw ecr_repository_url):latest
```

### Step 5: Configure DNS

Point your domain to the ALB DNS name:

```bash
# Get ALB DNS
terraform output alb_dns_name

# Create CNAME record
# api.yourdomain.com -> <alb-dns-name>
```

### Step 6: Verify Deployment

```bash
# Check health
curl https://api.yourdomain.com/api/v1/health

# Test analysis
curl -X POST https://api.yourdomain.com/api/v1/analyze \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "repository_url": "https://github.com/user/repo"
  }'
```

## Kubernetes Deployment

### Step 1: Install Helm

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### Step 2: Add Required Repositories

```bash
# Add Bitnami charts for PostgreSQL/Redis
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

### Step 3: Create Namespace

```bash
kubectl create namespace lyra-intel
```

### Step 4: Configure Secrets

```bash
# Create secrets file
cat > secrets.yaml <<EOF
secrets:
  openaiApiKey: "sk-your-key"
  anthropicApiKey: "sk-ant-your-key"
  jwtSecret: "$(openssl rand -base64 32)"

postgresql:
  auth:
    password: "$(openssl rand -base64 32)"
EOF
```

### Step 5: Install with Helm

```bash
# Install from local chart
helm install lyra-intel ./deploy/helm \
  --namespace lyra-intel \
  --values secrets.yaml \
  --set image.repository=ghcr.io/nirholas/lyra-intel \
  --set image.tag=latest \
  --set ingress.hosts[0].host=api.yourdomain.com
```

### Step 6: Verify Installation

```bash
# Check pods
kubectl get pods -n lyra-intel

# Check services
kubectl get svc -n lyra-intel

# View logs
kubectl logs -n lyra-intel -l app.kubernetes.io/name=lyra-intel --tail=100
```

### Step 7: Configure Ingress

```bash
# Install nginx ingress controller
helm install nginx-ingress ingress-nginx/ingress-nginx

# Install cert-manager for SSL
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

## Docker Deployment

### Step 1: Clone Repository

```bash
git clone https://github.com/nirholas/lyra-intel.git
cd lyra-intel
```

### Step 2: Configure Environment

```bash
cp .env.example .env

# Edit .env with your values
nano .env
```

### Step 3: Start Services

```bash
docker-compose up -d
```

### Step 4: Check Status

```bash
docker-compose ps
docker-compose logs -f api
```

## Configuration

### Environment Variables

Required variables:

```bash
# API Configuration
API_PORT=8080
WORKERS=8
LOG_LEVEL=INFO

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=lyra_intel
POSTGRES_USER=lyra
POSTGRES_PASSWORD=<secure-password>

# Cache
REDIS_HOST=redis
REDIS_PORT=6379

# AI Providers
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=sk-ant-your-key

# Security
JWT_SECRET=<random-secret>
JWT_EXPIRATION=3600

# Optional
SENTRY_DSN=https://...
PROMETHEUS_ENABLED=true
```

### Database Migrations

```bash
# Run migrations
docker-compose exec api python -m alembic upgrade head

# Create migration
docker-compose exec api python -m alembic revision --autogenerate -m "description"
```

## Monitoring

### Prometheus Setup

```bash
# Access Prometheus
kubectl port-forward -n lyra-intel svc/prometheus 9090:9090

# Access Grafana
kubectl port-forward -n lyra-intel svc/grafana 3000:3000
# Default credentials: admin/admin
```

### Key Metrics to Monitor

- `lyra_intel_requests_total` - Total requests
- `lyra_intel_request_duration_seconds` - Request latency
- `lyra_intel_analyses_total` - Total analyses
- `lyra_intel_errors_total` - Error count
- `lyra_intel_ai_requests_total` - AI API usage

### Logging

```bash
# CloudWatch (AWS)
aws logs tail /ecs/lyra-intel-api --follow

# Kubernetes
kubectl logs -n lyra-intel -l app=lyra-intel --tail=100 -f

# Docker
docker-compose logs -f api
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

```bash
# Check database is running
kubectl get pods -n lyra-intel | grep postgresql

# Check connection from app
kubectl exec -it -n lyra-intel <api-pod> -- \
  psql -h lyra-intel-postgresql -U lyra -d lyra_intel

# Check credentials
kubectl get secret lyra-intel-secrets -n lyra-intel -o yaml
```

#### 2. High Memory Usage

```bash
# Check resource usage
kubectl top pods -n lyra-intel

# Scale down workers
kubectl set env deployment/lyra-intel-api WORKERS=4 -n lyra-intel

# Increase memory limits
kubectl set resources deployment/lyra-intel-api \
  --limits=memory=4Gi -n lyra-intel
```

#### 3. Slow Analysis Performance

```bash
# Check cache hit rate
curl http://localhost:9090/api/v1/query?query=lyra_intel_cache_hits_total

# Enable Redis
kubectl scale deployment/lyra-intel-redis --replicas=1 -n lyra-intel

# Add more workers
kubectl scale deployment/lyra-intel-api --replicas=5 -n lyra-intel
```

#### 4. SSL Certificate Issues

```bash
# Check certificate
kubectl describe certificate lyra-intel-tls -n lyra-intel

# Force renewal
kubectl delete certificate lyra-intel-tls -n lyra-intel

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager
```

### Health Checks

```bash
# Application health
curl https://api.yourdomain.com/api/v1/health

# Database health
kubectl exec -it -n lyra-intel <api-pod> -- \
  python -c "from src.storage.database import check_connection; check_connection()"

# Redis health
kubectl exec -it -n lyra-intel <redis-pod> -- redis-cli ping
```

## Security Best Practices

### 1. Use Secrets Management

```bash
# AWS Secrets Manager
aws secretsmanager create-secret \
  --name lyra-intel/api-keys \
  --secret-string '{"OPENAI_API_KEY":"sk-...","ANTHROPIC_API_KEY":"sk-ant-..."}'

# Kubernetes Secrets
kubectl create secret generic lyra-intel-secrets \
  --from-literal=openai-api-key=sk-... \
  --from-literal=anthropic-api-key=sk-ant-... \
  -n lyra-intel
```

### 2. Enable Network Policies

```bash
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: lyra-intel-netpol
  namespace: lyra-intel
spec:
  podSelector:
    matchLabels:
      app: lyra-intel
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx-ingress
    ports:
    - protocol: TCP
      port: 8080
EOF
```

### 3. Regular Updates

```bash
# Update Helm chart
helm upgrade lyra-intel ./deploy/helm \
  --namespace lyra-intel \
  --values secrets.yaml

# Update Docker image
docker pull ghcr.io/nirholas/lyra-intel:latest
docker-compose up -d api
```

### 4. Backup Strategy

```bash
# PostgreSQL backup
kubectl exec -it -n lyra-intel <postgres-pod> -- \
  pg_dump -U lyra lyra_intel > backup-$(date +%Y%m%d).sql

# Automated backups (AWS)
aws rds create-db-snapshot \
  --db-instance-identifier lyra-intel-db \
  --db-snapshot-identifier lyra-intel-$(date +%Y%m%d)
```

## Performance Tuning

### 1. Database Optimization

```sql
-- Create indexes
CREATE INDEX idx_analysis_created_at ON analyses(created_at);
CREATE INDEX idx_issues_severity ON issues(severity);

-- Vacuum and analyze
VACUUM ANALYZE;
```

### 2. Cache Configuration

```bash
# Increase Redis memory
kubectl set env deployment/lyra-intel-redis \
  REDIS_MAXMEMORY=1gb -n lyra-intel

# Set eviction policy
kubectl set env deployment/lyra-intel-redis \
  REDIS_MAXMEMORY_POLICY=allkeys-lru -n lyra-intel
```

### 3. Application Tuning

```bash
# Increase workers
kubectl set env deployment/lyra-intel-api WORKERS=16 -n lyra-intel

# Adjust timeouts
kubectl set env deployment/lyra-intel-api \
  REQUEST_TIMEOUT=60 \
  ANALYSIS_TIMEOUT=300 \
  -n lyra-intel
```

## Support

For issues or questions:

- GitHub Issues: https://github.com/nirholas/lyra-intel/issues
- Documentation: https://github.com/nirholas/lyra-intel/docs
- contact [nich on Github](github.com/nirholas) | [nich on X](x.com/nichxbt)
