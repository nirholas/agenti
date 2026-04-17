import {
  PaymentStatus,
  META,
  X402_EXTENSION_URI,
  type ClientConfig,
  type A2ATask,
  type A2AMessage,
  type X402PaymentRequired,
  type PaymentRequired,
} from './types.js'

export class PaymentRejectedError extends Error {
  constructor(
    public readonly taskId: string,
    public readonly requirements: PaymentRequired[],
  ) {
    super(`Payment rejected for task ${taskId}`)
    this.name = 'PaymentRejectedError'
  }
}

export class PaymentFailedError extends Error {
  constructor(
    public readonly taskId: string,
    public readonly errorCode: string,
    reason: string,
  ) {
    super(reason)
    this.name = 'PaymentFailedError'
  }
}

function getStatus(task: A2ATask): string | null {
  return (task.status.message?.metadata?.[META.STATUS] as string | undefined) ?? null
}

function extractPaymentRequired(task: A2ATask): X402PaymentRequired | null {
  const meta = task.status.message?.metadata
  if (!meta) return null
  const raw = meta[META.REQUIRED]
  if (!raw || typeof raw !== 'object') return null
  return raw as X402PaymentRequired
}

/**
 * A2A x402 client — wraps fetch to handle the payment-required flow automatically.
 *
 * Usage:
 *   const client = new A2AClient({ signer: myWallet.signPayment })
 *   const result = await client.send('https://merchant-agent.com/task', message)
 */
export class A2AClient {
  constructor(private readonly config: ClientConfig) {}

  /**
   * Send a message to a merchant agent, automatically handling payment if required.
   *
   * @param url - Merchant agent URL
   * @param message - The A2A message to send
   * @param taskId - Optional task ID for continuation
   * @returns The completed A2ATask
   */
  async send(url: string, message: A2AMessage, taskId?: string): Promise<A2ATask> {
    const body = {
      jsonrpc: '2.0',
      method: 'message/send',
      id: taskId ?? crypto.randomUUID(),
      params: { message, ...(taskId ? { taskId } : {}) },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-A2A-Extensions': X402_EXTENSION_URI,
      },
      body: JSON.stringify(body),
    })

    const task = (await response.json()) as A2ATask
    const status = getStatus(task)

    // Handle payment-required (HTTP 402 or status field)
    if (response.status === 402 || status === PaymentStatus.REQUIRED) {
      return this._handlePaymentRequired(url, task)
    }

    if (status === PaymentStatus.FAILED) {
      const errorCode = (task.status.message?.metadata?.[META.ERROR] as string | undefined) ?? 'UNKNOWN'
      const reason = task.status.message?.parts[0]?.kind === 'text'
        ? task.status.message.parts[0].text
        : 'Payment failed'
      throw new PaymentFailedError(task.id, errorCode, reason)
    }

    return task
  }

  private async _handlePaymentRequired(url: string, task: A2ATask): Promise<A2ATask> {
    const paymentRequired = extractPaymentRequired(task)
    if (!paymentRequired?.accepts.length) {
      throw new Error(`Merchant agent returned payment-required but no payment details`)
    }

    if (this.config.autoPay === false) {
      throw new PaymentRejectedError(task.id, paymentRequired.accepts)
    }

    // Sign using the first accepted requirement
    const requirement = paymentRequired.accepts[0]!
    const payload = await this.config.signer(requirement)

    // Submit payment
    const paymentMessage: A2AMessage = {
      kind: 'message',
      role: 'user',
      parts: [{ kind: 'text', text: 'Here is the payment authorization.' }],
      metadata: {
        [META.STATUS]: PaymentStatus.SUBMITTED,
        [META.PAYLOAD]: payload,
      },
      taskId: task.id,
    }

    const body = {
      jsonrpc: '2.0',
      method: 'message/send',
      id: task.id,
      params: { message: paymentMessage, taskId: task.id },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-A2A-Extensions': X402_EXTENSION_URI,
      },
      body: JSON.stringify(body),
    })

    const result = (await response.json()) as A2ATask
    const status = getStatus(result)

    if (status === PaymentStatus.FAILED) {
      const errorCode = (result.status.message?.metadata?.[META.ERROR] as string | undefined) ?? 'UNKNOWN'
      const reason = result.status.message?.parts[0]?.kind === 'text'
        ? result.status.message.parts[0].text
        : 'Payment failed'
      throw new PaymentFailedError(result.id, errorCode, reason)
    }

    return result
  }
}

/**
 * Standalone helper — makes a single paid A2A request without needing to instantiate a client.
 */
export async function sendWithPayment(
  url: string,
  message: A2AMessage,
  config: ClientConfig,
  taskId?: string,
): Promise<A2ATask> {
  return new A2AClient(config).send(url, message, taskId)
}
