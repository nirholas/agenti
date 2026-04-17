import type { ToolConfig, ToolResponse } from '../types.js'

export interface SolanaTokenPriceParams {
  mint: string
  serverUrl?: string
}

export interface SolanaTokenPriceResult extends ToolResponse {
  output: {
    mint: string
    price: number
    priceUsd: number
    liquidity: number
    marketCap?: number
  }
}

export const agentiSolanaTokenPriceTool: ToolConfig<SolanaTokenPriceParams, SolanaTokenPriceResult> = {
  id: 'agenti_solana_token_price',
  name: 'Agenti Solana Token Price',
  description: 'Get real-time price and liquidity for any Solana token (including pump.fun launches) via GMGN.',
  version: '1.0.0',
  params: {
    mint: {
      type: 'string',
      required: true,
      description: 'Solana token mint address (base58)',
    },
    serverUrl: {
      type: 'string',
      required: false,
      visibility: 'hidden',
      default: 'http://localhost:3200',
    },
  },
  request: {
    url: (params) => `${params.serverUrl ?? 'http://localhost:3200'}/tools/solana/token-price`,
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({ mint: params.mint }),
  },
  async transformResponse(response) {
    return response.json() as Promise<SolanaTokenPriceResult>
  },
  outputs: {
    mint: { type: 'string', description: 'Token mint address' },
    price: { type: 'number', description: 'Price in SOL' },
    priceUsd: { type: 'number', description: 'Price in USD' },
    liquidity: { type: 'number', description: 'Pool liquidity in USD' },
    marketCap: { type: 'number', description: 'Market cap in USD' },
  },
}

export interface SolanaBuyParams {
  mint: string
  solAmount: number
  solanaPrivateKey: string
  slippageBps?: number
  serverUrl?: string
}

export interface SolanaBuyResult extends ToolResponse {
  output: {
    txHash: string
    mint: string
    solSpent: number
    tokensReceived: string
    pricePerToken: number
  }
}

export const agentiSolanaBuyTool: ToolConfig<SolanaBuyParams, SolanaBuyResult> = {
  id: 'agenti_solana_buy',
  name: 'Agenti Solana Buy',
  description: 'Buy a Solana token on pump.fun or Raydium using SOL. Handles bonding curve vs. AMM routing automatically.',
  version: '1.0.0',
  params: {
    mint: {
      type: 'string',
      required: true,
      description: 'Token mint address to buy',
    },
    solAmount: {
      type: 'number',
      required: true,
      description: 'Amount of SOL to spend',
    },
    solanaPrivateKey: {
      type: 'string',
      required: true,
      visibility: 'user-only',
      description: 'Solana private key (base58) for signing',
    },
    slippageBps: {
      type: 'number',
      required: false,
      default: 100,
      description: 'Slippage tolerance in basis points (100 = 1%)',
    },
    serverUrl: {
      type: 'string',
      required: false,
      visibility: 'hidden',
      default: 'http://localhost:3200',
    },
  },
  request: {
    url: (params) => `${params.serverUrl ?? 'http://localhost:3200'}/tools/solana/buy`,
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({
      mint: params.mint,
      solAmount: params.solAmount,
      solanaPrivateKey: params.solanaPrivateKey,
      slippageBps: params.slippageBps ?? 100,
    }),
  },
  async transformResponse(response) {
    return response.json() as Promise<SolanaBuyResult>
  },
  outputs: {
    txHash: { type: 'string', description: 'Transaction signature' },
    mint: { type: 'string', description: 'Token mint address' },
    solSpent: { type: 'number', description: 'SOL spent' },
    tokensReceived: { type: 'string', description: 'Tokens received' },
    pricePerToken: { type: 'number', description: 'Average price per token in SOL' },
  },
}

export interface SolanaSellParams {
  mint: string
  tokenAmount: string
  solanaPrivateKey: string
  slippageBps?: number
  serverUrl?: string
}

export interface SolanaSellResult extends ToolResponse {
  output: {
    txHash: string
    mint: string
    tokensSold: string
    solReceived: number
    pricePerToken: number
  }
}

export const agentiSolanaSellTool: ToolConfig<SolanaSellParams, SolanaSellResult> = {
  id: 'agenti_solana_sell',
  name: 'Agenti Solana Sell',
  description: 'Sell a Solana token on pump.fun or Raydium, receiving SOL in return.',
  version: '1.0.0',
  params: {
    mint: {
      type: 'string',
      required: true,
      description: 'Token mint address to sell',
    },
    tokenAmount: {
      type: 'string',
      required: true,
      description: 'Amount of tokens to sell (use "all" to sell entire balance)',
    },
    solanaPrivateKey: {
      type: 'string',
      required: true,
      visibility: 'user-only',
      description: 'Solana private key (base58) for signing',
    },
    slippageBps: {
      type: 'number',
      required: false,
      default: 100,
      description: 'Slippage tolerance in basis points',
    },
    serverUrl: {
      type: 'string',
      required: false,
      visibility: 'hidden',
      default: 'http://localhost:3200',
    },
  },
  request: {
    url: (params) => `${params.serverUrl ?? 'http://localhost:3200'}/tools/solana/sell`,
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({
      mint: params.mint,
      tokenAmount: params.tokenAmount,
      solanaPrivateKey: params.solanaPrivateKey,
      slippageBps: params.slippageBps ?? 100,
    }),
  },
  async transformResponse(response) {
    return response.json() as Promise<SolanaSellResult>
  },
  outputs: {
    txHash: { type: 'string', description: 'Transaction signature' },
    mint: { type: 'string', description: 'Token mint address' },
    tokensSold: { type: 'string', description: 'Tokens sold' },
    solReceived: { type: 'number', description: 'SOL received' },
    pricePerToken: { type: 'number', description: 'Average price per token in SOL' },
  },
}

export interface SmartWalletParams {
  walletAddress: string
  serverUrl?: string
}

export interface SmartWalletResult extends ToolResponse {
  output: {
    address: string
    isSmart: boolean
    winRate?: number
    avgReturn?: number
    totalTrades?: number
    recentTrades: Array<{ mint: string; side: string; sol: number; ts: number }>
  }
}

export const agentiSmartWalletTool: ToolConfig<SmartWalletParams, SmartWalletResult> = {
  id: 'agenti_smart_wallet',
  name: 'Agenti Smart Wallet',
  description: 'Analyze a Solana wallet to determine if it is a high-performing "smart money" wallet. Returns win rate, average return, and recent trades.',
  version: '1.0.0',
  params: {
    walletAddress: {
      type: 'string',
      required: true,
      description: 'Solana wallet address to analyze',
    },
    serverUrl: {
      type: 'string',
      required: false,
      visibility: 'hidden',
      default: 'http://localhost:3200',
    },
  },
  request: {
    url: (params) => `${params.serverUrl ?? 'http://localhost:3200'}/tools/solana/smart-wallet`,
    method: 'POST',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: (params) => ({ walletAddress: params.walletAddress }),
  },
  async transformResponse(response) {
    return response.json() as Promise<SmartWalletResult>
  },
  outputs: {
    address: { type: 'string', description: 'Wallet address' },
    isSmart: { type: 'boolean', description: 'Whether this is classified as a smart wallet' },
    winRate: { type: 'number', description: 'Win rate % of trades' },
    avgReturn: { type: 'number', description: 'Average return per trade %' },
    totalTrades: { type: 'number', description: 'Total trades analyzed' },
    recentTrades: { type: 'json', description: 'Array of recent trade objects' },
  },
}
