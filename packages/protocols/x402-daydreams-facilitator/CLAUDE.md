# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

x402 Facilitator is a payment settlement service for the [x402 protocol](https://github.com/coinbase/x402). It verifies cryptographic payment signatures and settles transactions on-chain for EVM, Solana, and Starknet networks.

## Commands

```bash
# Install dependencies (from root)
bun install

# Build core package
cd packages/core && bun run build

# Typecheck
cd packages/core && bun run typecheck
cd examples && npx tsc --noEmit

# Run tests
cd packages/core && bun test
cd packages/core && bun test --watch  # Watch mode
cd packages/core && bun test path/to/file.test.ts  # Single test

# Run examples
cd examples && bun run auth
cd examples && bun run paidApi

# Linting/formatting
cd packages/core && bun run lint
cd packages/core && bun run format
```

## Architecture

### Monorepo Structure

```
packages/core/          # @daydreamsai/facilitator - Pure library (no side effects)
examples/               # Standalone example scripts
examples/facilitator-server/  # @daydreamsai/facilitator-server - Server app
```

### Library vs Application Separation

- `packages/core` is a **library only** - no side effects, no running servers, no env vars at module load
- Server code, CLI entry points, and defaults belong in `examples/facilitator-server`
- Examples must import from package names (`@daydreamsai/facilitator`), not relative paths

### Core Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Facilitator Factory | `src/factory.ts` | `createFacilitator()` with signer injection |
| Middleware Core | `src/middleware/core.ts` | Shared payment verification logic |
| Elysia Middleware | `src/elysia/` | Elysia framework integration |
| Hono Middleware | `src/hono/` | Hono framework integration |
| Express Middleware | `src/express/` | Express framework integration |
| Upto Scheme | `src/upto/` | Permit-based batched payments (ERC-2612) |
| Starknet | `src/starknet/` | Starknet paymaster-sponsored payments |
| CDP Signer | `src/signers/cdp.ts` | Coinbase Developer Platform adapter |
| Auth Module | `src/auth/` | Token generation, rate limiting, tracking |
| Config | `src/config.ts` | Network/RPC configuration |

### Payment Schemes

- **Exact**: Immediate settlement, single transaction (EVM, SVM, Starknet)
- **Upto**: Batched settlement with ERC-2612 permits (EVM only)

### Subpath Exports

```typescript
import { createFacilitator } from "@daydreamsai/facilitator";
import { createElysiaPaidRoutes } from "@daydreamsai/facilitator/elysia";
import { createHonoPaidRoutes } from "@daydreamsai/facilitator/hono";
import { createExpressPaidRoutes } from "@daydreamsai/facilitator/express";
import { createCdpEvmSigner } from "@daydreamsai/facilitator/signers/cdp";
import { createResourceServer } from "@daydreamsai/facilitator/server";
import { createUnifiedClient } from "@daydreamsai/facilitator/client";
import { createUptoModule } from "@daydreamsai/facilitator/upto";
import { createAuthModule } from "@daydreamsai/facilitator/auth";
import { getRpcUrl } from "@daydreamsai/facilitator/config";
import { getNetworkDetails } from "@daydreamsai/facilitator/networks";
```

### Adding New Features

**New export:**
1. Create module in `packages/core/src/`
2. Add subpath export to `packages/core/package.json`
3. Run `bun run build`

**New example:**
1. Create `examples/my-example.ts`
2. Import from package names (not relative paths)
3. Add script to `examples/package.json`

## Supported Networks

- **EVM**: Base, Ethereum, Optimism, Arbitrum, Polygon, Avalanche, Abstract (mainnet + testnets)
- **Solana**: Mainnet, Devnet, Testnet
- **Starknet**: Mainnet, Sepolia

## Key Dependencies

- **EVM**: viem
- **Solana**: @solana/kit
- **Starknet**: starknet, x402-starknet
- **x402**: @x402/core, @x402/evm, @x402/svm
- **Frameworks**: Elysia, Hono, Express
