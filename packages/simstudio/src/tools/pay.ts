import type { ToolConfig, ToolResponse } from '../types.js'

export interface PayParams {
  url: string
  method?: string
  evmPrivateKey: string
  solanaPrivateKey?: string
  serverUrl?: string
}

export interface PayResult extends ToolResponse {
  output: {
    status: number
    ok: boolean
    body: string
    paymentMade: boolean
    amount?: string
    network?: string
  }
}

export const agentiPayTool: ToolConfig<PayParams, PayResult> = {
  id: 'agenti_pay',
  name: 'Agenti Pay',
  description: 'Fetch a URL and automatically handle x402 Payment Required responses using USDC on Base, Arbitrum, or Solana.',
  version: '1.0.0',
  params: {
    url: {
      type: 'string',
      required: true,
      description: 'The URL to fetch (may return 402 Payment Required)',
    },
    method: {
      type: 'string',
      required: false,
      default: 'GET',
      description: 'HTTP method',
    },
    evmPrivateKey: {
      type: 'string',
      required: true,
      visibility: 'user-only',
      description: 'EVM private key (0x...) for USDC payment signing',
    },
    solanaPrivateKey: {
      type: 'string',
      required: false,
      visibility: 'user-only',
      description: 'Solana private key (base58) for SOL/SPL payment signing',
    },
    serverUrl: {
      type: 'string',
      required: false,
      visibility: 'hidden',
      default: 'http://localhost:3200',
      description: 'Agenti bridge server URL',
    },
  },
  request: {
    url: (params) => `${params.serverUrl ?? 'http://localhost:3200'}/tools/pay`,
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({
      url: params.url,
      method: params.method ?? 'GET',
      evmPrivateKey: params.evmPrivateKey,
      solanaPrivateKey: params.solanaPrivateKey,
    }),
  },
  async transformResponse(response) {
    const data = await response.json() as PayResult
    return data
  },
  outputs: {
    status: { type: 'number', description: 'HTTP response status code' },
    ok: { type: 'boolean', description: 'Whether the request succeeded' },
    body: { type: 'string', description: 'Response body text' },
    paymentMade: { type: 'boolean', description: 'Whether a payment was triggered' },
    amount: { type: 'string', description: 'Amount paid (if payment was made)' },
    network: { type: 'string', description: 'Network used for payment' },
  },
}
