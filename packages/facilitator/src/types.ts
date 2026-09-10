export interface EIP3009Authorization {
  from: `0x${string}`
  to: `0x${string}`
  value: string
  validAfter: string
  validBefore: string
  nonce: `0x${string}`
}

export interface EVMPaymentPayload {
  x402Version: number
  scheme: string
  network: string
  payload: {
    signature: `0x${string}`
    authorization: EIP3009Authorization
  }
}

/**
 * A Solana payment is a receipt, not an authorization: the payer already
 * submitted and confirmed the transfer, so what arrives is the signature to
 * verify on-chain.
 */
export interface SolanaPaymentPayload {
  x402Version: number
  scheme: string
  network: string
  payload: {
    /** Base58 signature of the confirmed transfer. */
    signature: string
    /** Account that sent the payment, bound during verification when present. */
    payer?: string
  }
}

export type PaymentPayload = EVMPaymentPayload | SolanaPaymentPayload

/** True when a payload carries a Solana receipt rather than an EIP-3009 authorization. */
export function isSolanaPayload(payment: PaymentPayload): payment is SolanaPaymentPayload {
  return typeof (payment.payload as { signature?: unknown }).signature === 'string'
    && !(payment.payload as { authorization?: unknown }).authorization
}

export interface PaymentRequired {
  /** x402 payment scheme, e.g. "exact". */
  scheme?: string
  asset: string
  payTo: string
  amount: string
  network: string
  extra?: { name?: string; version?: string } | Record<string, unknown>
}

export interface VerifyResult {
  valid: boolean
  error?: string
}

export interface SettleResult {
  settled: boolean
  txHash?: string
  error?: string
}

export interface FacilitatorConfig {
  /** Per-network RPC URLs keyed by CAIP-2 string (e.g. "eip155:8453"). */
  rpcUrls?: Record<string, string>
  /** Private key of the gas wallet used to submit settle transactions. */
  settlerPrivateKey?: `0x${string}`
  /**
   * Solana verification options: RPC endpoint and how settled a transfer must
   * be before it counts. Solana needs no settler key, because the payer has
   * already broadcast the transfer by the time the seller sees it.
   */
  solana?: {
    rpcUrl?: string
    commitment?: 'confirmed' | 'finalized'
  }
}
