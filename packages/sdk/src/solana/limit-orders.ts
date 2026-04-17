// Jupiter Limit Order v2 — place, cancel, and query limit orders on Solana.
//
// Jupiter's limit order program fills orders when the market price crosses your
// limit price. It routes through all Solana DEXs (Orca, Raydium, Meteora, etc.)
// to find fills, making it far more likely to execute than a single-venue limit.
//
// API reference: https://station.jup.ag/docs/limit-order/limit-order-api

import type { Keypair, Connection } from '@solana/web3.js'

const LIMIT_ORDER_API = 'https://jup.ag/api/limit/v2'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LimitOrderParams {
  /** Token to sell */
  inputMint: string
  /** Token to receive */
  outputMint: string
  /** Amount of inputMint to sell (human units) */
  inputAmount: number
  /** Minimum amount of outputMint to receive (sets implied limit price) */
  outputAmount: number
  inputDecimals: number
  outputDecimals: number
  keypair: Keypair
  connection: Connection
  /**
   * Unix timestamp (seconds) when the order expires.
   * Omit or set to null for no expiry (GTC — good till cancelled).
   */
  expiredAt?: number | null
}

export interface LimitOrderResult {
  /** The on-chain order account public key */
  orderPubkey: string
  txSignature: string
  explorerUrl: string
  inputMint: string
  outputMint: string
  inputAmount: number
  outputAmount: number
  /** Implied limit price: outputAmount / inputAmount */
  limitPrice: number
  createdAt: number
  expiredAt: number | null
}

export interface OpenLimitOrder {
  publicKey: string
  account: {
    maker: string
    inputMint: string
    outputMint: string
    inAmount: string
    outAmount: string
    oriInAmount: string
    oriOutAmount: string
    expiredAt: number | null
    borrowMakingAmount: string
  }
  /** Implied limit price in output/input units */
  limitPrice: number
  inputDecimals: number
  outputDecimals: number
  filledPct: number
}

export interface CancelOrdersResult {
  txSignatures: string[]
  cancelledCount: number
}

// ── Create Limit Order ────────────────────────────────────────────────────────

/**
 * Place a limit order via Jupiter Limit Order v2.
 *
 * The order sells `inputAmount` of inputMint when it can receive at least
 * `outputAmount` of outputMint. This sets the limit price at:
 *   limitPrice = outputAmount / inputAmount
 *
 * Example: sell 100 USDC for at least 0.67 SOL → limit price ~$149/SOL
 */
export async function createLimitOrder(params: LimitOrderParams): Promise<LimitOrderResult> {
  const {
    inputMint,
    outputMint,
    inputAmount,
    outputAmount,
    inputDecimals,
    outputDecimals,
    keypair,
    connection,
    expiredAt = null,
  } = params

  const { VersionedTransaction } = await import('@solana/web3.js')

  const inputAtoms  = Math.round(inputAmount  * 10 ** inputDecimals)
  const outputAtoms = Math.round(outputAmount * 10 ** outputDecimals)

  const body: Record<string, unknown> = {
    maker: keypair.publicKey.toBase58(),
    inputMint,
    outputMint,
    params: {
      makingAmount: inputAtoms.toString(),
      takingAmount: outputAtoms.toString(),
    },
  }
  if (expiredAt != null) body['expiredAt'] = expiredAt.toString()

  const res = await fetch(`${LIMIT_ORDER_API}/createOrder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Jupiter limit order create ${res.status}: ${text}`)
  }

  const { tx, orderPubkey } = (await res.json()) as { tx: string; orderPubkey: string }

  // Deserialize, sign, send
  const txBuf = Buffer.from(tx, 'base64')
  const vtx = VersionedTransaction.deserialize(txBuf)
  vtx.sign([keypair])

  const signature = await connection.sendRawTransaction(vtx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })

  const latest = await connection.getLatestBlockhash('confirmed')
  await connection.confirmTransaction(
    { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    'confirmed',
  )

  return {
    orderPubkey,
    txSignature: signature,
    explorerUrl: `https://solscan.io/tx/${signature}`,
    inputMint,
    outputMint,
    inputAmount,
    outputAmount,
    limitPrice: outputAmount / inputAmount,
    createdAt: Date.now(),
    expiredAt: expiredAt ? expiredAt * 1000 : null,
  }
}

// ── Cancel Orders ─────────────────────────────────────────────────────────────

/**
 * Cancel one or more open limit orders.
 * Pass an empty `orders` array to cancel ALL open orders for this wallet.
 */
export async function cancelLimitOrders(
  orders: string[],
  keypair: Keypair,
  connection: Connection,
): Promise<CancelOrdersResult> {
  const { VersionedTransaction } = await import('@solana/web3.js')

  const body: Record<string, unknown> = {
    maker: keypair.publicKey.toBase58(),
    ...(orders.length > 0 ? { orders } : {}),
  }

  const res = await fetch(`${LIMIT_ORDER_API}/cancelOrders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Jupiter cancel orders ${res.status}: ${text}`)
  }

  const { txs } = (await res.json()) as { txs: string[] }

  const signatures: string[] = []
  for (const txBase64 of txs) {
    const vtx = VersionedTransaction.deserialize(Buffer.from(txBase64, 'base64'))
    vtx.sign([keypair])

    const sig = await connection.sendRawTransaction(vtx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    })

    const latest = await connection.getLatestBlockhash('confirmed')
    await connection.confirmTransaction(
      { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      'confirmed',
    )
    signatures.push(sig)
  }

  return { txSignatures: signatures, cancelledCount: signatures.length }
}

