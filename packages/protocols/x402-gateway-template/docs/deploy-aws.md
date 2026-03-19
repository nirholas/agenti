# Deploy to AWS ECS / Fargate

## Prerequisites

- AWS CLI configured
- ECR repository created
- ECS cluster (Fargate or EC2)

## 1. Store Secrets

```bash
# Create secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name x402-settlement-key \
  --secret-string '0xYOUR_PRIVATE_KEY'

# Optional: Solana key
aws secretsmanager create-secret \
  --name x402-solana-facilitator-key \
  --secret-string 'YOUR_BASE58_KEY'
```

## 2. Push Docker Image

```bash
# Create ECR repo (one time)
aws ecr create-repository --repository-name x402-gateway

# Build and push
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

docker build -t x402-gateway .
docker tag x402-gateway:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/x402-gateway:latest
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/x402-gateway:latest
```

## 3. Create Task Definition

Create `task-definition.json`:

```json
{
  "family": "x402-gateway",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "x402-gateway",
      "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/x402-gateway:latest",
      "portMappings": [{ "containerPort": 8080, "protocol": "tcp" }],
      "environment": [
        { "name": "BASE_RPC_URL", "value": "https://base-mainnet.g.alchemy.com/v2/KEY" },
        { "name": "PAY_TO_ADDRESS", "value": "0x..." },
        { "name": "MY_BACKEND_URL", "value": "https://api.your-service.com" },
        { "name": "MY_BACKEND_API_KEY", "value": "your-key" },
        { "name": "UPSTASH_REDIS_REST_URL", "value": "https://..." },
        { "name": "UPSTASH_REDIS_REST_TOKEN", "value": "..." }
      ],
      "secrets": [
        {
          "name": "SETTLEMENT_PRIVATE_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:x402-settlement-key"
        }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
        "interval": 30,
        "timeout": 10,
        "retries": 3,
        "startPeriod": 30
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/x402-gateway",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

## 4. Create Service

```bash
aws ecs create-service \
  --cluster your-cluster \
  --service-name x402-gateway \
  --task-definition x402-gateway \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

## 5. Load Balancer (Optional)

Add an ALB target group pointing to port 8080 for custom domains and HTTPS termination.
