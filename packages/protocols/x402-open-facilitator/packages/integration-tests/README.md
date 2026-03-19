# Integration Tests

Integration tests for OpenFacilitator endpoints.

## Setup

```bash
pnpm install
```

## Running Tests

```bash
# Run smoke tests (safe, no real transactions)
pnpm test

# Run tests for free endpoint only
pnpm test:free

# Run tests for custom domain only
pnpm test:custom

# Run REAL Solana transaction tests (⚠️ spends real USDC!)
pnpm test:solana

# Run REAL Base transaction tests (⚠️ spends real USDC!)
pnpm test:base

# Run all real transaction tests
pnpm test:real

# Run all tests including real transactions
pnpm test:all
```

## Solana Real Transaction Tests

These tests create and settle REAL transactions on Solana mainnet.

**Prerequisites:**
1. Solana CLI keypair at `~/.config/solana/id.json`
2. USDC balance in the wallet (at least $0.01)

**What it tests:**
- Creates a signed USDC transfer transaction ($0.01)
- Verifies the transaction via the facilitator
- Settles the transaction on-chain

**To run:**
```bash
# Make sure the tests are enabled (not skipped)
# Edit src/solana-real.test.ts and change describe.skip to describe

pnpm test:solana
```

## Base (EVM) Real Transaction Tests

These tests create and settle REAL transactions on Base mainnet using ERC-3009.

**Prerequisites:**
1. EVM private key - either:
   - Set `TEST_EVM_PRIVATE_KEY` environment variable
   - Create file at `~/.config/evm/private_key`
2. USDC balance on Base (at least $0.01)

**What it tests:**
- Creates a signed ERC-3009 authorization ($0.01)
- Verifies the authorization via the facilitator
- Settles the transaction on-chain (facilitator pays gas)

**To run:**
```bash
# Make sure the tests are enabled (not skipped)
# Edit src/base-real.test.ts and change describe.skip to describe

pnpm test:base
```

## Test Coverage

### Smoke Tests (CI-safe)
- **Health checks** - Verify endpoints are reachable
- **Supported networks** - Verify `/supported` returns expected format  
- **Verify endpoint** - Test payment verification with invalid inputs
- **Settle endpoint** - Test settlement rejection for invalid payments
- **Default facilitator** - Verify SDK defaults work correctly

### Real Transaction Tests (manual only)
- **Solana verify** - Verify a real signed Solana transaction
- **Solana settle** - Settle a real Solana transaction (spends USDC)
- **Base verify** - Verify a real ERC-3009 authorization
- **Base settle** - Settle a real Base transaction (spends USDC)

