/**
 * Hyperliquid perpetuals client — read + write.
 *
 * Read endpoints (no key required):
 *   getMeta(), getFundingRate(), getMidPrice(), getL2Book(), getAccountState()
 *
 * Write endpoints (EVM private key required):
 *   placeOrder(), setLeverage(), closePosition(), cancelOrder()
 *
 * Signing: msgpack(action) + nonce + vault byte → keccak256 → EIP-712 phantom-agent
 * Ref: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
 */

import { encode } from '@msgpack/msgpack'
import { keccak256, parseSignature } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface HlUniverse {
  name: string
  szDecimals: number
  maxLeverage: number
  onlyIsolated?: boolean
}

export interface HlMeta {
  universe: HlUniverse[]
}

export interface HlAssetCtx {
  funding: string
  openInterest: string
  prevDayPx: string
  dayNtlVlm: string
  premium: string
  oraclePx: string
  markPx: string
  midPx: string | null
  impactPxs: [string, string] | null
}

export interface HlL2Level {
  px: string
  sz: string
  n: number
}

export interface HlL2Book {
  coin: string
  time: number
  levels: [HlL2Level[], HlL2Level[]]  // [bids, asks]
}

export interface HlPosition {
  coin: string
  szi: string           // positive = long, negative = short
  entryPx: string
  positionValue: string
  unrealizedPnl: string
  returnOnEquity: string
  leverage: { type: 'isolated' | 'cross'; value: number }
  maxLeverage: number
  liquidationPx: string | null
  marginUsed: string
  cumFunding: { allTime: string; sinceChange: string; sinceOpen: string }
}

export interface HlAccountState {
  marginSummary: {
    accountValue: string
    totalNtlPos: string
    totalRawUsd: string
    totalMarginUsed: string
  }
  crossMarginSummary: {
    accountValue: string
    totalNtlPos: string
    totalRawUsd: string
    totalMarginUsed: string
  }
  assetPositions: Array<{ position: HlPosition; type: 'oneWay' }>
  withdrawable: string
}

export interface HlOrderStatus {
  filled?: { totalSz: string; avgPx: string; oid: number }
  resting?: { oid: number }
  error?: string
}

export interface HlOrderResult {
  status: 'ok' | 'err'
  response?: { type: string; data?: { statuses: HlOrderStatus[] } }
  error?: string
}

export interface HlFundingInfo {
  coin: string
  fundingRate: number
  annualizedPct: string
  markPrice: number
  openInterest: number
  note: string
}

// ---------------------------------------------------------------------------
// Order params
// ---------------------------------------------------------------------------

export interface HlOrderParams {
  coin: string
  isBuy: boolean
  /** Size in USD — converted to coin units using mid price */
  sizeUsd: number
  /** Acceptable slippage vs mid price, default 1% */
  slippagePct?: number
  reduceOnly?: boolean
  /** Set cross leverage before placing (optional) */
  leverage?: number
}

// ---------------------------------------------------------------------------
// Internal: signing
// ---------------------------------------------------------------------------

function buildActionHash(
  action: unknown,
  nonce: number,
  vaultAddress: `0x${string}` | null,
): `0x${string}` {
  const msgpack = encode(action)
  const nonceBuf = new Uint8Array(8)
  new DataView(nonceBuf.buffer).setBigUint64(0, BigInt(nonce), false)

  let full: Uint8Array
  if (vaultAddress) {
    const vaultBytes = Buffer.from(vaultAddress.slice(2), 'hex')
    full = new Uint8Array(msgpack.length + 9 + 20)
    full.set(msgpack)
    full.set(nonceBuf, msgpack.length)
    full[msgpack.length + 8] = 0x01
    full.set(vaultBytes, msgpack.length + 9)
  } else {
    full = new Uint8Array(msgpack.length + 9)
    full.set(msgpack)
    full.set(nonceBuf, msgpack.length)
    full[msgpack.length + 8] = 0x00
  }

  return keccak256(full)
}

