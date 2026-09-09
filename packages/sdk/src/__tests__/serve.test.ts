import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withPaymentExpress, withPaymentHono, withPayment } from '../serve.js'

const CONFIG = {
  amount: '100000',
  address: '0x1111111111111111111111111111111111111111',
  facilitatorUrl: 'https://facilitator.test',
}

const PAYLOAD = { x402Version: 2, scheme: 'exact', payload: { signature: '0xdeadbeef' } }
const HEADER = Buffer.from(JSON.stringify(PAYLOAD), 'utf-8').toString('base64')

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Routes /verify and /settle to canned replies and records which endpoints the
 * gate actually called, in order.
 */
function mockFacilitator(replies: { verify?: unknown; settle?: unknown; settleStatus?: number }) {
  const calls: string[] = []
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const href = String(url)
    if (href.endsWith('/verify')) {
      calls.push('verify')
      return jsonResponse(replies.verify ?? { isValid: true })
    }
    if (href.endsWith('/settle')) {
      calls.push('settle')
      return jsonResponse(replies.settle ?? { success: true, transaction: '0xabc' }, replies.settleStatus ?? 200)
    }
    throw new Error(`unexpected fetch: ${href}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

function expressRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(body: unknown) {
      res.body = body
    },
    setHeader(name: string, value: string) {
      res.headers[name] = value
    },
  }
  return res
}

describe('withPaymentExpress', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns 402 with payment requirements when no payment header is present', async () => {
    const handler = vi.fn()
    const gated = withPaymentExpress(handler, CONFIG)
    const res = expressRes()

    await gated({ url: '/api/secret', method: 'GET', headers: {} }, res, () => {})

    expect(res.statusCode).toBe(402)
    expect(handler).not.toHaveBeenCalled()
    expect((res.body as { accepts: unknown[] }).accepts).toHaveLength(1)
  })

  it('settles the payment before running the handler', async () => {
    const calls = mockFacilitator({})
    const handler = vi.fn()
    const gated = withPaymentExpress(handler, CONFIG)
    const res = expressRes()

    await gated(
      { url: '/api/secret', method: 'GET', headers: { 'payment-signature': HEADER } },
      res,
      () => {},
    )

    expect(calls).toEqual(['verify', 'settle'])
    expect(handler).toHaveBeenCalledOnce()
  })

  it('echoes the settle receipt on X-PAYMENT-RESPONSE', async () => {
    mockFacilitator({ settle: { success: true, transaction: '0xfeed', network: 'eip155:8453' } })
    const gated = withPaymentExpress(vi.fn(), CONFIG)
    const res = expressRes()

    await gated(
      { url: '/api/secret', method: 'GET', headers: { 'payment-signature': HEADER } },
      res,
      () => {},
    )

    const receipt = JSON.parse(
      Buffer.from(res.headers['X-PAYMENT-RESPONSE'] as string, 'base64').toString('utf-8'),
    )
    expect(receipt).toMatchObject({ success: true, transaction: '0xfeed' })
  })

  it('does NOT run the handler when settlement fails after a valid verify', async () => {
    const calls = mockFacilitator({
      verify: { isValid: true },
      settle: { success: false, errorReason: 'insufficient_funds' },
      settleStatus: 400,
    })
    const handler = vi.fn()
    const gated = withPaymentExpress(handler, CONFIG)
    const res = expressRes()

    await gated(
      { url: '/api/secret', method: 'GET', headers: { 'payment-signature': HEADER } },
      res,
      () => {},
    )

    expect(calls).toEqual(['verify', 'settle'])
    expect(handler).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(402)
    expect(res.body).toMatchObject({ error: 'Payment settlement failed' })
  })

  it('normalizes the bundled facilitator { settled, txHash } shape', async () => {
    mockFacilitator({ settle: { settled: true, txHash: '0xbeef' } })
    const handler = vi.fn()
    const gated = withPaymentExpress(handler, CONFIG)
    const res = expressRes()

    await gated(
      { url: '/api/secret', method: 'GET', headers: { 'payment-signature': HEADER } },
      res,
      () => {},
    )

    expect(handler).toHaveBeenCalledOnce()
    const receipt = JSON.parse(
      Buffer.from(res.headers['X-PAYMENT-RESPONSE'] as string, 'base64').toString('utf-8'),
    )
    expect(receipt.transaction).toBe('0xbeef')
  })

  it('does not run the handler when verification fails', async () => {
    const calls = mockFacilitator({ verify: { isValid: false, invalidReason: 'bad_signature' } })
    const handler = vi.fn()
    const gated = withPaymentExpress(handler, CONFIG)
    const res = expressRes()

    await gated(
      { url: '/api/secret', method: 'GET', headers: { 'payment-signature': HEADER } },
      res,
      () => {},
    )

    expect(calls).toEqual(['verify'])
    expect(handler).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(402)
  })

  it('skips settlement only when the endpoint opts into mode: verify', async () => {
    const calls = mockFacilitator({})
    const handler = vi.fn()
    const gated = withPaymentExpress(handler, { ...CONFIG, mode: 'verify' })
    const res = expressRes()

    await gated(
      { url: '/api/secret', method: 'GET', headers: { 'payment-signature': HEADER } },
      res,
      () => {},
    )

    expect(calls).toEqual(['verify'])
    expect(handler).toHaveBeenCalledOnce()
    expect(res.headers['X-PAYMENT-RESPONSE']).toBeUndefined()
  })

  it('answers 502 without running the handler when the facilitator is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      }),
    )
    const handler = vi.fn()
    const gated = withPaymentExpress(handler, CONFIG)
    const res = expressRes()

    await gated(
      { url: '/api/secret', method: 'GET', headers: { 'payment-signature': HEADER } },
      res,
      () => {},
    )

    expect(handler).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(502)
  })
})

describe('withPaymentHono', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function honoContext(header?: string) {
    const headers: Record<string, string> = {}
    return {
      headers,
      req: {
        url: 'https://example.test/api/secret',
        method: 'GET',
        path: '/api/secret',
        header: (name: string) => (name === 'payment-signature' ? header : undefined),
      },
      json: (body: unknown, status = 200) => jsonResponse(body, status),
      header: (name: string, value: string) => {
        headers[name] = value
      },
    }
  }

  it('does not run the handler when settlement fails', async () => {
    mockFacilitator({ settle: { success: false, errorReason: 'nonce_used' }, settleStatus: 400 })
    const handler = vi.fn(async () => jsonResponse({ secret: 42 }))
    const gated = withPaymentHono(handler, CONFIG)

    const response = (await gated(honoContext(HEADER), async () => {})) as Response

    expect(handler).not.toHaveBeenCalled()
    expect(response.status).toBe(402)
  })

  it('settles, sets the receipt header, then runs the handler', async () => {
    const calls = mockFacilitator({})
    const handler = vi.fn(async () => jsonResponse({ secret: 42 }))
    const gated = withPaymentHono(handler, CONFIG)
    const c = honoContext(HEADER)

    await gated(c, async () => {})

    expect(calls).toEqual(['verify', 'settle'])
    expect(handler).toHaveBeenCalledOnce()
    expect(c.headers['X-PAYMENT-RESPONSE']).toBeTruthy()
  })
})

describe('withPayment (Next.js App Router)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function nextReq(header?: string) {
    return {
      url: 'https://example.test/api/secret',
      method: 'GET',
      headers: { get: (name: string) => (name === 'payment-signature' ? (header ?? null) : null) },
    }
  }

  it('does not run the handler when settlement fails', async () => {
    mockFacilitator({ settle: { success: false, errorReason: 'nonce_used' }, settleStatus: 400 })
    const handler = vi.fn(async () => jsonResponse({ secret: 42 }))
    const gated = withPayment(handler as never, CONFIG)

    const response = (await gated(nextReq(HEADER))) as unknown as Response

    expect(handler).not.toHaveBeenCalled()
    expect(response.status).toBe(402)
    await expect(response.json()).resolves.toMatchObject({ error: 'Payment settlement failed' })
  })

  it('runs the handler after settlement and attaches the receipt header', async () => {
    const calls = mockFacilitator({})
    const handler = vi.fn(async () => jsonResponse({ secret: 42 }))
    const gated = withPayment(handler as never, CONFIG)

    const response = (await gated(nextReq(HEADER))) as unknown as Response

    expect(calls).toEqual(['verify', 'settle'])
    expect(handler).toHaveBeenCalledOnce()
    expect(response.headers.get('X-PAYMENT-RESPONSE')).toBeTruthy()
  })
})
