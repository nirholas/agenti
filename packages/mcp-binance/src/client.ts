import { createHmac } from 'node:crypto'

export class BinanceClient {
  private baseUrl: string

  constructor(
    private apiKey?: string,
    private secret?: string,
    us = false,
  ) {
    this.baseUrl = us ? 'https://api.binance.us' : 'https://api.binance.com'
  }

  async get(path: string, params: Record<string, string> = {}): Promise<unknown> {
    const qs = new URLSearchParams(params).toString()
    const url = `${this.baseUrl}${path}${qs ? `?${qs}` : ''}`
    const headers: Record<string, string> = {}
    if (this.apiKey) headers['X-MBX-APIKEY'] = this.apiKey

    const res = await fetch(url, { headers })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Binance API error ${res.status}: ${body}`)
    }
    return res.json()
  }

  async signedGet(path: string, params: Record<string, string> = {}): Promise<unknown> {
    return this.signed('GET', path, params)
  }

  async signedPost(path: string, params: Record<string, string> = {}): Promise<unknown> {
    return this.signed('POST', path, params)
  }

  async signedDelete(path: string, params: Record<string, string> = {}): Promise<unknown> {
    return this.signed('DELETE', path, params)
  }

  private async signed(
    method: string,
    path: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    if (!this.apiKey || !this.secret) {
      throw new Error('BINANCE_API_KEY and BINANCE_SECRET_KEY are required for this operation')
    }
    const timestamp = Date.now().toString()
    const allParams = { ...params, timestamp }
    const qs = new URLSearchParams(allParams).toString()
    const signature = createHmac('sha256', this.secret).update(qs).digest('hex')
    const fullQs = `${qs}&signature=${signature}`

    const url =
      method === 'GET' || method === 'DELETE'
        ? `${this.baseUrl}${path}?${fullQs}`
        : `${this.baseUrl}${path}`

    const body = method === 'POST' ? fullQs : undefined

    const fetchInit: RequestInit = {
      method,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
    }
    if (body) fetchInit.body = body

    const res = await fetch(url, fetchInit)

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`Binance API error ${res.status}: ${errBody}`)
    }
    return res.json()
  }
}

export function createClient(): BinanceClient {
  return new BinanceClient(
    process.env['BINANCE_API_KEY'],
    process.env['BINANCE_SECRET_KEY'],
    process.env['BINANCE_US'] === 'true',
  )
}