async function signHlAction(
  privateKey: `0x${string}`,
  action: unknown,
  nonce: number,
  vaultAddress: `0x${string}` | null = null,
): Promise<{ r: `0x${string}`; s: `0x${string}`; v: number }> {
  const account = privateKeyToAccount(privateKey)
  const connectionId = buildActionHash(action, nonce, vaultAddress)

  const sig = await account.signTypedData({
    domain: {
      name: 'HyperliquidTransaction:Agent',
      version: '1',
      chainId: 1337,
      verifyingContract: '0x0000000000000000000000000000000000000000',
    },
    types: {
      Agent: [
        { name: 'source', type: 'string' },
        { name: 'connectionId', type: 'bytes32' },
      ],
    },
    primaryType: 'Agent',
    message: { source: 'a', connectionId },
  })

  const { r, s, v } = parseSignature(sig)
  return { r, s, v: Number(v) }
}

// ---------------------------------------------------------------------------
// HyperliquidClient
// ---------------------------------------------------------------------------

export class HyperliquidClient {
  private readonly apiUrl: string
  private metaCache: HlMeta | null = null
  private indexCache = new Map<string, number>()
  private decimalsCache = new Map<string, number>()

  constructor(
    private readonly privateKey?: `0x${string}`,
    mainnet = true,
  ) {
    this.apiUrl = mainnet
      ? 'https://api.hyperliquid.xyz'
      : 'https://api.hyperliquid-testnet.xyz'
  }

  get address(): string | undefined {
    return this.privateKey ? privateKeyToAccount(this.privateKey).address : undefined
  }

  // ---- Internal helpers ----

  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.apiUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Hyperliquid ${endpoint} ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  private async exchange(action: unknown): Promise<HlOrderResult> {
    if (!this.privateKey) throw new Error('Hyperliquid: privateKey required for writes')
    const nonce = Date.now()
    const sig = await signHlAction(this.privateKey, action, nonce)
    return this.post<HlOrderResult>('/exchange', { action, nonce, signature: sig })
  }

  // ---- Read API ----

  async getMeta(): Promise<HlMeta> {
    if (this.metaCache) return this.metaCache
    this.metaCache = await this.post<HlMeta>('/info', { type: 'meta' })
    return this.metaCache
  }

  async getAssetIndex(coin: string): Promise<number> {
    const cached = this.indexCache.get(coin)
    if (cached !== undefined) return cached
    const meta = await this.getMeta()
    const idx = meta.universe.findIndex(a => a.name === coin)
    if (idx === -1) throw new Error(`Hyperliquid: unknown asset "${coin}"`)
    this.indexCache.set(coin, idx)
    return idx
  }

  async getSzDecimals(coin: string): Promise<number> {
    const cached = this.decimalsCache.get(coin)
    if (cached !== undefined) return cached
    const meta = await this.getMeta()
    const asset = meta.universe.find(a => a.name === coin)
    const dec = asset?.szDecimals ?? 3
    this.decimalsCache.set(coin, dec)
    return dec
  }

  async getMetaAndCtxs(): Promise<[HlMeta, HlAssetCtx[]]> {
    return this.post<[HlMeta, HlAssetCtx[]]>('/info', { type: 'metaAndAssetCtxs' })
  }

  async getFundingRate(coin: string): Promise<HlFundingInfo> {
    const [meta, ctxs] = await this.getMetaAndCtxs()
    const idx = meta.universe.findIndex(a => a.name === coin)
    if (idx === -1) throw new Error(`Hyperliquid: unknown asset "${coin}"`)
    const ctx = ctxs[idx]!
    const rate = parseFloat(ctx.funding)
    return {
      coin,
      fundingRate: rate,
      annualizedPct: (rate * 3 * 365 * 100).toFixed(2) + '%',
      markPrice: parseFloat(ctx.markPx),
      openInterest: parseFloat(ctx.openInterest),
      note: rate > 0.01 ? 'Longs overextended' : rate < -0.005 ? 'Shorts overextended' : 'Neutral',
    }
  }

