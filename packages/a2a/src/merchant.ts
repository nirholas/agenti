import type { Context, MiddlewareHandler } from 'hono'
// The chain-agnostic entry points, so an A2A task can be paid on Solana as
// well as on EVM without this file knowing the difference.
import { verify, settle } from '@agenti/facilitator'
import type { FacilitatorConfig } from '@agenti/facilitator'
import {
  PaymentStatus,
  META,
  ErrorCode,
  X402_EXTENSION_URI,
  type MerchantConfig,
  type A2ATask,
  type A2AMessage,
  type X402PaymentRequired,
  type X402Receipt,
  type PaymentPayload,
  type PaymentRequired,
} from './types.js'

// Base USDC on Base mainnet
const DEFAULT_ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913'

function buildPaymentRequired(config: MerchantConfig): X402PaymentRequired {
  const req: PaymentRequired = {
    asset: config.asset ?? DEFAULT_ASSET,
    payTo: config.payTo,
    amount: config.amount,
    network: config.network ?? 'base-mainnet',
  }
  return { x402Version: 1, accepts: [req], error: config.description }
}

function paymentRequiredTask(taskId: string, paymentRequired: X402PaymentRequired): A2ATask {
  return {
    kind: 'task',
    id: taskId,
    status: {
      state: 'input-required',
      message: {
        kind: 'message',
        role: 'agent',
        parts: [{ kind: 'text', text: paymentRequired.error ?? 'Payment is required.' }],
        metadata: {
          [META.STATUS]: PaymentStatus.REQUIRED,
          [META.REQUIRED]: paymentRequired,
        },
      },
    },
  }
}

function failedTask(taskId: string, errorCode: string, reason: string, network = 'base-mainnet'): A2ATask {
  const receipt: X402Receipt = { success: false, network, errorReason: reason }
  return {
    kind: 'task',
    id: taskId,
    status: {
      state: 'failed',
      message: {
        kind: 'message',
        role: 'agent',
        parts: [{ kind: 'text', text: reason }],
        metadata: {
          [META.STATUS]: PaymentStatus.FAILED,
          [META.ERROR]: errorCode,
          [META.RECEIPTS]: [receipt],
        },
      },
    },
  }
}

function extractPayload(message: A2AMessage): PaymentPayload | null {
  const meta = message.metadata
  if (!meta) return null
  const raw = meta[META.PAYLOAD]
  if (!raw || typeof raw !== 'object') return null
  return raw as PaymentPayload
}

function getPaymentStatus(message: A2AMessage): string | null {
  return (message.metadata?.[META.STATUS] as string | undefined) ?? null
}

const PENDING_TTL_MS = 10 * 60 * 1000 // 10 minutes

interface PendingEntry {
  requirements: PaymentRequired
  expiresAt: number
}

function makePendingStore() {
  const store = new Map<string, PendingEntry>()

  function set(taskId: string, requirements: PaymentRequired): void {
    store.set(taskId, { requirements, expiresAt: Date.now() + PENDING_TTL_MS })
  }

  function get(taskId: string): PaymentRequired | undefined {
    const entry = store.get(taskId)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      store.delete(taskId)
      return undefined
    }
    return entry.requirements
  }

  function del(taskId: string): void {
    store.delete(taskId)
  }

  return { set, get, del }
}

/**
 * Hono middleware that gates a route behind x402 A2A payment.
 *
 * Flow:
 *  1. First call (no payment): respond with input-required + payment details.
 *  2. Second call (payment-submitted): verify → execute handler → settle → respond completed.
 *
 * Set `settleFirst` on the merchant config to settle before the handler runs,
 * which is what a handler with irreversible side effects needs.
 *
 * Usage:
 *   app.post('/task', merchantMiddleware(merchantConfig, facilitatorConfig), myHandler)
 */
