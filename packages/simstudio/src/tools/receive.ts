import type { ToolConfig, ToolResponse } from '../types.js'

export interface ReceiveParams {
  amount: number
  token: string
  chain: string
  evmAddress?: string
  solanaAddress?: string
  serverUrl?: string
}

export interface ReceiveResult extends ToolResponse {
  output: {
    id: string
    amount: string
    token: string
    chain: string
    address: string
    expiresAt: string
  }
}

export const agentiReceiveTool: ToolConfig<ReceiveParams, ReceiveResult> = {
  id: 'agenti_receive',
  name: 'Agenti Receive',
  description: 'Create a payment invoice for receiving USDC or SOL. Returns an address and expiry for the payer to fulfill on-chain.',
  version: '1.0.0',
  params: {
    amount: {
      type: 'number',
      required: true,
      description: 'Amount to request (in token units, e.g. 1.5 for 1.5 USDC)',
    },
    token: {
      type: 'string',
      required: true,
      default: 'USDC',
      description: 'Token symbol (USDC, SOL, etc.)',
    },
    chain: {
      type: 'string',
      required: true,
      default: 'base',
      description: 'Chain to receive on (base, arbitrum, ethereum, solana)',
    },
    evmAddress: {
      type: 'string',
      required: false,
      visibility: 'user-only',
      description: 'EVM receiving address (required for base/arbitrum/ethereum)',
    },
    solanaAddress: {
      type: 'string',
      required: false,
      visibility: 'user-only',
      description: 'Solana receiving address (required for solana chain)',
    },
    serverUrl: {
      type: 'string',
      required: false,
      visibility: 'hidden',
      default: 'http://localhost:3200',
    },
  },
  request: {
    url: (params) => `${params.serverUrl ?? 'http://localhost:3200'}/tools/receive`,
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({
      amount: params.amount,
      token: params.token,
      chain: params.chain,
      evmAddress: params.evmAddress,
      solanaAddress: params.solanaAddress,
    }),
  },
  async transformResponse(response) {
    const data = await response.json() as ReceiveResult
    return data
  },
  outputs: {
    id: { type: 'string', description: 'Invoice ID (UUID)' },
    amount: { type: 'string', description: 'Requested amount' },
    token: { type: 'string', description: 'Token symbol' },
    chain: { type: 'string', description: 'Chain name' },
    address: { type: 'string', description: 'Wallet address for payment' },
    expiresAt: { type: 'string', description: 'Invoice expiry (ISO 8601, 30 min from creation)' },
  },
}
