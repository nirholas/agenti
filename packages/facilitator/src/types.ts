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

export type PaymentPayload = EVMPaymentPayload

export interface PaymentRequired {
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
}
