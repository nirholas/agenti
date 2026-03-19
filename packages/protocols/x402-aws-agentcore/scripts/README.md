# x402 AWS Enterprise Demo - Setup Scripts

This directory contains scripts to set up and verify the x402 demo environment.

## Quick Start

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run full setup
./scripts/setup.sh
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `setup.sh` | Main setup script - sets up all components |
| `setup-payer-agent.sh` | Sets up Python environment for the payer agent |
| `setup-infrastructure.sh` | Sets up CDK infrastructure projects and Web UI |
| `verify-setup.sh` | Verifies that setup is complete and correct |

## Prerequisites

Before running setup, ensure you have:

- **Node.js 18+** - [Download](https://nodejs.org/)
- **Python 3.10+** - [Download](https://www.python.org/)
- **AWS CLI** - [Install Guide](https://aws.amazon.com/cli/)
- **AWS CDK** (optional, will use npx if not installed)

## What Each Script Does

### setup.sh

The main setup script that:
1. Checks all prerequisites
2. Verifies AWS credentials
3. Sets up the payer agent Python environment
4. Installs CDK dependencies for both infrastructure projects
5. Sets up the Web UI (React + Vite)
6. Creates `.env` files from examples
7. Prints next steps

### setup-payer-agent.sh

Sets up just the payer agent:
1. Creates Python virtual environment
2. Installs dependencies from `pyproject.toml`
3. Creates `.env` from `.env.example`

### setup-infrastructure.sh

Sets up the CDK infrastructure and Web UI:
1. Installs npm dependencies for seller-infrastructure
2. Installs npm dependencies for payer-infrastructure
3. Installs npm dependencies for web-ui
4. Builds TypeScript for infrastructure projects
5. Builds the Web UI

### verify-setup.sh

Verifies the setup is complete:
1. Checks virtual environment exists
2. Checks dependencies are installed
3. Checks `.env` files are configured
4. Checks TypeScript compiles
5. Checks Web UI builds
6. Checks AWS credentials
7. Reports errors and warnings

## Environment Variables

After running setup, configure these files:

### payer-agent/.env

```bash
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
CDP_API_KEY_ID=your_cdp_api_key_id
CDP_API_KEY_SECRET=your_cdp_api_key_secret
CDP_WALLET_SECRET=your_cdp_wallet_secret
NETWORK_ID=base-sepolia
SELLER_API_URL=https://your-cloudfront.cloudfront.net
```

### seller-infrastructure/.env

```bash
PAYMENT_RECIPIENT_ADDRESS=0x...
```

### web-ui/.env.local

```bash
VITE_API_ENDPOINT=http://localhost:8080
VITE_AWS_REGION=us-east-1
VITE_SELLER_URL=https://your-seller-distribution.cloudfront.net
```

## Running the Web UI

After deployment, the Web UI connects to the AgentCore API Gateway:

```bash
cd web-ui
npm run dev
# Open http://localhost:5173
```

Configure `web-ui/.env.local` with your deployed endpoints:
```bash
VITE_API_ENDPOINT=http://localhost:8080
VITE_AWS_REGION=us-east-1
VITE_SELLER_URL=https://your-seller-distribution.cloudfront.net
```

## Troubleshooting

### Python virtual environment issues

```bash
# Remove and recreate
rm -rf payer-agent/.venv
./scripts/setup-payer-agent.sh
```

### npm dependency issues

```bash
# Clear cache and reinstall
rm -rf seller-infrastructure/node_modules
rm -rf payer-infrastructure/node_modules
rm -rf web-ui/node_modules
./scripts/setup-infrastructure.sh
```

### AWS credential issues

```bash
# Configure AWS CLI
aws configure

# Verify credentials
aws sts get-caller-identity
```
