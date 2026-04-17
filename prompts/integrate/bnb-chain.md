# Integrate: BNB Chain Support

status: complete

## Source repos
- https://github.com/nirholas/bnb-chain-toolkit (78 agents, x402/ERC-8004 protocols, 1100+ tools)
- https://github.com/nirholas/bnbchain-mcp (1000+ BNB Chain MCP tools)
- https://github.com/nirholas/universal-crypto-mcp (multi-chain x402 gateway + core types)

## Goal
Add BNB Chain as a first-class supported chain in agenti. This includes:
1. BNB/BSC wallet support in `@agenti/core`
2. BNB Chain network constants + USDT/BUSD contract addresses in `@agenti/sdk`
3. 5 BNB-specific MCP tools in `@agenti/mcp`
4. Improved x402 gateway types from universal-crypto-mcp

## Steps

### 1. Clone and read
```
git clone https://github.com/nirholas/bnb-chain-toolkit /tmp/bnb-chain-toolkit
git clone https://github.com/nirholas/bnbchain-mcp /tmp/bnbchain-mcp
git clone https://github.com/nirholas/universal-crypto-mcp /tmp/universal-crypto-mcp
```
Read:
- `/tmp/bnb-chain-toolkit/agent-runtime/src/protocols/x402/types.ts`
- `/tmp/bnb-chain-toolkit/agent-runtime/src/protocols/erc8004/`
- `/tmp/universal-crypto-mcp/packages/core/src/types/index.ts`
- `/tmp/universal-crypto-mcp/deploy/src/gateway/x402-gateway.ts`
- `/tmp/bnbchain-mcp/src/modules/` (scan tool structure, pick 5 most useful)

### 2. Add BNB Chain to network constants in `packages/sdk/src/pay.ts`

Add to `EVM_NETWORKS`:
```ts
'eip155:56': bsc,            // BNB Chain mainnet
'eip155:97': bscTestnet,     // BNB Chain testnet
'bsc-mainnet': bsc,          // legacy alias
```

Add to viem imports:
```ts
import { bsc, bscTestnet } from 'viem/chains'
```

### 3. Add BNB token constants to `packages/sdk/src/serve.ts`

```ts
export const TOKENS = {
  USDC_BASE: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  USDC_ARB: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  USDC_ETH: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT_BSC: '0x55d398326f99059fF775485246999027B3197955',
  BUSD_BSC: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
} as const
```

### 4. Create `packages/sdk/src/bnb.ts`

```ts
import { createWalletClient, http, publicActions } from 'viem'
import { bsc } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import type { EVMWallet } from '@agenti/core'

export interface BNBConfig {
  wallet: EVMWallet
  rpc?: string
}

export interface BNBInstance {
  address: string
  /** Get BNB balance in ether units. */
  bnbBalance(): Promise<number>
  /** Get BEP-20 token balance (USDT, BUSD, etc.). */
  tokenBalance(tokenAddress: string): Promise<{ raw: bigint; formatted: string }>
  /** Transfer BEP-20 token to recipient. */
  transfer(token: string, to: string, amount: bigint): Promise<string>
}

export function bnb(config: BNBConfig): BNBInstance

/** BNB Chain pancakeswap price for a token pair. */
export async function getBnbTokenPrice(tokenAddress: string): Promise<number>
```

### 5. Add 5 MCP tools to `packages/mcp/src/server.ts`

Pick the 5 most broadly useful BNB tools from bnbchain-mcp:
1. **`bnb_get_balance`** — BNB + USDT/BUSD balance for a wallet address
2. **`bnb_transfer`** — Send BEP-20 tokens to an address
3. **`bnb_get_token_price`** — Token price via PancakeSwap V3
4. **`bnb_get_transactions`** — Recent transactions for an address via BscScan API
5. **`bnb_swap`** — Token swap via PancakeSwap (if private key provided)

### 6. Export from index
```ts
// packages/sdk/src/index.ts
export { bnb, getBnbTokenPrice } from './bnb.js'
export type { BNBConfig, BNBInstance } from './bnb.js'
export { TOKENS } from './serve.js'
```

## Sensitivity check
bnb-chain-toolkit is MIT licensed. The x402/ERC-8004 protocol types are standard
protocol definitions. The BNB Chain toolkit patterns are generic BEP-20 operations.
The universal-crypto-mcp types are general multi-chain abstractions. All safe to
implement from scratch using the sources as specification.

## Output files
- `packages/sdk/src/bnb.ts`
- Updated `packages/sdk/src/pay.ts` (BNB Chain in EVM_NETWORKS)
- Updated `packages/sdk/src/serve.ts` (TOKENS constants)
- Updated `packages/mcp/src/server.ts` (5 new tools)
- Updated `packages/sdk/src/index.ts`

Mark this file's status as `complete` when done.