  async getMidPrice(coin: string): Promise<number> {
    const [meta, ctxs] = await this.getMetaAndCtxs()
    const idx = meta.universe.findIndex(a => a.name === coin)
    if (idx === -1) throw new Error(`Hyperliquid: unknown asset "${coin}"`)
    const ctx = ctxs[idx]!
    const mid = ctx.midPx ?? ctx.markPx
    return parseFloat(mid)
  }

  async getL2Book(coin: string, nLevels = 5): Promise<HlL2Book> {
    return this.post<HlL2Book>('/info', { type: 'l2Book', coin, nLevels })
  }

  async getAccountState(address?: string): Promise<HlAccountState> {
    const addr = address ?? this.address
    if (!addr) throw new Error('Hyperliquid: address or privateKey required')
    return this.post<HlAccountState>('/info', { type: 'clearinghouseState', user: addr })
  }

  async getOpenPositions(address?: string): Promise<HlPosition[]> {
    const state = await this.getAccountState(address)
    return state.assetPositions
      .map(p => p.position)
      .filter(p => parseFloat(p.szi) !== 0)
  }

  async getUsdBalance(address?: string): Promise<number> {
    const state = await this.getAccountState(address)
    return parseFloat(state.marginSummary.accountValue)
  }

  // ---- Write API ----

  async setLeverage(coin: string, leverage: number, isCross = true): Promise<void> {
    const assetIdx = await this.getAssetIndex(coin)
    await this.exchange({ type: 'updateLeverage', asset: assetIdx, isCross, leverage })
  }

  async placeOrder(params: HlOrderParams): Promise<HlOrderResult> {
    const [assetIdx, szDecimals, midPrice] = await Promise.all([
      this.getAssetIndex(params.coin),
      this.getSzDecimals(params.coin),
      this.getMidPrice(params.coin),
    ])

    if (params.leverage) {
      await this.setLeverage(params.coin, params.leverage)
    }

    const coinSize = params.sizeUsd / midPrice
    const szStr = coinSize.toFixed(szDecimals)

    // IOC with aggressive price → behaves like a market order
    const slippage = (params.slippagePct ?? 1) / 100
    const pxRaw = params.isBuy
      ? midPrice * (1 + slippage)
      : midPrice * (1 - slippage)
    const pxStr = pxRaw.toFixed(Math.min(szDecimals + 1, 6))

    const action = {
      type: 'order',
      orders: [{
        a: assetIdx,
        b: params.isBuy,
        p: pxStr,
        s: szStr,
        r: params.reduceOnly ?? false,
        t: { limit: { tif: 'Ioc' } },
      }],
      grouping: 'na',
    }

    return this.exchange(action)
  }

  async cancelOrder(coin: string, oid: number): Promise<HlOrderResult> {
    const assetIdx = await this.getAssetIndex(coin)
    const action = { type: 'cancel', cancels: [{ a: assetIdx, o: oid }] }
    return this.exchange(action)
  }

  async closePosition(coin: string): Promise<HlOrderResult> {
    const positions = await this.getOpenPositions()
    const pos = positions.find(p => p.coin === coin)
    if (!pos) throw new Error(`Hyperliquid: no open position for ${coin}`)

    const szi = parseFloat(pos.szi)
    if (szi === 0) throw new Error(`Hyperliquid: zero-size position for ${coin}`)

    const [assetIdx, szDecimals, midPrice] = await Promise.all([
      this.getAssetIndex(coin),
      this.getSzDecimals(coin),
      this.getMidPrice(coin),
    ])

    const isBuy = szi < 0
    const pxRaw = isBuy ? midPrice * 1.02 : midPrice * 0.98
    const pxStr = pxRaw.toFixed(Math.min(szDecimals + 1, 6))

    const action = {
      type: 'order',
      orders: [{
        a: assetIdx,
        b: isBuy,
        p: pxStr,
        s: Math.abs(szi).toFixed(szDecimals),
        r: true,
        t: { limit: { tif: 'Ioc' } },
      }],
      grouping: 'na',
    }

    return this.exchange(action)
  }
}
