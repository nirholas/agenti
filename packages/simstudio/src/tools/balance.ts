import type { ToolConfig, ToolResponse } from '../types.js'

export interface BalanceParams {
  evmAddress: string
  solanaAddress?: string
  heliusApiKey?: string
  serverUrl?: string
}

export interface BalanceEntry {
  token: string
  amount: string
  chain: string
}

export interface BalanceResult extends ToolResponse {
  output: {
    balances: BalanceEntry[]
    usdc: string
    sol: string
    summary: string
  }
}

export const agentiBalanceTool: ToolConfig<BalanceParams, BalanceResult> = {
  id: 'agenti_balance',
  name: 'Agenti Balance',
  description: 'Fetch USDC balance on Base and SOL balance for an AI agent wallet. Optionally includes SPL token balances via Helius.',
  version: '1.0.0',
  params: {
    evmAddress: {
      type: 'string',
      required: true,
      description: 'EVM wallet address (0x...)',
    },
    solanaAddress: {
      type: 'string',
      required: false,
      description: 'Solana wallet address (base58)',
    },
    heliusApiKey: {
      type: 'string',
      required: false,
      visibility: 'user-only',
      description: 'Helius API key for SPL token balances',
    },
    serverUrl: {
      type: 'string',
      required: false,
      visibility: 'hidden',
      default: 'http://localhost:3200',
    },
  },
  request: {
    url: (params) => `${params.serverUrl ?? 'http://localhost:3200'}/tools/balance`,
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({
      evmAddress: params.evmAddress,
      solanaAddress: params.solanaAddress,
      heliusApiKey: params.heliusApiKey,
    }),
  },
  async transformResponse(response) {
    const data = await response.json() as BalanceResult
    return data
  },
  outputs: {
    balances: { type: 'json', description: 'Array of { token, amount, chain } balance entries' },
    usdc: { type: 'string', description: 'USDC balance on Base' },
    sol: { type: 'string', description: 'SOL balance' },
    summary: { type: 'string', description: 'Human-readable balance summary' },
  },
}
