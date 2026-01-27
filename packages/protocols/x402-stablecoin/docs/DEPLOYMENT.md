# X402 Deployment Guide

Complete guide for deploying X402 infrastructure to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Smart Contract Deployment](#smart-contract-deployment)
- [Backend Services Deployment](#backend-services-deployment)
- [NPM Package Publishing](#npm-package-publishing)

---

## Prerequisites

### Required Accounts

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **Arbiscan** | Contract verification | [arbiscan.io](https://arbiscan.io/register) |
| **Alchemy** | RPC provider (recommended) | [alchemy.com](https://www.alchemy.com/) |
| **Infura** | RPC provider (alternative) | [infura.io](https://www.infura.io/) |
| **npm** | Package publishing | [npmjs.com](https://www.npmjs.com/signup) |
| **Docker Hub** | Container registry | [hub.docker.com](https://hub.docker.com/) |

### Required Tokens

#### For Arbitrum Mainnet
- **ETH**: 0.01-0.1 ETH for contract deployment gas
- **USDs**: Test amounts for validation

#### For Arbitrum Sepolia (Testnet)
- **Sepolia ETH**: Free from [Arbitrum Faucet](https://www.alchemy.com/faucets/arbitrum-sepolia)
- **Test USDs**: Deploy mock token or use test faucet

### Environment Setup

```bash
# Clone repository
git clone https://github.com/nirholas/x402.git
cd x402

# Install dependencies
pnpm install

# Install Foundry (for smart contracts)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

### Required Tools

```bash
# Verify installations
node --version    # >= 20.0.0
pnpm --version    # >= 8.0.0
forge --version   # >= 0.2.0
docker --version  # >= 24.0.0 (for backend)
```

---

## Smart Contract Deployment

### Contract Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    X402 Contract Suite                       │
├─────────────────────────────────────────────────────────────┤
│  ToolRegistry        - Tool/Creator registration (Proxy)    │
│  X402PaymentChannel  - Payment channels (Proxy)             │
│  X402Subscription    - Subscription management (Proxy)      │
│  X402CreditSystem    - Credit/balance system (Proxy)        │
│  X402RevenueSplitter - Revenue distribution                 │
└─────────────────────────────────────────────────────────────┘
```

### Step 1: Configure Environment

```bash
# Required variables for deployment
export DEPLOYER_PRIVATE_KEY="0x..."        # Deployer wallet private key
export PLATFORM_WALLET="0x..."              # Platform fee recipient
export ARBISCAN_API_KEY="..."               # For verification
export ARBITRUM_RPC_URL="https://arb1.arbitrum.io/rpc"
export ARBITRUM_SEPOLIA_RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"
```

### Step 2: Deploy to Arbitrum Sepolia (Testnet)

```bash
cd contracts

# Build contracts
forge build

# Run tests
forge test

# Deploy full suite to Sepolia
forge script script/DeployX402Suite.s.sol:DeployX402Suite \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ARBISCAN_API_KEY \
  -vvvv

# Or deploy individual contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
  --broadcast \
  -vvvv
```

**Expected Output:**
```
=== Deployment Summary ===
Network: Arbitrum Sepolia
Platform Wallet: 0x...
Platform Fee: 2000 bps

Contract Addresses:
- ToolRegistry: 0x...
- X402PaymentChannel: 0x...
- X402Subscription: 0x...
- X402CreditSystem: 0x...
```

### Step 3: Deploy to Arbitrum Mainnet

⚠️ **WARNING**: Mainnet deployment uses real funds. Double-check all parameters.

```bash
# Verify configuration
echo "Platform Wallet: $PLATFORM_WALLET"
echo "Deployer: $(cast wallet address --private-key $DEPLOYER_PRIVATE_KEY)"

# Check deployer balance
cast balance $(cast wallet address --private-key $DEPLOYER_PRIVATE_KEY) \
  --rpc-url $ARBITRUM_RPC_URL

# Deploy to mainnet
forge script script/DeployX402Suite.s.sol:DeployX402Suite \
  --rpc-url $ARBITRUM_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ARBISCAN_API_KEY \
  --slow \
  -vvvv
```

### Step 4: Verify on Arbiscan

If automatic verification fails:

```bash
# Manual verification for proxy contracts
forge verify-contract \
  <IMPLEMENTATION_ADDRESS> \
  ToolRegistry \
  --chain-id 42161 \
  --etherscan-api-key $ARBISCAN_API_KEY \
  --watch

# Verify proxy with constructor args
forge verify-contract \
  <PROXY_ADDRESS> \
  ERC1967Proxy \
  --chain-id 42161 \
  --constructor-args $(cast abi-encode "constructor(address,bytes)" \
    <IMPLEMENTATION_ADDRESS> \
    <INIT_DATA>) \
  --etherscan-api-key $ARBISCAN_API_KEY \
  --watch
```

### Step 5: Proxy Upgrade Process

```bash
# 1. Deploy new implementation
forge create src/ToolRegistry.sol:ToolRegistry \
  --rpc-url $ARBITRUM_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY

# 2. Run upgrade script
forge script script/DeployX402Suite.s.sol:UpgradeX402Suite \
  --sig "upgradeToolRegistry(address,address)" \
  <PROXY_ADDRESS> <NEW_IMPLEMENTATION> \
  --rpc-url $ARBITRUM_RPC_URL \
  --broadcast

# 3. Verify new implementation
forge verify-contract <NEW_IMPLEMENTATION> ToolRegistry \
  --chain-id 42161 \
  --etherscan-api-key $ARBISCAN_API_KEY
```

### Step 6: Multi-Sig Setup for Production

For production deployments, transfer ownership to a multi-sig:

```bash
# Using Gnosis Safe (recommended)
# 1. Create Safe at https://app.safe.global/

# 2. Transfer ownership of each proxy
cast send <PROXY_ADDRESS> \
  "transferOwnership(address)" \
  <SAFE_ADDRESS> \
  --rpc-url $ARBITRUM_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY

# 3. Verify ownership transfer
cast call <PROXY_ADDRESS> "owner()(address)" \
  --rpc-url $ARBITRUM_RPC_URL
```

**Recommended Multi-Sig Configuration:**
- **Signers**: 3-5 trusted parties
- **Threshold**: 2/3 or 3/5
- **Timelock**: 24-48 hours for upgrades

---

## Backend Services Deployment

### Docker Deployment

#### Build Facilitator Image

```bash
cd facilitator

# Build for production
docker build -t x402/facilitator:latest .

# Tag for registry
docker tag x402/facilitator:latest ghcr.io/nirholas/x402-facilitator:latest

# Push to registry
docker push ghcr.io/nirholas/x402-facilitator:latest
```

#### Run with Docker

```bash
# Run container
docker run -d \
  --name x402-facilitator \
  -p 3002:3002 \
  -e NODE_ENV=production \
  -e NETWORK=arbitrum \
  -e RPC_URL=https://arb-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY \
  -e PRIVATE_KEY=$PRIVATE_KEY \
  -e RECIPIENT_ADDRESS=$RECIPIENT_ADDRESS \
  --restart unless-stopped \
  x402/facilitator:latest

# Check logs
docker logs -f x402-facilitator

# Health check
curl http://localhost:3002/health
```

#### Docker Compose (Local Development)

See [docker-compose.yml](../docker-compose.yml) for local development setup.

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Kubernetes Deployment

#### Namespace and ConfigMap

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: x402
  labels:
    app: x402
---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: x402-facilitator-config
  namespace: x402
data:
  NODE_ENV: "production"
  PORT: "3002"
  HOST: "0.0.0.0"
  NETWORK: "arbitrum"
  LOG_LEVEL: "info"
  RATE_LIMIT_WINDOW_MS: "60000"
  RATE_LIMIT_MAX_REQUESTS: "100"
```

#### Secrets Management

```yaml
# k8s/secret.yaml (use external secrets in production)
apiVersion: v1
kind: Secret
metadata:
  name: x402-facilitator-secrets
  namespace: x402
type: Opaque
stringData:
  PRIVATE_KEY: "0x..."
  RPC_URL: "https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY"
  RECIPIENT_ADDRESS: "0x..."
```

**For production, use:**
- [External Secrets Operator](https://external-secrets.io/)
- [HashiCorp Vault](https://www.vaultproject.io/)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)

#### Deployment Manifest

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: x402-facilitator
  namespace: x402
  labels:
    app: x402-facilitator
spec:
  replicas: 3
  selector:
    matchLabels:
      app: x402-facilitator
  template:
    metadata:
      labels:
        app: x402-facilitator
    spec:
      containers:
      - name: facilitator
        image: ghcr.io/nirholas/x402-facilitator:latest
        ports:
        - containerPort: 3002
        envFrom:
        - configMapRef:
            name: x402-facilitator-config
        - secretRef:
            name: x402-facilitator-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3002
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3002
          initialDelaySeconds: 5
          periodSeconds: 10
        securityContext:
          runAsNonRoot: true
          runAsUser: 1001
          readOnlyRootFilesystem: true
---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: x402-facilitator
  namespace: x402
spec:
  selector:
    app: x402-facilitator
  ports:
  - port: 80
    targetPort: 3002
  type: ClusterIP
---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: x402-facilitator
  namespace: x402
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - facilitator.x402.io
    secretName: x402-facilitator-tls
  rules:
  - host: facilitator.x402.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: x402-facilitator
            port:
              number: 80
```

#### Deploy to Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# Check deployment status
kubectl -n x402 get pods
kubectl -n x402 get services

# View logs
kubectl -n x402 logs -f deployment/x402-facilitator

# Scale deployment
kubectl -n x402 scale deployment/x402-facilitator --replicas=5
```

### Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment (development/production) | No | `development` |
| `PORT` | Server port | No | `3002` |
| `HOST` | Bind address | No | `0.0.0.0` |
| `NETWORK` | Network (arbitrum/arbitrum-sepolia) | No | `arbitrum-sepolia` |
| `RPC_URL` | Arbitrum RPC endpoint | Yes (prod) | Public RPC |
| `PRIVATE_KEY` | Wallet private key for settlements | Yes (prod) | - |
| `RECIPIENT_ADDRESS` | Default payment recipient | Yes | - |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | No | `*` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | No | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | No | `100` |
| `PAYMENT_CACHE_TTL_MS` | Payment cache TTL | No | `86400000` |
| `LOG_LEVEL` | Logging level | No | `info` |

### Health Check Endpoints

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/health` | GET | Basic health check | `{ "status": "ok" }` |
| `/health/ready` | GET | Readiness (includes RPC check) | `{ "status": "ready", "rpc": true }` |
| `/health/live` | GET | Liveness probe | `{ "status": "alive" }` |

---

## NPM Package Publishing

### Prerequisites

```bash
# Login to npm
npm login

# Verify login
npm whoami

# Ensure you have publish access to @x402 scope
```

### Version Bumping

```bash
# For patch release (bug fixes)
pnpm version:patch

# For minor release (new features)
pnpm version:minor

# For major release (breaking changes)
pnpm version:major

# Or manually in each package
cd packages/sdk && npm version patch
cd ../.. && cd cli && npm version patch
cd ../.. && cd sperax && npm version patch
```

### Changelog Generation

```bash
# Install conventional-changelog
npm install -g conventional-changelog-cli

# Generate changelog
conventional-changelog -p angular -i CHANGELOG.md -s

# Or use auto-changelog
npx auto-changelog --output CHANGELOG.md
```

### Publishing @x402/sdk

```bash
cd packages/sdk

# Clean and build
pnpm clean
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Dry run (verify package contents)
npm pack --dry-run

# Publish
npm publish --access public

# Or with specific tag
npm publish --access public --tag beta
```

### Publishing @x402/cli

```bash
cd cli

# Clean and build
pnpm clean
pnpm build

# Test CLI locally
npm link
x402 --help

# Publish
npm publish --access public

# Verify installation
npm install -g @x402/cli
x402 --version
```

### Publishing @x402/sperax-mcp

```bash
cd sperax

# Clean and build
pnpm clean
pnpm build

# Verify exports
node -e "require('./dist/index.js')"

# Publish
npm publish --access public
```

### Release Checklist

- [ ] All tests passing (`pnpm test`)
- [ ] Types validated (`pnpm typecheck`)
- [ ] Linting clean (`pnpm lint`)
- [ ] CHANGELOG.md updated
- [ ] Version bumped consistently across packages
- [ ] README.md updated with new features
- [ ] Git tag created (`git tag v1.x.x`)
- [ ] Git tag pushed (`git push --tags`)
- [ ] npm packages published
- [ ] GitHub release created

### Automated Release (CI/CD)

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
          
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
      
      - name: Publish SDK
        run: cd packages/sdk && npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          
      - name: Publish CLI
        run: cd cli && npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          
      - name: Publish Sperax MCP
        run: cd sperax && npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
```

---

## Post-Deployment Verification

### Smart Contracts

```bash
# Verify contracts on Arbiscan
open "https://arbiscan.io/address/<CONTRACT_ADDRESS>#code"

# Test basic functionality
cast call <TOOL_REGISTRY> "platformWallet()(address)" --rpc-url $ARBITRUM_RPC_URL
cast call <TOOL_REGISTRY> "platformFeeBps()(uint256)" --rpc-url $ARBITRUM_RPC_URL
```

### Backend Services

```bash
# Health check
curl -i https://facilitator.x402.io/health

# Test quote generation
curl -X POST https://facilitator.x402.io/quote \
  -H "Content-Type: application/json" \
  -d '{"amount": "1000000", "recipient": "0x..."}'
```

### NPM Packages

```bash
# Verify published packages
npm view @x402/sdk
npm view @x402/cli
npm view @x402/sperax-mcp

# Test installation
npx @x402/cli --version
```

---

## Troubleshooting

### Contract Deployment Fails

```bash
# Check gas price
cast gas-price --rpc-url $ARBITRUM_RPC_URL

# Check account balance
cast balance $DEPLOYER_ADDRESS --rpc-url $ARBITRUM_RPC_URL

# Increase gas limit
forge script ... --gas-limit 10000000
```

### Verification Fails

```bash
# Retry with explicit compiler version
forge verify-contract <ADDRESS> <CONTRACT> \
  --compiler-version v0.8.20 \
  --chain-id 42161 \
  --etherscan-api-key $ARBISCAN_API_KEY
```

### Docker Build Fails

```bash
# Clear Docker cache
docker builder prune

# Build with no cache
docker build --no-cache -t x402/facilitator:latest .
```

### npm Publish Fails

```bash
# Check npm credentials
npm whoami

# Clear npm cache
npm cache clean --force

# Retry publish
npm publish --access public
```
