import { privateKeyToAccount } from 'viem/accounts'
import { createHmac } from 'node:crypto'

// ---------------------------------------------------------------------------
// API endpoints
// ---------------------------------------------------------------------------

const GAMMA_API = 'https://gamma-api.polymarket.com'
const CLOB_API = 'https://clob.polymarket.com'

// ---------------------------------------------------------------------------
// Contract addresses on Polygon (chain 137)
// ---------------------------------------------------------------------------

const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as const
const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a' as const
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PolymarketToken {
  tokenId: string
  outcome: string
  price: number
  winner: boolean
}

export interface PolymarketMarket {
  conditionId: string
  questionId: string
  question: string
  description: string
  category: string
  endDateIso: string
  active: boolean
  closed: boolean
  archived: boolean
  negRisk: boolean
  negRiskMarketId?: string
  volume?: number
  volume24hr?: number
  liquidity?: number
  lastTradePrice?: number
  bestBid?: number
  bestAsk?: number
  spread?: number
  tokens: PolymarketToken[]
  tags: string[]
  url: string
}

export interface PolymarketOrderBook {
  market: string
  assetId: string
  bids: { price: string; size: string }[]
  asks: { price: string; size: string }[]
  timestamp: number
  hash: string
}

export interface PolymarketPriceResult {
  tokenId: string
  side: 'BUY' | 'SELL'
  price: number
}

export interface PolymarketMidpoint {
  tokenId: string
  mid: number
}

export interface PolymarketSpread {
  tokenId: string
  bid: number
  ask: number
  spread: number
}

export interface PolymarketLastTrade {
  tokenId: string
  price: number
}

export interface PolymarketOpenOrder {
  id: string
  asset_id: string
  market: string
  side: 'BUY' | 'SELL'
  original_size: string
  size_matched: string
  price: string
  status: string
  type: string
  created_at: number
  expiration?: string
}

export interface PolymarketTrade {
  id: string
  tradeId: string
  orderId: string
  maker: string
  taker: string
  asset: string
  side: 'BUY' | 'SELL'
  size: string
  price: string
  status: string
  matchTime: string
  type: string
}

export interface PolymarketCredentials {
  apiKey: string
  secret: string
  passphrase: string
}

export interface PlaceOrderParams {
  tokenId: string
  price: number
  size: number
  side: 'BUY' | 'SELL'
  orderType?: 'GTC' | 'FOK' | 'GTD'
  expiration?: number
  negRisk?: boolean
  feeRateBps?: number
}

export interface PlaceOrderResult {
  orderId: string
  status: string
  transactionsHashes?: string[]
  errorMsg?: string
}

export interface PolymarketInstance {
  address: `0x${string}`
  getCredentials(): Promise<PolymarketCredentials>
  getOpenOrders(market?: string): Promise<PolymarketOpenOrder[]>
  getTrades(market?: string, limit?: number): Promise<PolymarketTrade[]>
  placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult>
  cancelOrder(orderId: string): Promise<{ deleted: boolean }>
  cancelAllOrders(): Promise<{ deleted: boolean }>
}

export interface PolymarketConfig {
  privateKey: `0x${string}`
  credentials?: PolymarketCredentials
}

export interface GetMarketsParams {
  query?: string
  category?: string
  active?: boolean
  closed?: boolean
  limit?: number
  offset?: number
  endDateMin?: string
  endDateMax?: string
  sortBy?: 'volume' | 'liquidity' | 'end_date_asc' | 'end_date_desc'
}

// ---------------------------------------------------------------------------
// EIP-712 typed data definitions
// ---------------------------------------------------------------------------

const CLOB_AUTH_TYPES = {
  ClobAuth: [
    { name: 'address', type: 'string' },
    { name: 'timestamp', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'message', type: 'string' },
  ],
} as const

const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
} as const

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function l2Headers(
  address: `0x${string}`,
  creds: PolymarketCredentials,
  method: string,
  path: string,
  body = '',
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const msg = timestamp + method.toUpperCase() + path + body
  const sig = createHmac('sha256', creds.secret).update(msg).digest('base64')
  return {
    'POLY_ADDRESS': address,
    'POLY_SIGNATURE': sig,
    'POLY_TIMESTAMP': timestamp,
    'POLY_NONCE': '0',
    'POLY_API-KEY': creds.apiKey,
    'POLY_PASSPHRASE': creds.passphrase,
    'Content-Type': 'application/json',
  }
}

