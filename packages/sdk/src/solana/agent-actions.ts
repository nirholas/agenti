import { z } from 'zod'

const TokenSymbol = z.enum(['SOL', 'USDC', 'USDT', 'BTC', 'ETH'])

export const BuildPaymentInstructionsSchema = z.object({
  agentMint: z.string().describe('Agent token mint address'),
  currencyMint: z.string().optional().describe('Currency mint address (default: USDC mainnet)'),
  amount: z.union([z.string(), z.number()]).describe('Amount in minor units (e.g. 1000000 = 1 USDC)'),
  windowSeconds: z.number().optional().describe('Invoice validity window in seconds (default: 300)'),
})

export const ValidateInvoiceSchema = z.object({
  agentMint: z.string().describe('Agent token mint address'),
  currencyMint: z.string().describe('Currency mint address'),
  user: z.string().describe('Payer wallet address'),
  amount: z.union([z.string(), z.number()]).describe('Invoice amount in minor units'),
  memo: z.union([z.string(), z.number()]).describe('Invoice memo nonce'),
  startTime: z.number().describe('Invoice start Unix timestamp (seconds)'),
  endTime: z.number().describe('Invoice end Unix timestamp (seconds)'),
})

export const GetVaultBalancesSchema = z.object({
  agentMint: z.string().describe('Agent token mint address'),
  currencyMint: z.string().optional().describe('Currency mint address (default: USDC mainnet)'),
})

export const GetPriceSchema = z.object({
  symbol: TokenSymbol.describe('Token symbol to get USD price for'),
})

export const UsdToTokenSchema = z.object({
  usdAmount: z.number().positive().describe('USD amount to convert'),
  symbol: TokenSymbol.describe('Target token symbol'),
  decimals: z.number().int().default(6).describe('Token decimal places (default: 6 for USDC)'),
})

export const TokenToUsdSchema = z.object({
  rawAmount: z.string().describe('Raw token amount as string (minor units, e.g. "1000000")'),
  symbol: TokenSymbol.describe('Token symbol'),
  decimals: z.number().int().default(6).describe('Token decimal places'),
})

export const GetPaymentHistorySchema = z.object({
  agentMint: z.string().describe('Agent token mint address'),
  currencyMint: z.string().optional().describe('Currency mint address (default: USDC mainnet)'),
  limit: z.number().int().min(1).max(100).default(20).describe('Number of payments to return'),
})

export const VerifyPaymentReceiptSchema = z.object({
  signature: z.string().describe('Solana transaction signature to verify'),
})

export const DistributePaymentsSchema = z.object({
  agentMint: z.string().describe('Agent token mint address'),
  currencyMint: z.string().optional().describe('Currency mint address (default: USDC mainnet)'),
  withdrawDestination: z.string().describe('Wallet address to receive the withdraw portion'),
})

export const WithdrawFromVaultSchema = z.object({
  agentMint: z.string().describe('Agent token mint address'),
  currencyMint: z.string().optional().describe('Currency mint address (default: USDC mainnet)'),
  destination: z.string().describe('Destination wallet address for withdrawn funds'),
})

export const AgentActionSchemas = {
  buildPaymentInstructions: BuildPaymentInstructionsSchema,
  validateInvoice: ValidateInvoiceSchema,
  getVaultBalances: GetVaultBalancesSchema,
  getPrice: GetPriceSchema,
  usdToToken: UsdToTokenSchema,
  tokenToUsd: TokenToUsdSchema,
  getPaymentHistory: GetPaymentHistorySchema,
  verifyPaymentReceipt: VerifyPaymentReceiptSchema,
  distributePayments: DistributePaymentsSchema,
  withdrawFromVault: WithdrawFromVaultSchema,
} as const