export function merchantMiddleware(
  merchantConfig: MerchantConfig,
  facilitatorConfig: FacilitatorConfig,
): MiddlewareHandler {
  const pending = makePendingStore()

  return async (c: Context, next) => {
    // Only intercept if x402 extension is active
    const extensionsHeader = c.req.header('X-A2A-Extensions') ?? ''
    if (!extensionsHeader.includes(X402_EXTENSION_URI)) {
      return next()
    }

    let body: { id?: string; params?: { message?: A2AMessage; taskId?: string } }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    const taskId = body.params?.taskId ?? body.id ?? crypto.randomUUID()
    const message = body.params?.message

    // ── Step 2: payment submitted ─────────────────────────────────────────────
    if (message && getPaymentStatus(message) === PaymentStatus.SUBMITTED) {
      const payload = extractPayload(message)
      if (!payload) {
        return c.json(failedTask(taskId, ErrorCode.INVALID_SIGNATURE, 'Missing payment payload'))
      }

      const requirements = pending.get(taskId)
      if (!requirements) {
        return c.json(
          failedTask(taskId, ErrorCode.INVALID_SIGNATURE, 'No pending payment for this task'),
        )
      }

      // Verify
      const verifyResult = await verify(payload, requirements, { facilitator: facilitatorConfig })
      if (!verifyResult.valid) {
        const code = mapVerifyError(verifyResult.error ?? '')
        return c.json(failedTask(taskId, code, verifyResult.error ?? 'Verification failed', requirements.network))
      }

      // Mark payment verified in context so the downstream handler can check it
      c.set('x402Verified', true)
      c.set('x402TaskId', taskId)

      const settleFirst = merchantConfig.settleFirst === true

      let settleResult = settleFirst
        ? await settle(payload, requirements, { facilitator: facilitatorConfig })
        : undefined

      // When settling first, a payment that does not land must not reach the
      // handler at all: that is the whole point of the option.
      if (settleResult && !settleResult.settled) {
        return c.json(
          failedTask(taskId, ErrorCode.SETTLEMENT_FAILED, settleResult.error ?? 'Settlement failed', requirements.network),
        )
      }

      // Execute the actual handler
      await next()

      // Read the handler's output before anything replaces it. Hono ignores a
      // value returned from middleware once the handler has set c.res, so every
      // path below has to assign c.res instead of returning. Returning here is
      // what let the artifact reach the buyer even when settlement failed.
      const handlerResponse = c.res
      let resultData: unknown
      try {
        resultData = await handlerResponse.clone().json()
      } catch {
        resultData = null
      }

      if (!settleResult) {
        settleResult = await settle(payload, requirements, { facilitator: facilitatorConfig })
      }

      const receipt: X402Receipt = {
        success: settleResult.settled,
        transaction: settleResult.txHash,
        network: requirements.network,
        errorReason: settleResult.error,
      }

      if (!settleResult.settled) {
        // Keep the pending requirements: the buyer holds a valid authorization
        // and a transient settle failure must stay retryable for this task.
        c.res = c.json(
          failedTask(taskId, ErrorCode.SETTLEMENT_FAILED, settleResult.error ?? 'Settlement failed', requirements.network),
        )
        return
      }

      pending.del(taskId)

      const completedTask: A2ATask = {
        kind: 'task',
        id: taskId,
        status: {
          state: 'completed',
          message: {
            kind: 'message',
            role: 'agent',
            parts: resultData ? [{ kind: 'data', data: resultData as Record<string, unknown> }] : [{ kind: 'text', text: 'Payment successful.' }],
            metadata: {
              [META.STATUS]: PaymentStatus.COMPLETED,
              [META.RECEIPTS]: [receipt],
            },
          },
        },
      }
      c.res = c.json(completedTask)
      return
    }

    // ── Step 1: payment not yet submitted → return payment-required ───────────
    const paymentRequired = buildPaymentRequired(merchantConfig)
    pending.set(taskId, paymentRequired.accepts[0]!)
    return c.json(paymentRequiredTask(taskId, paymentRequired), 402)
  }
}

function mapVerifyError(error: string): string {
  const text = error.toLowerCase()
  if (text.includes('expired')) return ErrorCode.EXPIRED_PAYMENT
  if (text.includes('nonce')) return ErrorCode.DUPLICATE_NONCE
  if (text.includes('network')) return ErrorCode.NETWORK_MISMATCH
  if (text.includes('recipient')) return ErrorCode.INVALID_RECIPIENT
  if (text.includes('amount')) return ErrorCode.INVALID_AMOUNT
  return ErrorCode.INVALID_SIGNATURE
}

/** Class-based alternative for agents that need more control. */
export class MerchantAgent {
  private readonly pending = makePendingStore()

  constructor(
    private readonly merchantConfig: MerchantConfig,
    private readonly facilitatorConfig: FacilitatorConfig,
  ) {}

  /** Call this when a task arrives. Returns a payment-required task if unpaid. */
  requestPayment(taskId: string): A2ATask {
    const paymentRequired = buildPaymentRequired(this.merchantConfig)
    this.pending.set(taskId, paymentRequired.accepts[0]!)
    return paymentRequiredTask(taskId, paymentRequired)
  }

  /** Verify and settle a submitted payment. Returns receipt on success, error task on failure. */
  async processPayment(
    taskId: string,
    payload: PaymentPayload,
  ): Promise<{ ok: true; receipt: X402Receipt } | { ok: false; task: A2ATask }> {
    const requirements = this.pending.get(taskId)
    if (!requirements) {
      return {
        ok: false,
        task: failedTask(taskId, ErrorCode.INVALID_SIGNATURE, 'No pending payment for task'),
      }
    }

    const verifyResult = await verify(payload, requirements, { facilitator: this.facilitatorConfig })
    if (!verifyResult.valid) {
      return {
        ok: false,
        task: failedTask(taskId, mapVerifyError(verifyResult.error ?? ''), verifyResult.error ?? '', requirements.network),
      }
    }

    const settleResult = await settle(payload, requirements, { facilitator: this.facilitatorConfig })

    const receipt: X402Receipt = {
      success: settleResult.settled,
      transaction: settleResult.txHash,
      network: requirements.network,
      errorReason: settleResult.error,
    }

    if (!settleResult.settled) {
      // Leave the task pending so the buyer can resubmit the same authorization
      // after a transient settlement failure.
      return {
        ok: false,
        task: failedTask(taskId, ErrorCode.SETTLEMENT_FAILED, settleResult.error ?? '', requirements.network),
      }
    }

    this.pending.del(taskId)
    return { ok: true, receipt }
  }

  completedTask(taskId: string, receipt: X402Receipt, resultData?: unknown): A2ATask {
    return {
      kind: 'task',
      id: taskId,
      status: {
        state: 'completed',
        message: {
          kind: 'message',
          role: 'agent',
          parts: resultData
            ? [{ kind: 'data', data: resultData as Record<string, unknown> }]
            : [{ kind: 'text', text: 'Payment successful.' }],
          metadata: {
            [META.STATUS]: PaymentStatus.COMPLETED,
            [META.RECEIPTS]: [receipt],
          },
        },
      },
    }
  }
}