// ── Query Orders ──────────────────────────────────────────────────────────────

/**
 * Fetch all open limit orders for a wallet address.
 * Optionally filter by token pair.
 */
export async function getOpenLimitOrders(
  walletAddress: string,
  filter?: { inputMint?: string; outputMint?: string },
): Promise<OpenLimitOrder[]> {
  const qs = new URLSearchParams({ wallet: walletAddress })
  if (filter?.inputMint)  qs.set('inputMint',  filter.inputMint)
  if (filter?.outputMint) qs.set('outputMint', filter.outputMint)

  const res = await fetch(`${LIMIT_ORDER_API}/openOrders?${qs}`)
  if (!res.ok) throw new Error(`Jupiter open orders ${res.status}: ${await res.text()}`)

  const orders = (await res.json()) as Array<{
    publicKey: string
    account: {
      maker: string
      inputMint: string
      outputMint: string
      inAmount: string
      outAmount: string
      oriInAmount: string
      oriOutAmount: string
      expiredAt: number | null
      borrowMakingAmount: string
    }
  }>

  return orders.map((o) => {
    const oriIn  = Number(o.account.oriInAmount)
    const oriOut = Number(o.account.oriOutAmount)
    const remIn  = Number(o.account.inAmount)

    return {
      publicKey: o.publicKey,
      account: o.account,
      limitPrice: oriIn > 0 ? oriOut / oriIn : 0,
      inputDecimals: 6,   // caller can override if needed
      outputDecimals: 6,
      filledPct: oriIn > 0 ? ((oriIn - remIn) / oriIn) * 100 : 0,
    }
  })
}

/**
 * Fetch order history (filled + cancelled) for a wallet.
 */
export async function getLimitOrderHistory(
  walletAddress: string,
  cursor?: string,
): Promise<Array<{ publicKey: string; status: 'filled' | 'cancelled'; filledAt?: number }>> {
  const qs = new URLSearchParams({ wallet: walletAddress })
  if (cursor) qs.set('cursor', cursor)

  const res = await fetch(`${LIMIT_ORDER_API}/orderHistory?${qs}`)
  if (!res.ok) throw new Error(`Jupiter order history ${res.status}: ${await res.text()}`)

  const { orders } = (await res.json()) as {
    orders: Array<{ publicKey: string; status: 'filled' | 'cancelled'; updatedAt?: number }>
  }

  return orders.map((o) => ({
    publicKey: o.publicKey,
    status: o.status,
    filledAt: o.updatedAt ? o.updatedAt * 1000 : undefined,
  }))
}

// ── Convenience Helpers ───────────────────────────────────────────────────────

/**
 * Place a limit buy order: buy `outputAmount` of outputMint at a maximum price.
 *
 * @param limitPrice   Max price in quote/base (e.g. 140 USDC per SOL)
 * @param outputAmount How many base tokens you want (e.g. 1 SOL)
 */
export async function limitBuy(params: {
  baseMint: string
  quoteMint: string
  baseDecimals: number
  quoteDecimals: number
  /** Limit price: quote per base (e.g. 140 USDC per SOL) */
  limitPrice: number
  /** How many base tokens to buy */
  baseAmount: number
  keypair: Keypair
  connection: Connection
  expiredAt?: number | null
}): Promise<LimitOrderResult> {
  const quoteAmount = params.baseAmount * params.limitPrice
  return createLimitOrder({
    inputMint: params.quoteMint,
    outputMint: params.baseMint,
    inputAmount: quoteAmount,
    outputAmount: params.baseAmount,
    inputDecimals: params.quoteDecimals,
    outputDecimals: params.baseDecimals,
    keypair: params.keypair,
    connection: params.connection,
    expiredAt: params.expiredAt,
  })
}

/**
 * Place a limit sell order: sell `baseAmount` of baseMint at a minimum price.
 *
 * @param limitPrice   Min price in quote/base (e.g. 155 USDC per SOL)
 * @param baseAmount   How many base tokens to sell
 */
export async function limitSell(params: {
  baseMint: string
  quoteMint: string
  baseDecimals: number
  quoteDecimals: number
  limitPrice: number
  baseAmount: number
  keypair: Keypair
  connection: Connection
  expiredAt?: number | null
}): Promise<LimitOrderResult> {
  const quoteAmount = params.baseAmount * params.limitPrice
  return createLimitOrder({
    inputMint: params.baseMint,
    outputMint: params.quoteMint,
    inputAmount: params.baseAmount,
    outputAmount: quoteAmount,
    inputDecimals: params.baseDecimals,
    outputDecimals: params.quoteDecimals,
    keypair: params.keypair,
    connection: params.connection,
    expiredAt: params.expiredAt,
  })
}
