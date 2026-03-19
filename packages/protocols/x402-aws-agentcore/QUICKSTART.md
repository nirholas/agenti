# Quick Start

Get the x402 payment demo running in under 30 minutes.

## Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | 18+ | `node --version` |
| Python | 3.10+ | `python3 --version` |
| AWS CLI | 2.x | `aws --version` |
| AWS CDK | 2.x | `cdk --version` |
| Docker | 20+ | `docker --version` |

Also required:
- AWS account with Bedrock AgentCore access
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com/) API keys

## Full Deployment

### Step 1: Clone (2 min)

```bash
git clone https://github.com/aws-samples/sample-agentcore-cloudfront-x402-payments
cd sample-agentcore-cloudfront-x402-payments

git clone https://github.com/coinbase/x402.git
git clone https://github.com/coinbase/agentkit.git

./scripts/setup.sh
```

### Step 2: Configure Credentials (5 min)

**AWS:**
```bash
aws configure
aws sts get-caller-identity
```

**CDP (Coinbase):**

Get API keys from [CDP Portal](https://portal.cdp.coinbase.com/), then edit `payer-agent/.env`:

```bash
CDP_API_KEY_ID=your_key_id
CDP_API_KEY_SECRET=your_key_secret
CDP_WALLET_SECRET=your_wallet_secret
NETWORK_ID=base-sepolia
```

**Seller:**

Edit `seller-infrastructure/.env` with your wallet address:
```bash
PAYMENT_RECIPIENT_ADDRESS=<YOUR_SELLER_WALLET_ADDRESS>
```

To create a seller wallet, you can:
1. Use an existing Base Sepolia wallet address
2. Create one via [CDP Portal](https://portal.cdp.coinbase.com/) 
3. Use MetaMask or another wallet on Base Sepolia testnet

### Step 3: Deploy Seller (10 min)

```bash
cd sample-agentcore-cloudfront-x402-payments/seller-infrastructure
npm install
npx cdk bootstrap  # first time only
npx cdk deploy
```

### Step 4: Sync Environment Variables

This automatically pulls the CloudFront URL from the seller stack and updates `payer-agent/.env` and `web-ui/.env.local`:

```bash
cd sample-agentcore-cloudfront-x402-payments
./scripts/sync-env.sh
```

### Step 5: Deploy Payer (10 min)

```bash
cd sample-agentcore-cloudfront-x402-payments/payer-infrastructure
npm install
npx cdk bootstrap  # first time only
npx cdk deploy --all
```

### Step 6: Deploy Agent

The deploy script automatically writes `AGENT_RUNTIME_ARN` back to `payer-agent/.env`.

```bash
cd sample-agentcore-cloudfront-x402-payments/payer-agent
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python scripts/deploy_to_agentcore.py
```

> **Important**: Without `AGENT_RUNTIME_ARN`, web-ui-infrastructure has no runtime to proxy to.

### Step 7: Test

```bash
cd sample-agentcore-cloudfront-x402-payments/payer-agent
source .venv/bin/activate

# Test MCP tool discovery
python scripts/test_gateway_target.py

# Invoke agent
python scripts/invoke_gateway.py "Get me the premium article"

# Run tests
pytest tests/ -v
```

### Step 8: Web UI (Optional)

Start the backend API server and frontend in separate terminals:
```bash
# Terminal 1: Backend
cd sample-agentcore-cloudfront-x402-payments/payer-agent
source .venv/bin/activate
python -m agent.api_server

# Terminal 2: Frontend
cd sample-agentcore-cloudfront-x402-payments/web-ui
npm install
npm run dev
```

## MCP Tools

| Tool | Price (USDC) |
|------|--------------|
| `get_premium_article` | 0.001 |
| `get_weather_data` | 0.0005 |
| `get_market_analysis` | 0.002 |
| `get_research_report` | 0.005 |
| `get_dataset` | 0.01 |
| `get_tutorial` | 0.003 |

## Troubleshooting

**Module not found:**
```bash
cd payer-agent && source .venv/bin/activate && pip install -e ".[dev]"
```

**AWS credentials:**
```bash
aws configure
```

**CDK bootstrap:**
```bash
npx cdk bootstrap aws://ACCOUNT_ID/REGION
```

**No wallet balance:**
```bash
python -c "from agent.tools.payment import request_faucet_funds; print(request_faucet_funds())"
```

**Lambda@Edge region:**
Lambda@Edge requires `us-east-1`. This is hardcoded in the CDK stack — no configuration needed.

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for more.

## References

- [README.md](README.md) - Full architecture
- [docs/API.md](docs/API.md) - API reference
- [x402 Protocol](https://github.com/coinbase/x402/tree/main/specs)
