# Arbitrum X402 Testing Guide

Complete guide for testing Arbitrum payment adapter locally and on testnets.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Running Tests](#running-tests)
- [Testnet Testing](#testnet-testing)
- [Mock Facilitator](#mock-facilitator)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- Node.js >= 18
- pnpm or npm
- Arbitrum Sepolia testnet ETH (for gas)
- Test tokens (USDs, USDC, USDT on Sepolia)

### Environment Variables
Create `.env` file in project root:

```bash
# Arbitrum Sepolia RPC (free tier available)
ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc

# Test wallet private key (NEVER use mainnet keys!)
TEST_PRIVATE_KEY=0x...

# Test recipient address
TEST_RECIPIENT=0x...

# Facilitator URL (use mock for local testing)
FACILITATOR_URL=http://localhost:3002
```

### Get Testnet ETH
1. Visit [Arbitrum Sepolia Faucet](https://faucet.quicknode.com/arbitrum/sepolia)
2. Enter your test wallet address
3. Request testnet ETH for gas fees

### Get Test Tokens

#### USDs (Sperax USD)
```bash
# USDs contract on Arbitrum Sepolia
CONTRACT_ADDRESS=0xYourUSDsTestnetAddress

# Request test tokens from Sperax faucet or
# Deploy mock ERC-20 with EIP-3009 support locally
```

#### USDC Test Tokens
```bash
# Circle's USDC faucet for Arbitrum Sepolia
# Visit: https://faucet.circle.com/
```

## Local Development Setup

### 1. Install Dependencies
```bash
cd /workspaces/Lyra
pnpm install
```

### 2. Build Packages
```bash
pnpm build
```

### 3. Install Test Dependencies
```bash
cd packages/core
pnpm add -D vitest express @types/express
```

### 4. Create Test Configuration
```bash
# Create test config file
cat > src/x402/tests/config.ts << 'EOF'
export const TEST_CONFIG = {
  network: 'sepolia' as const,
  rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
  privateKey: process.env.TEST_PRIVATE_KEY as `0x${string}`,
  recipient: process.env.TEST_RECIPIENT as `0x${string}`,
  facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:3002',
};
EOF
```

## Running Tests

### Run Unit Tests
```bash
# Run all unit tests
pnpm test src/x402/tests/arbitrum-adapter.test.ts

# Run with coverage
pnpm test --coverage src/x402/tests/arbitrum-adapter.test.ts

# Watch mode for development
pnpm test --watch src/x402/tests/arbitrum-adapter.test.ts
```

### Run Integration Tests
```bash
# Set environment variables first
export ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
export TEST_PRIVATE_KEY=0x...
export TEST_RECIPIENT=0x...

# Run integration tests
pnpm test src/x402/tests/integration.test.ts

# Skip integration tests if env not configured
pnpm test src/x402/tests/integration.test.ts --run
```

### Run All Tests
```bash
# Run complete test suite
pnpm test src/x402/tests/

# Generate HTML coverage report
pnpm test --coverage --reporter=html src/x402/tests/
```

### Test Output Examples

#### Successful Unit Test
```
✓ src/x402/tests/arbitrum-adapter.test.ts (15)
  ✓ ArbitrumX402Adapter (12)
    ✓ Initialization (4)
      ✓ should create adapter for mainnet
      ✓ should create adapter for sepolia testnet
      ✓ should use default RPC URL if not provided
      ✓ should accept custom RPC URL
    ✓ Payment Request Creation (3)
      ✓ should create payment request with default token (USDs)
      ✓ should create payment request with custom token
      ✓ should include deadline 5 minutes in future
    ✓ EIP-3009 Authorization (3)
      ✓ should create valid payment authorization
      ✓ should create different nonces for different authorizations
      ✓ should set validity window correctly
```

#### Successful Integration Test
```
✓ src/x402/tests/integration.test.ts (8)
  ✓ Arbitrum X402 Integration Tests (8)
    ✓ Standard Payment Flow (2)
      ✓ should execute standard USDs payment (5.2s)
      ✓ should execute USDC payment (4.8s)
    ✓ Gasless Payment Flow (EIP-3009) (2)
      ✓ should create and verify payment authorization
      ✓ should execute gasless payment through facilitator (6.1s)
```

## Testnet Testing

### Step-by-Step Testnet Validation

#### 1. Configure Testnet Environment
```bash
# .env configuration
ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
TEST_PRIVATE_KEY=0xYourTestnetPrivateKey
TEST_RECIPIENT=0xYourRecipientAddress
FACILITATOR_URL=https://testnet-facilitator.example.com
```

#### 2. Verify Testnet Connection
```typescript
import { createArbitrumAdapter } from './arbitrum-adapter';

const adapter = createArbitrumAdapter({
  network: 'sepolia',
  privateKey: process.env.TEST_PRIVATE_KEY,
});

const networkInfo = adapter.getNetworkInfo();
console.log('Connected to:', networkInfo);
```

#### 3. Check Test Token Balances
```typescript
const userAddress = '0xYourAddress';
const usdsBalance = await adapter.getUSdsBalance(userAddress);
console.log('USDs Balance:', usdsBalance.toString());
```

#### 4. Execute Test Payment
```typescript
const paymentRequest = adapter.createPaymentRequest({
  price: '0.0001',
  recipient: '0xRecipientAddress',
  token: 'USDs',
});

const result = await adapter.executeStandardPayment(paymentRequest);
console.log('Payment TX:', result.txHash);
```

#### 5. Verify on Block Explorer
```bash
# View transaction on Arbiscan Sepolia
https://sepolia.arbiscan.io/tx/[txHash]
```

### Testnet Testing Checklist
- [ ] Wallet has testnet ETH for gas
- [ ] Wallet has test USDs tokens
- [ ] RPC endpoint responds correctly
- [ ] Payment transaction confirms on-chain
- [ ] Balance changes reflect in queries
- [ ] Block explorer shows transaction details
- [ ] Facilitator verification works

## Mock Facilitator

### Local Mock Server

Create `mock-facilitator.ts`:

```typescript
import express from 'express';

const app = express();
app.use(express.json());

// Payment verification endpoint
app.post('/verify', (req, res) => {
  const { txHash, paymentRequest, signature } = req.body;

  console.log('Verify payment:', {
    txHash,
    amount: paymentRequest?.price,
    token: paymentRequest?.token,
  });

  // Mock verification logic
  if (!txHash || !paymentRequest) {
    return res.status(400).json({
      error: 'Missing required fields',
    });
  }

  // Simulate blockchain verification delay
  setTimeout(() => {
    res.json({
      verified: true,
      txHash,
      timestamp: Date.now(),
      blockNumber: 12345678,
    });
  }, 1000);
});

// Gasless payment settlement endpoint
app.post('/settle', async (req, res) => {
  const { authorization, paymentRequest } = req.body;

  console.log('Settle gasless payment:', {
    from: authorization?.from,
    to: authorization?.to,
    value: authorization?.value,
    token: paymentRequest?.token,
  });

  if (!authorization || !paymentRequest) {
    return res.status(400).json({
      error: 'Missing required fields',
    });
  }

  // Simulate on-chain settlement
  const mockTxHash = `0x${Math.random().toString(16).slice(2)}`;
  
  setTimeout(() => {
    res.json({
      success: true,
      txHash: mockTxHash,
      timestamp: Date.now(),
    });
  }, 2000);
});

const PORT = process.env.FACILITATOR_PORT || 3002;
app.listen(PORT, () => {
  console.log(`🚀 Mock facilitator running on http://localhost:${PORT}`);
});
```

### Run Mock Facilitator
```bash
# Install dependencies
pnpm add -D ts-node

# Run mock server
npx ts-node src/x402/tests/mock-facilitator.ts

# In another terminal, run tests
pnpm test src/x402/tests/integration.test.ts
```

### Mock Server Features
- **Payment Verification**: Simulates blockchain transaction verification
- **Gasless Settlement**: Mocks EIP-3009 transferWithAuthorization calls
- **Configurable Delays**: Simulates real network latency
- **Request Logging**: Tracks all payment requests for debugging

## Troubleshooting

### Common Issues

#### 1. Tests Fail with "Wallet client not initialized"
**Problem**: No private key provided to adapter

**Solution**:
```bash
export TEST_PRIVATE_KEY=0xYourPrivateKey
```

#### 2. Integration Tests Timeout
**Problem**: Testnet RPC slow or unreachable

**Solution**:
```typescript
// Increase test timeout
it('should execute payment', async () => {
  // ...
}, 60000); // 60 second timeout

// Or use faster RPC
ARBITRUM_SEPOLIA_RPC=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
```

#### 3. "Insufficient funds" Error
**Problem**: Test wallet lacks ETH or tokens

**Solution**:
```bash
# Get testnet ETH
https://faucet.quicknode.com/arbitrum/sepolia

# Get test USDC
https://faucet.circle.com/

# For USDs, request from Sperax or deploy mock contract
```

#### 4. Mock Facilitator Connection Refused
**Problem**: Mock server not running

**Solution**:
```bash
# Start mock facilitator first
npx ts-node src/x402/tests/mock-facilitator.ts

# Verify it's running
curl http://localhost:3002/verify -X POST -H "Content-Type: application/json" -d '{"txHash":"0xtest"}'
```

#### 5. EIP-3009 Signature Invalid
**Problem**: Incorrect domain or nonce

**Solution**:
```typescript
// Ensure correct chain ID in EIP-712 domain
const domain = {
  name: 'Sperax USD',
  version: '1',
  chainId: 421614, // Arbitrum Sepolia
  verifyingContract: SPERAX_USD_ADDRESS,
};

// Use unique nonce
const nonce = `0x${crypto.randomBytes(32).toString('hex')}`;
```

### Debug Mode

Enable detailed logging:

```typescript
// Add to adapter constructor
const adapter = createArbitrumAdapter({
  network: 'sepolia',
  privateKey: process.env.TEST_PRIVATE_KEY,
  debug: true, // Enable debug logging
});

// Or set environment variable
DEBUG=x402:* pnpm test
```

### Test Data Cleanup

After testing, clean up test data:

```bash
# Clear test transaction history
rm -rf .test-cache/

# Reset test database (if using local storage)
rm -rf test-db/
```

## Performance Benchmarks

Expected test execution times:

| Test Suite | Duration | Network Calls |
|------------|----------|---------------|
| Unit Tests | 1-2s | 0 (mocked) |
| Integration Tests (Mock) | 5-10s | 0 (local mock) |
| Integration Tests (Testnet) | 30-60s | 10-15 RPC calls |
| Full Test Suite | 1-2min | All |

### Optimize Test Speed

```typescript
// Run tests in parallel
pnpm test --parallel src/x402/tests/

// Skip slow integration tests
pnpm test --grep -v "Integration" src/x402/tests/

// Use local fork instead of testnet
anvil --fork-url $ARBITRUM_SEPOLIA_RPC --fork-block-number 12345678
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: X402 Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run unit tests
        run: pnpm test src/x402/tests/arbitrum-adapter.test.ts
      
      - name: Run integration tests (mock)
        run: pnpm test src/x402/tests/integration.test.ts
        env:
          FACILITATOR_URL: http://localhost:3002
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Next Steps

After completing local testing:

1. **Testnet Deployment**
   - Deploy on Arbitrum Sepolia
   - Execute real transactions
   - Monitor gas costs

2. **Stress Testing**
   - Test with high volume
   - Measure latency under load
   - Verify concurrent payment handling

3. **Security Audit**
   - Review signature validation
   - Test replay attack prevention
   - Verify deadline enforcement

4. **Production Preparation**
   - Configure mainnet facilitator
   - Set up monitoring/alerting
   - Document deployment checklist

## Resources

- [Arbitrum Sepolia Testnet](https://sepolia.arbiscan.io/)
- [Sperax USD Documentation](https://docs.sperax.io/)
- [EIP-3009 Specification](https://eips.ethereum.org/EIPS/eip-3009)
- [Viem Documentation](https://viem.sh/)
- [X402 Protocol Specification](https://github.com/coinbase/x402)
