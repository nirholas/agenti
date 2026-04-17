// Pump.fun bonding curve math — pure computation, no network calls.
// All reserves use raw units: SOL in lamports, tokens in 6-decimal raw units.

export interface BondingCurveState {
  virtualSolReserves: bigint   // lamports
  virtualTokenReserves: bigint // raw token units (6 decimals)
  realSolReserves: bigint
  realTokenReserves: bigint
  tokenTotalSupply: bigint
  complete: boolean
}

// Default pump.fun protocol fee: 1% (100 bps)
const DEFAULT_FEE_BPS = 100n

// Pump.fun bonding curves start with ~793.1M tokens (6 decimals) available for sale
const INITIAL_REAL_TOKEN_RESERVES = 793_100_000_000_000n

/** How many tokens you get for a given SOL input (in lamports). */
export function getBuyTokenAmount(solIn: bigint, state: BondingCurveState): bigint {
  if (solIn === 0n || state.virtualTokenReserves === 0n) return 0n
  // Fee is deducted from input before entering the AMM
  const solForCurve = (solIn * (10_000n - DEFAULT_FEE_BPS)) / 10_000n
  // k = virtualSol * virtualToken; solve for tokenOut given new sol reserves
  const tokenOut = (state.virtualTokenReserves * solForCurve) / (state.virtualSolReserves + solForCurve)
  return tokenOut < state.realTokenReserves ? tokenOut : state.realTokenReserves
}

/** How much SOL you get for a given token input (in raw units). */
export function getSellSolAmount(tokenIn: bigint, state: BondingCurveState): bigint {
  if (tokenIn === 0n || state.virtualTokenReserves === 0n) return 0n
  const solOut = (state.virtualSolReserves * tokenIn) / (state.virtualTokenReserves + tokenIn)
  // Fee deducted from output (ceiling division)
  const feeAmt = (solOut * DEFAULT_FEE_BPS + 9_999n) / 10_000n
  return solOut > feeAmt ? solOut - feeAmt : 0n
}

/** Price impact percentage (0–100) for a buy of solIn lamports. */
export function getBuyPriceImpact(solIn: bigint, state: BondingCurveState): number {
  if (state.virtualSolReserves === 0n || state.virtualTokenReserves === 0n) return 0
  const priceBefore = Number(state.virtualSolReserves) / Number(state.virtualTokenReserves)
  const tokensOut = getBuyTokenAmount(solIn, state)
  const newVirtualToken = state.virtualTokenReserves - tokensOut
  if (newVirtualToken <= 0n) return 100
  const priceAfter = Number(state.virtualSolReserves + solIn) / Number(newVirtualToken)
  return Math.min(100, Math.max(0, ((priceAfter - priceBefore) / priceBefore) * 100))
}

/** Price impact percentage (0–100) for a sell of tokenIn raw units. */
export function getSellPriceImpact(tokenIn: bigint, state: BondingCurveState): number {
  if (state.virtualSolReserves === 0n || state.virtualTokenReserves === 0n) return 0
  const priceBefore = Number(state.virtualSolReserves) / Number(state.virtualTokenReserves)
  const solOut = getSellSolAmount(tokenIn, state)
  const priceAfter = Number(state.virtualSolReserves - solOut) / Number(state.virtualTokenReserves + tokenIn)
  return Math.min(100, Math.max(0, ((priceBefore - priceAfter) / priceBefore) * 100))
}

/** Current token price in SOL per whole token (float). */
export function getTokenPrice(state: BondingCurveState): number {
  if (state.virtualTokenReserves === 0n) return 0
  // lamports per raw unit → SOL per whole token (1e6 raw units)
  return Number(state.virtualSolReserves) / Number(state.virtualTokenReserves) / 1_000
}

/** Graduation progress 0–1 (1 = all curve tokens sold, ready to migrate to AMM). */
export function getGraduationProgress(state: BondingCurveState): number {
  if (state.complete) return 1
  const initial = INITIAL_REAL_TOKEN_RESERVES
  if (state.realTokenReserves >= initial) return 0
  const sold = initial - state.realTokenReserves
  return Math.min(1, Number(sold) / Number(initial))
}

/**
 * Estimate platform fee for a trade amount in lamports.
 * @param feePercent - Fee percentage (default 1.0 = 1%)
 */
export function estimateFee(solAmount: bigint, feePercent = 1.0): bigint {
  const bps = BigInt(Math.round(feePercent * 100))
  return (solAmount * bps + 9_999n) / 10_000n
}
