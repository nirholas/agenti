import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { BinanceClient, createClient } from '../client.js'

const API_KEY = 'test-api-key'
const SECRET = 'test-secret'

function mockOk(body: unknown = { ok: true }) {
  // Declaring the parameters keeps mock.calls typed, so the assertions below
  // can read the url and init the client actually sent.
  const fetchMock = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Recomputes the signature Binance would check, from the query the client sent. */
function expectedSignature(query: string): string {
  return createHmac('sha256', SECRET).update(query).digest('hex')
}

describe('BinanceClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends public requests with no credentials and no signature', async () => {
    const fetchMock = mockOk({ price: '65000' })
    const client = new BinanceClient()

    await client.get('/api/v3/ticker/price', { symbol: 'BTCUSDT' })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT')
    expect(String(url)).not.toContain('signature')
    expect((init?.headers as Record<string, string> | undefined)?.['X-MBX-APIKEY']).toBeUndefined()
  })

  it('refuses a signed request when credentials are missing', async () => {
    const client = new BinanceClient()
    await expect(client.signedGet('/api/v3/account')).rejects.toThrow(
      /BINANCE_API_KEY and BINANCE_SECRET_KEY are required/,
    )
  })

  it('signs a GET over the exact query it sends, and appends the signature', async () => {
    const fetchMock = mockOk()
    const client = new BinanceClient(API_KEY, SECRET)

    await client.signedGet('/api/v3/account', { recvWindow: '5000' })

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    const signature = url.searchParams.get('signature')
    expect(signature).toBeTruthy()

    // Everything before &signature= is what was signed.
    const signed = url.search.slice(1, url.search.indexOf('&signature='))
    expect(signature).toBe(expectedSignature(signed))
    expect(url.searchParams.get('recvWindow')).toBe('5000')
    expect(url.searchParams.get('timestamp')).toBeTruthy()
  })

  it('sends the API key header on signed requests', async () => {
    const fetchMock = mockOk()
    const client = new BinanceClient(API_KEY, SECRET)

    await client.signedGet('/api/v3/account')

    const init = fetchMock.mock.calls[0]?.[1]
    expect((init?.headers as Record<string, string>)['X-MBX-APIKEY']).toBe(API_KEY)
  })

  it('puts a signed POST in the form body, not the query string', async () => {
    const fetchMock = mockOk()
    const client = new BinanceClient(API_KEY, SECRET)

    await client.signedPost('/api/v3/order', { symbol: 'BTCUSDT', side: 'BUY' })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('https://api.binance.com/api/v3/order')
    expect(String(url)).not.toContain('signature')

    const body = String(init?.body)
    expect(body).toContain('symbol=BTCUSDT')
    expect(body).toContain('signature=')
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    )

    const signed = body.slice(0, body.indexOf('&signature='))
    expect(body).toContain(expectedSignature(signed))
  })

  it('sends a signed DELETE in the query string', async () => {
    const fetchMock = mockOk()
    const client = new BinanceClient(API_KEY, SECRET)

    await client.signedDelete('/api/v3/order', { symbol: 'BTCUSDT', orderId: '7' })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toContain('signature=')
    expect(init?.body).toBeUndefined()
  })

  it('surfaces the status and body of a Binance error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"code":-2010,"msg":"Insufficient balance"}', { status: 400 })),
    )
    const client = new BinanceClient(API_KEY, SECRET)

    await expect(client.signedPost('/api/v3/order')).rejects.toThrow(
      /Binance API error 400.*Insufficient balance/,
    )
  })

  it('targets binance.us when asked', async () => {
    const fetchMock = mockOk()
    await new BinanceClient(undefined, undefined, true).get('/api/v3/ping')
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.binance.us/api/v3/ping')
  })
})

describe('createClient', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
    vi.unstubAllGlobals()
  })

  it('reads credentials and the US flag from the environment', async () => {
    process.env['BINANCE_API_KEY'] = API_KEY
    process.env['BINANCE_SECRET_KEY'] = SECRET
    process.env['BINANCE_US'] = 'true'

    const fetchMock = mockOk()
    await createClient().signedGet('/api/v3/account')

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toContain('https://api.binance.us')
    expect((init?.headers as Record<string, string>)['X-MBX-APIKEY']).toBe(API_KEY)
  })
})
