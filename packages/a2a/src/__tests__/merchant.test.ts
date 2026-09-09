import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { merchantMiddleware, MerchantAgent } from '../merchant.js'
import { X402_EXTENSION_URI, PaymentStatus, ErrorCode, META } from '../types.js'
import type { MerchantConfig, A2ATask } from '../types.js'

const facilitator = await import('@agenti/facilitator')

const MERCHANT: MerchantConfig = {
  amount: '100000',
  payTo: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  network: 'eip155:8453',
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
}

const PAYLOAD = {
  x402Version: 2,
  scheme: 'exact',
  network: 'eip155:8453',
  payload: {
    signature: '0xdeadbeef' as `0x${string}`,
    authorization: {
      from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}`,
      to: MERCHANT.payTo,
      value: '100000',
      validAfter: '0',
      validBefore: '99999999999',
      nonce: `0x${'11'.repeat(32)}` as `0x${string}`,
    },
  },
}

function submittedBody(taskId: string) {
  return {
    id: taskId,
    params: {
      taskId,
      message: {
        kind: 'message',
        role: 'user',
        parts: [{ kind: 'data', data: PAYLOAD }],
        metadata: { [META.STATUS]: PaymentStatus.SUBMITTED, [META.PAYLOAD]: PAYLOAD },
      },
    },
  }
}

/** Builds an app whose handler records whether it ran. */
function buildApp(config: MerchantConfig) {
  const handler = vi.fn()
  const app = new Hono()
  app.post('/task', merchantMiddleware(config, {}), async (c) => {
    handler()
    return c.json({ artifact: 'the paid work' })
  })
  return { app, handler }
}

function post(app: Hono, body: unknown) {
  return app.request('/task', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-A2A-Extensions': X402_EXTENSION_URI,
    },
    body: JSON.stringify(body),
  })
}

describe('merchantMiddleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('answers an unpaid task with payment-required terms and never runs the handler', async () => {
    const { app, handler } = buildApp(MERCHANT)

    const res = await post(app, { id: 'task-1', params: {} })
    const task = (await res.json()) as A2ATask

    expect(res.status).toBe(402)
    expect(handler).not.toHaveBeenCalled()
    expect(task.status.state).toBe('input-required')
  })

  it('passes through entirely when the x402 extension is not activated', async () => {
    const { app, handler } = buildApp(MERCHANT)

    const res = await app.request('/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'task-1', params: {} }),
    })

    expect(res.status).toBe(200)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('rejects a payment for a task that was never quoted', async () => {
    const { app, handler } = buildApp(MERCHANT)

    const res = await post(app, submittedBody('never-quoted'))
    const task = (await res.json()) as A2ATask

    expect(handler).not.toHaveBeenCalled()
    expect(task.status.state).toBe('failed')
  })

  it('maps a network mismatch to NETWORK_MISMATCH rather than a signature error', async () => {
    vi.spyOn(facilitator, 'verifyPayment').mockResolvedValue({
      valid: false,
      error: 'Network mismatch: payment is on eip155:84532 but payment is required on eip155:8453',
    })
    const { app, handler } = buildApp(MERCHANT)

    await post(app, { id: 'task-2', params: {} })
    const res = await post(app, submittedBody('task-2'))
    const task = (await res.json()) as A2ATask

    expect(handler).not.toHaveBeenCalled()
    expect(task.status.message?.metadata?.[META.ERROR]).toBe(ErrorCode.NETWORK_MISMATCH)
  })

  it('runs the handler, settles, and completes the task', async () => {
    vi.spyOn(facilitator, 'verifyPayment').mockResolvedValue({ valid: true })
    vi.spyOn(facilitator, 'settlePayment').mockResolvedValue({ settled: true, txHash: '0xabc' })
    const { app, handler } = buildApp(MERCHANT)

    await post(app, { id: 'task-3', params: {} })
    const res = await post(app, submittedBody('task-3'))
    const task = (await res.json()) as A2ATask

    expect(handler).toHaveBeenCalledOnce()
    expect(task.status.state).toBe('completed')
  })

  it('withholds the artifact when settlement fails after the handler ran', async () => {
    vi.spyOn(facilitator, 'verifyPayment').mockResolvedValue({ valid: true })
    vi.spyOn(facilitator, 'settlePayment').mockResolvedValue({
      settled: false,
      error: 'insufficient funds',
    })
    const { app, handler } = buildApp(MERCHANT)

    await post(app, { id: 'task-4', params: {} })
    const res = await post(app, submittedBody('task-4'))
    const task = (await res.json()) as A2ATask

    expect(handler).toHaveBeenCalledOnce()
    expect(task.status.state).toBe('failed')
    expect(task.status.message?.metadata?.[META.ERROR]).toBe(ErrorCode.SETTLEMENT_FAILED)
    expect(JSON.stringify(task)).not.toContain('the paid work')
  })

  it('keeps the task payable so a transient settle failure can be retried', async () => {
    vi.spyOn(facilitator, 'verifyPayment').mockResolvedValue({ valid: true })
    const settle = vi
      .spyOn(facilitator, 'settlePayment')
      .mockResolvedValueOnce({ settled: false, error: 'RPC timeout' })
      .mockResolvedValueOnce({ settled: true, txHash: '0xabc' })
    const { app } = buildApp(MERCHANT)

    await post(app, { id: 'task-5', params: {} })
    const first = (await (await post(app, submittedBody('task-5'))).json()) as A2ATask
    const second = (await (await post(app, submittedBody('task-5'))).json()) as A2ATask

    expect(first.status.state).toBe('failed')
    expect(settle).toHaveBeenCalledTimes(2)
    expect(second.status.state).toBe('completed')
  })

  it('settleFirst skips the handler entirely when the payment does not settle', async () => {
    vi.spyOn(facilitator, 'verifyPayment').mockResolvedValue({ valid: true })
    vi.spyOn(facilitator, 'settlePayment').mockResolvedValue({
      settled: false,
      error: 'insufficient funds',
    })
    const { app, handler } = buildApp({ ...MERCHANT, settleFirst: true })

    await post(app, { id: 'task-6', params: {} })
    const res = await post(app, submittedBody('task-6'))
    const task = (await res.json()) as A2ATask

    expect(handler).not.toHaveBeenCalled()
    expect(task.status.state).toBe('failed')
  })

  it('settleFirst settles once and still completes on success', async () => {
    vi.spyOn(facilitator, 'verifyPayment').mockResolvedValue({ valid: true })
    const settle = vi
      .spyOn(facilitator, 'settlePayment')
      .mockResolvedValue({ settled: true, txHash: '0xabc' })
    const { app, handler } = buildApp({ ...MERCHANT, settleFirst: true })

    await post(app, { id: 'task-7', params: {} })
    const res = await post(app, submittedBody('task-7'))
    const task = (await res.json()) as A2ATask

    expect(handler).toHaveBeenCalledOnce()
    expect(settle).toHaveBeenCalledTimes(1)
    expect(task.status.state).toBe('completed')
  })
})

describe('MerchantAgent', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('leaves the task pending when settlement fails, so it can be retried', async () => {
    vi.spyOn(facilitator, 'verifyPayment').mockResolvedValue({ valid: true })
    vi.spyOn(facilitator, 'settlePayment')
      .mockResolvedValueOnce({ settled: false, error: 'RPC timeout' })
      .mockResolvedValueOnce({ settled: true, txHash: '0xabc' })

    const agent = new MerchantAgent(MERCHANT, {})
    agent.requestPayment('task-a')

    const first = await agent.processPayment('task-a', PAYLOAD)
    expect(first.ok).toBe(false)

    const second = await agent.processPayment('task-a', PAYLOAD)
    expect(second.ok).toBe(true)
  })

  it('does not accept a payment for a task it never quoted', async () => {
    const agent = new MerchantAgent(MERCHANT, {})
    const result = await agent.processPayment('unknown', PAYLOAD)
    expect(result.ok).toBe(false)
  })
})
