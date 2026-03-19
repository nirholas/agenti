# x402 Payer Agent

AI agent for x402 payment decisions using Strands Agents SDK and Bedrock AgentCore.

## Overview

- Request content from seller APIs
- Analyze payment requirements (HTTP 402 responses)
- Sign blockchain transactions via Coinbase AgentKit
- Retry requests with signed payments

## Stack

- **Agent Framework**: Strands Agents SDK (Python)
- **LLM**: Amazon Bedrock (Claude Sonnet)
- **Wallet**: Coinbase AgentKit (CDP)
- **Runtime**: Bedrock AgentCore

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│   Web UI    │────▶│   API Server    │────▶│  AgentCore Runtime   │
│  (React)    │     │   (FastAPI)     │     │  invoke_agent_runtime│
└─────────────┘     └─────────────────┘     └──────────────────────┘
                           │                          │
                           │ SigV4                    │
                           ▼                          ▼
                    ┌─────────────────┐     ┌──────────────────────┐
                    │  bedrock-       │     │   Strands Agent      │
                    │  agentcore      │     │   + AgentKit Wallet  │
                    └─────────────────┘     └──────────────────────┘
```

## Setup

```bash
pip install -e ".[dev]"
cp .env.example .env
# Edit .env with CDP credentials
```

Run API server:
```bash
uvicorn agent.api_server:app --host 0.0.0.0 --port 8080
```

Run locally:
```bash
python -m agent.main
```

## Structure

```
payer-agent/
├── agent/
│   ├── main.py           # Agent definition
│   ├── config.py         # Configuration
│   ├── api_server.py     # FastAPI backend
│   ├── runtime_client.py # AgentCore client
│   └── tools/
│       ├── payment.py    # Payment tools
│       └── content.py    # Content tools
├── tests/
└── pyproject.toml
```

## Tools

| Tool | Description |
|------|-------------|
| `analyze_payment` | Analyze payment requirements |
| `sign_payment` | Sign payment with AgentKit |
| `get_wallet_balance` | Check wallet balance |
| `request_content` | Request content (may return 402) |
| `request_content_with_payment` | Request with signed payment |

## Usage

```python
from agent import create_payer_agent

agent = create_payer_agent()
response = await agent.run("Get me the premium article at /api/premium-article")
```

## Deployment

### Prerequisites

- AWS CLI configured
- CDK CLI (`npm install -g aws-cdk`)
- CDP API credentials

### Deploy Infrastructure

```bash
cd ../payer-infrastructure
npm install
cdk deploy
```

Creates:
- IAM role for AgentCore Runtime
- Secrets Manager secret for CDP credentials
- CloudWatch Dashboard

### Configure CDP Credentials

```bash
aws secretsmanager put-secret-value \
  --secret-id x402-payer-agent/cdp-credentials \
  --secret-string '{"CDP_API_KEY_NAME":"your-key","CDP_API_KEY_PRIVATE_KEY":"your-private-key"}'
```

### Deploy Agent

```bash
./scripts/deploy.sh
```

### Deploy to AgentCore Runtime

The agent is deployed as a Docker container to AgentCore Runtime:

```bash
# Deploy using the deployment script
python scripts/deploy_to_agentcore.py
```

This will:
1. Build a Docker image with all dependencies
2. Push to ECR
3. Create/update the AgentCore Runtime

The deployment script outputs the Runtime ARN, which you'll need for invocation.

### Test Invocation

```bash
python scripts/test_agent_invocation.py \
    --runtime-arn "<YOUR_RUNTIME_ARN>" \
    --message "What services are available?"
```

## Configuration

**agentcore_config.yaml**:
```yaml
runtime:
  name: x402-payer-agent-runtime
  handler: agent.main.create_payer_agent
  memory_size_mb: 1024
  timeout_seconds: 300
  environment:
    BEDROCK_MODEL_ID: "anthropic.claude-sonnet-4-20250514-v1:0"
    NETWORK_ID: "base-sepolia"
```

**gateway_config.yaml**:
```yaml
gateway:
  name: x402-payer-agent-gateway
  authentication:
    type: IAM_SIGV4
  rate_limiting:
    requests_per_second: 10
```

## License

Apache-2.0
