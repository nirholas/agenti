export type CoinPhase = 'bonding' | 'migrating' | 'graduated'

export interface CoinState {
  phase: CoinPhase
  mint: string
  pool?: string        // AMM pool address — only set when graduated
  marketCapSol?: number | undefined
  complete: boolean
}

// Note: this endpoint is CORS-protected — call server-side only
export async function getCoinState(mint: string): Promise<CoinState> {
  const res = await fetch(`https://frontend-api-v3.pump.fun/coins-v2/${mint}`)
  if (!res.ok) throw new Error(`pump.fun coins API ${res.status}: ${await res.text()}`)

  const data = (await res.json()) as {
    complete: boolean
    pump_swap_pool?: string
    market_cap?: number
  }

  if (data.complete && data.pump_swap_pool) {
    return { phase: 'graduated', mint, pool: data.pump_swap_pool, complete: true }
  }
  if (data.complete && !data.pump_swap_pool) {
    return { phase: 'migrating', mint, complete: true }
  }
  return { phase: 'bonding', mint, marketCapSol: data.market_cap, complete: false }
}
