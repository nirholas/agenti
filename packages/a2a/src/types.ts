import type { PaymentPayload, PaymentRequired, VerifyResult, SettleResult } from '@agenti/facilitator'

// Re-export facilitator types used throughout this package
export type { PaymentPayload, PaymentRequired, VerifyResult, SettleResult }

// ─── A2A Protocol Extension URI ───────────────────────────────────────────────

export const X402_EXTENSION_URI =
  'https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2'

// ─── Payment State Machine ────────────────────────────────────────────────────

export const PaymentStatus = {
  REQUIRED: 'payment-required',
  SUBMITTED: 'payment-submitted',
  VERIFIED: 'payment-verified',
  REJECTED: 'payment-rejected',
  COMPLETED: 'payment-completed',
  FAILED: 'payment-failed',
} as const

export type PaymentStatusValue = (typeof PaymentStatus)[keyof typeof PaymentStatus]

// ─── Metadata Keys (spec §7) ──────────────────────────────────────────────────

export const META = {
  STATUS: 'x402.payment.status',
  REQUIRED: 'x402.payment.required',
  PAYLOAD: 'x402.payment.payload',
  RECEIPTS: 'x402.payment.receipts',
  ERROR: 'x402.payment.error',
} as const

// ─── Error Codes (spec §9.1) ──────────────────────────────────────────────────

export const ErrorCode = {
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  EXPIRED_PAYMENT: 'EXPIRED_PAYMENT',
  DUPLICATE_NONCE: 'DUPLICATE_NONCE',
  NETWORK_MISMATCH: 'NETWORK_MISMATCH',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  SETTLEMENT_FAILED: 'SETTLEMENT_FAILED',
} as const

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

// ─── A2A Message Types ────────────────────────────────────────────────────────

export interface A2ATextPart {
  kind: 'text'
  text: string
}

export interface A2ADataPart {
  kind: 'data'
  data: Record<string, unknown>
}

export type A2APart = A2ATextPart | A2ADataPart

export interface A2AMessage {
  kind: 'message'
  role: 'user' | 'agent'
  parts: A2APart[]
  metadata?: Record<string, unknown>
  taskId?: string
}

export type TaskState =
  | 'submitted'
  | 'working'
  | 'input-required'
  | 'completed'
  | 'failed'
  | 'canceled'

export interface TaskStatus {
  state: TaskState
  message?: A2AMessage
}

export interface A2ATask {
  kind: 'task'
  id: string
  contextId?: string
  status: TaskStatus
  artifacts?: A2AArtifact[]
  metadata?: Record<string, unknown>
}

export interface A2AArtifact {
  artifactId: string
  name?: string
  parts: A2APart[]
}

// ─── x402 A2A Payload Types ───────────────────────────────────────────────────

export interface X402PaymentRequired {
  x402Version: number
  accepts: PaymentRequired[]
  error?: string | undefined
}

export interface X402Receipt {
  success: boolean
  transaction?: string | undefined
  network: string
  payer?: string | undefined
  errorReason?: string | undefined
}

// ─── Configuration ────────────────────────────────────────────────────────────

export interface MerchantConfig {
  /** Price in USDC smallest unit (e.g. "1000000" = $1.00) */
  amount: string
  /** Wallet address to receive payment */
  payTo: `0x${string}`
  /** CAIP-2 network identifier (default: "base-mainnet") */
  network?: string
  /** ERC-20 asset contract address (default: Base USDC) */
  asset?: string
  /** Human-readable description shown to client agents */
  description?: string
}

export interface ClientConfig {
  /** Function that signs a PaymentRequired and returns a PaymentPayload */
  signer: (requirements: PaymentRequired) => Promise<PaymentPayload>
  /** Whether to auto-pay without prompting (default: true) */
  autoPay?: boolean
}
