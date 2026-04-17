# Integrate: pump-fun-sdk Bonding Curve Math

status: complete

## Source repo
https://github.com/nirholas/pump-fun-sdk

## Goal
Enhance `packages/sdk/src/solana/` with production-grade bonding curve math,
pre-trade analytics, and fee estimation from pump-fun-sdk. These are pure
computation functions — no signing, no network calls — so they're ideal to
drop into the SDK as a `curve.ts` module.

## Steps

### 1. Clone and read
```
git clone https://github.com/nirholas/pump-fun-sdk /tmp/pump-fun-sdk
```
Read these files fully:
- `/tmp/pump-fun-sdk/src/bondingCurve.ts`
- `/tmp/pump-fun-sdk/src/analytics.ts`
- `/tmp/pump-fun-sdk/src/fees.ts`
- `/tmp/pump-fun-sdk/src/pda.ts`
- `/tmp/pump-fun-sdk/src/fallback.ts`
- `/tmp/pump-fun-sdk/src/sdk.ts` (for constant values and program IDs)

### 2. Create `packages/sdk/src/solana/curve.ts`

Implement as clean TypeScript with no side effects. All functions take
`virtualSolReserves`, `virtualTokenReserves`, `realTokenReserves` from on-chain state.

```ts
export interface BondingCurveState {
  virtualSolReserves: bigint   // lamports
  virtualTokenReserves: bigint // raw token units
  realSolReserves: bigint
  realTokenReserves: bigint
  tokenTotalSupply: bigint
  complete: boolean
}

/** How many tokens you get for a given SOL input (in lamports). */
export function getBuyTokenAmount(solIn: bigint, state: BondingCurveState): bigint

/** How much SOL you get for a given token input. */
export function getSellSolAmount(tokenIn: bigint, state: BondingCurveState): bigint

/** Price impact percentage (0–100) for a buy of solIn lamports. */
export function getBuyPriceImpact(solIn: bigint, state: BondingCurveState): number

/** Price impact percentage (0–100) for a sell of tokenIn units. */
export function getSellPriceImpact(tokenIn: bigint, state: BondingCurveState): number

/** Current token price in SOL (as a float). */
export function getTokenPrice(state: BondingCurveState): number

/** Graduation progress 0–1 (1 = ready to migrate to AMM). */
export function getGraduationProgress(state: BondingCurveState): number

/** Estimate platform fee for a buy/sell amount in lamports. */
export function estimateFee(solAmount: bigint, feePercent?: number): bigint
```

The math is standard constant-product AMM: `k = virtualSolReserves * virtualTokenReserves`.
For buy: `newSolReserves = virtualSolReserves + solIn`, solve for tokenOut.
For sell: mirror operation.

### 3. Update `packages/sdk/src/solana/trade.ts`
Before executing a buy/sell, optionally log price impact if it exceeds a threshold:
```ts
import { getBuyPriceImpact, getBuyTokenAmount } from './curve.js'
// warn if impact > 5% (configurable via params.maxPriceImpact)
```

### 4. Create `packages/sdk/src/solana/rpc.ts`
Adapt the RPC failover pattern from `/tmp/pump-fun-sdk/src/fallback.ts`:
```ts
export interface RpcEndpoint { url: string; weight?: number }

/** Creates a Connection that round-robins across multiple RPC endpoints.
 *  Automatically retries on timeout/429 with the next endpoint. */
export function createFallbackConnection(
  endpoints: RpcEndpoint[],
  commitment?: Commitment
): Connection
```

### 5. Export from `packages/sdk/src/solana/index.ts`
```ts
export { getBuyTokenAmount, getSellSolAmount, getBuyPriceImpact, getSellPriceImpact,
         getTokenPrice, getGraduationProgress, estimateFee } from './curve.js'
export type { BondingCurveState } from './curve.js'
export { createFallbackConnection } from './rpc.js'
export type { RpcEndpoint } from './rpc.js'
```

And from `packages/sdk/src/index.ts`:
```ts
export { getBuyTokenAmount, getSellSolAmount, getBuyPriceImpact, getSellPriceImpact,
         getTokenPrice, getGraduationProgress, estimateFee, createFallbackConnection } from './solana/index.js'
export type { BondingCurveState, RpcEndpoint } from './solana/index.js'
```

## Sensitivity check
Bonding curve math is standard constant-product AMM (x*y=k), widely published.
The fee tier logic is public pump.fun protocol knowledge. Rewrite from first
principles using the source as reference — do not copy variable names verbatim.

## Output files
- `packages/sdk/src/solana/curve.ts`
- `packages/sdk/src/solana/rpc.ts`
- Updated `packages/sdk/src/solana/trade.ts` (price impact check)
- Updated `packages/sdk/src/solana/index.ts` (exports)
- Updated `packages/sdk/src/index.ts` (exports)

Mark this file's status as `complete` when done.