async function clobGet<T>(path: string, address: `0x${string}`, creds: PolymarketCredentials): Promise<T> {
  const headers = l2Headers(address, creds, 'GET', path)
  const res = await fetch(`${CLOB_API}${path}`, { headers })
  if (!res.ok) throw new Error(`Polymarket CLOB GET ${path} → ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

async function clobPost<T>(path: string, body: unknown, address: `0x${string}`, creds: PolymarketCredentials): Promise<T> {
  const bodyStr = JSON.stringify(body)
  const headers = l2Headers(address, creds, 'POST', path, bodyStr)
  const res = await fetch(`${CLOB_API}${path}`, { method: 'POST', headers, body: bodyStr })
  if (!res.ok) throw new Error(`Polymarket CLOB POST ${path} → ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

async function clobDelete<T>(path: string, address: `0x${string}`, creds: PolymarketCredentials): Promise<T> {
  const headers = l2Headers(address, creds, 'DELETE', path)
  const res = await fetch(`${CLOB_API}${path}`, { method: 'DELETE', headers })
  if (!res.ok) throw new Error(`Polymarket CLOB DELETE ${path} → ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

function normalizeMarket(raw: Record<string, unknown>): PolymarketMarket {
  const rawTokens = (raw['tokens'] as Record<string, unknown>[] | undefined) ?? []
  const tokens: PolymarketToken[] = rawTokens.map((t) => ({
    tokenId: String(t['token_id'] ?? t['tokenId'] ?? ''),
    outcome: String(t['outcome'] ?? ''),
    price: Number(t['price'] ?? 0),
    winner: Boolean(t['winner'] ?? false),
  }))

  const condId = String(raw['condition_id'] ?? raw['conditionId'] ?? '')
  return {
    conditionId: condId,
    questionId: String(raw['question_id'] ?? raw['questionId'] ?? ''),
    question: String(raw['question'] ?? ''),
    description: String(raw['description'] ?? ''),
    category: String(raw['category'] ?? ''),
    endDateIso: String(raw['end_date_iso'] ?? raw['endDateIso'] ?? ''),
    active: Boolean(raw['active'] ?? true),
    closed: Boolean(raw['closed'] ?? false),
    archived: Boolean(raw['archived'] ?? false),
    negRisk: Boolean(raw['neg_risk'] ?? raw['negRisk'] ?? false),
    ...(raw['neg_risk_market_id'] ? { negRiskMarketId: String(raw['neg_risk_market_id']) } : {}),
    volume: raw['volume'] != null ? Number(raw['volume']) : undefined,
    volume24hr: raw['volume_24hr'] != null ? Number(raw['volume_24hr']) : undefined,
    liquidity: raw['liquidity'] != null ? Number(raw['liquidity']) : undefined,
    lastTradePrice: raw['last_trade_price'] != null ? Number(raw['last_trade_price']) : undefined,
    bestBid: raw['best_bid'] != null ? Number(raw['best_bid']) : undefined,
    bestAsk: raw['best_ask'] != null ? Number(raw['best_ask']) : undefined,
    spread: raw['spread'] != null ? Number(raw['spread']) : undefined,
    tokens,
    tags: (raw['tags'] as string[] | undefined) ?? [],
    url: `https://polymarket.com/event/${condId}`,
  }
}

// ---------------------------------------------------------------------------
// Read-only public functions (no auth)
// ---------------------------------------------------------------------------

export async function getPolymarketMarkets(params?: GetMarketsParams): Promise<PolymarketMarket[]> {
  const p = new URLSearchParams()
  if (params?.query) p.set('_c', params.query)
  if (params?.category) p.set('category', params.category)
  if (params?.active != null) p.set('active', String(params.active))
  if (params?.closed != null) p.set('closed', String(params.closed))
  if (params?.limit) p.set('limit', String(params.limit))
  if (params?.offset) p.set('offset', String(params.offset))
  if (params?.endDateMin) p.set('end_date_min', params.endDateMin)
  if (params?.endDateMax) p.set('end_date_max', params.endDateMax)

  const qs = p.toString()
  const url = `${GAMMA_API}/markets${qs ? `?${qs}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Polymarket Gamma markets → ${res.status}`)
  const raw = await res.json() as Record<string, unknown>[]
  return raw.map(normalizeMarket)
}

export async function getPolymarketMarket(conditionId: string): Promise<PolymarketMarket> {
  const res = await fetch(`${GAMMA_API}/markets/${conditionId}`)
  if (!res.ok) throw new Error(`Polymarket Gamma market ${conditionId} → ${res.status}`)
  const raw = await res.json() as Record<string, unknown>
  return normalizeMarket(raw)
}

export async function getPolymarketOrderBook(tokenId: string): Promise<PolymarketOrderBook> {
  const res = await fetch(`${CLOB_API}/book?token_id=${tokenId}`)
  if (!res.ok) throw new Error(`Polymarket CLOB book ${tokenId} → ${res.status}`)
  const raw = await res.json() as {
    market: string
    asset_id: string
    bids: { price: string; size: string }[]
    asks: { price: string; size: string }[]
    timestamp: number
    hash: string
  }
  return {
    market: raw.market,
    assetId: raw.asset_id,
    bids: raw.bids,
    asks: raw.asks,
    timestamp: raw.timestamp,
    hash: raw.hash,
  }
}

export async function getPolymarketPrice(tokenId: string, side: 'BUY' | 'SELL'): Promise<PolymarketPriceResult> {
  const res = await fetch(`${CLOB_API}/price?token_id=${tokenId}&side=${side}`)
  if (!res.ok) throw new Error(`Polymarket CLOB price → ${res.status}`)
  const raw = await res.json() as { price: string }
  return { tokenId, side, price: Number(raw.price) }
}

export async function getPolymarketMidpoint(tokenId: string): Promise<PolymarketMidpoint> {
  const res = await fetch(`${CLOB_API}/midpoint?token_id=${tokenId}`)
  if (!res.ok) throw new Error(`Polymarket CLOB midpoint → ${res.status}`)
  const raw = await res.json() as { mid: string }
  return { tokenId, mid: Number(raw.mid) }
}

export async function getPolymarketSpread(tokenId: string): Promise<PolymarketSpread> {
  const res = await fetch(`${CLOB_API}/spread?token_id=${tokenId}`)
  if (!res.ok) throw new Error(`Polymarket CLOB spread → ${res.status}`)
  const raw = await res.json() as { spread: string }
  // Derive bid/ask from midpoint and spread
  const spreadVal = Number(raw.spread)
  const mid = await getPolymarketMidpoint(tokenId)
  const bid = Number((mid.mid - spreadVal / 2).toFixed(4))
  const ask = Number((mid.mid + spreadVal / 2).toFixed(4))
  return { tokenId, bid, ask, spread: spreadVal }
}

export async function getPolymarketLastTradePrice(tokenId: string): Promise<PolymarketLastTrade> {
  const res = await fetch(`${CLOB_API}/last-trade-price?token_id=${tokenId}`)
  if (!res.ok) throw new Error(`Polymarket CLOB last-trade-price → ${res.status}`)
  const raw = await res.json() as { price: string }
  return { tokenId, price: Number(raw.price) }
}

// ---------------------------------------------------------------------------
// Authenticated instance factory
// ---------------------------------------------------------------------------

export function polymarket(config: PolymarketConfig): PolymarketInstance {
  const account = privateKeyToAccount(config.privateKey)
  const address = account.address
  let _creds: PolymarketCredentials | undefined = config.credentials

  async function getCredentials(): Promise<PolymarketCredentials> {
    if (_creds) return _creds

    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = 0

    const signature = await account.signTypedData({
      domain: { name: 'ClobAuthDomain', version: '1' },
      types: CLOB_AUTH_TYPES,
      primaryType: 'ClobAuth',
      message: {
        address,
        timestamp,
        nonce,
        message: 'This message attests that I control the given wallet',
      },
    })

    const res = await fetch(`${CLOB_API}/auth/api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'POLY_ADDRESS': address,
        'POLY_SIGNATURE': signature,
        'POLY_TIMESTAMP': timestamp,
        'POLY_NONCE': String(nonce),
      },
    })

    if (!res.ok) throw new Error(`Polymarket L1 auth → ${res.status}: ${await res.text()}`)
    const data = await res.json() as { apiKey: string; secret: string; passphrase: string }
    _creds = { apiKey: data.apiKey, secret: data.secret, passphrase: data.passphrase }
    return _creds
  }

  async function getOpenOrders(market?: string): Promise<PolymarketOpenOrder[]> {
    const creds = await getCredentials()
    const path = market ? `/orders?market=${market}` : '/orders'
    const raw = await clobGet<PolymarketOpenOrder[]>(path, address, creds)
    return raw
  }

  async function getTrades(market?: string, limit = 100): Promise<PolymarketTrade[]> {
    const creds = await getCredentials()
    const p = new URLSearchParams({ limit: String(limit) })
    if (market) p.set('market', market)
    const path = `/trades?${p.toString()}`
    const raw = await clobGet<PolymarketTrade[]>(path, address, creds)
    return raw
  }

  async function placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult> {
    const creds = await getCredentials()
    const { tokenId, price, size, side, orderType = 'GTC', expiration = 0, negRisk = false, feeRateBps = 0 } = params

    // Amount math — USDC and conditional tokens both use 6 decimals
    const DECIMALS = 1_000_000
    const roundAmount = (n: number) => BigInt(Math.round(n))

    let makerAmount: bigint
    let takerAmount: bigint

    if (side === 'BUY') {
      makerAmount = roundAmount(size * price * DECIMALS)
      takerAmount = roundAmount(size * DECIMALS)
    } else {
      makerAmount = roundAmount(size * DECIMALS)
      takerAmount = roundAmount(size * price * DECIMALS)
    }

    const salt = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
    const sideInt = side === 'BUY' ? 0 : 1
    const verifyingContract = negRisk ? NEG_RISK_CTF_EXCHANGE : CTF_EXCHANGE

    const orderMessage = {
      salt,
      maker: address,
      signer: address,
      taker: ZERO_ADDRESS as `0x${string}`,
      tokenId: BigInt(tokenId),
      makerAmount,
      takerAmount,
      expiration: BigInt(expiration),
      nonce: BigInt(0),
      feeRateBps: BigInt(feeRateBps),
      side: sideInt,
      signatureType: 0,
    }

    const signature = await account.signTypedData({
      domain: {
        name: 'Polymarket CTF Exchange',
        version: '1',
        chainId: 137,
        verifyingContract,
      },
      types: ORDER_TYPES,
      primaryType: 'Order',
      message: orderMessage,
    })

    const body = {
      order: {
        salt: salt.toString(),
        maker: address,
        signer: address,
        taker: ZERO_ADDRESS,
        tokenId,
        makerAmount: makerAmount.toString(),
        takerAmount: takerAmount.toString(),
        expiration: String(expiration),
        nonce: '0',
        feeRateBps: String(feeRateBps),
        side: String(sideInt),
        signatureType: '0',
      },
      signature,
      owner: address,
      orderType,
    }

    const raw = await clobPost<{ orderID?: string; status?: string; errorMsg?: string; transactionsHashes?: string[] }>(
      '/order',
      body,
      address,
      creds,
    )

    return {
      orderId: raw.orderID ?? '',
      status: raw.status ?? 'unknown',
      transactionsHashes: raw.transactionsHashes,
      errorMsg: raw.errorMsg,
    }
  }

  async function cancelOrder(orderId: string): Promise<{ deleted: boolean }> {
    const creds = await getCredentials()
    const raw = await clobDelete<{ deleted: boolean }>(`/orders/${orderId}`, address, creds)
    return raw
  }

  async function cancelAllOrders(): Promise<{ deleted: boolean }> {
    const creds = await getCredentials()
    const raw = await clobDelete<{ deleted: boolean }>('/orders', address, creds)
    return raw
  }

  return { address, getCredentials, getOpenOrders, getTrades, placeOrder, cancelOrder, cancelAllOrders }
}
