import { Connection, Keypair, Transaction } from '@solana/web3.js'
import { getBuyPriceImpact, getSellPriceImpact, getBuyTokenAmount } from './curve.js'
import type { BondingCurveState } from './curve.js'
import { emitEvent } from '../events.js'

const PUMP_API = 'https://fun-block.pump.fun/agents'

export const NATIVE_MINT = 'So11111111111111111111111111111111111111112'
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

// pump.fun tokens use 6 decimal places
export const TOKEN_DECIMALS = 6

export interface TradeResult {
  signature: string
  explorerUrl: string
}

export interface BuyParams {
  mint: string
  solAmount: number     // human units, e.g. 0.1 = 0.1 SOL
  slippage?: number     // percent, e.g. 5 = 5%
  keypair: Keypair
  connection: Connection
  priorityFee?: number  // tip in lamports (for faster inclusion)
  curveState?: BondingCurveState
  maxPriceImpact?: number  // percent threshold for warning (default 5)
}

export interface SellParams {
  mint: string
  tokenAmount: number   // human units, e.g. 1000 = 1000 tokens
  slippage?: number
  keypair: Keypair
  connection: Connection
  curveState?: BondingCurveState
  maxPriceImpact?: number  // percent threshold for warning (default 5)
}

async function buildSignSend(
  txBase64: string,
  keypair: Keypair,
  connection: Connection
): Promise<TradeResult> {
  const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
  tx.sign(keypair)

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })

  const latest = await connection.getLatestBlockhash('confirmed')
  await connection.confirmTransaction(
    { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    'confirmed'
  )

  return { signature: sig, explorerUrl: `https://solscan.io/tx/${sig}` }
}

export async function buy(params: BuyParams): Promise<TradeResult> {
  const { mint, solAmount, slippage = 5, keypair, connection, priorityFee = 0,
          curveState, maxPriceImpact = 5 } = params
  const lamports = BigInt(Math.floor(solAmount * 1e9))

  if (curveState) {
    const impact = getBuyPriceImpact(lamports, curveState)
    if (impact > maxPriceImpact) {
      console.warn(`[agenti] buy price impact ${impact.toFixed(2)}% exceeds ${maxPriceImpact}% threshold`)
    }
  }

  const res = await fetch(`${PUMP_API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputMint: NATIVE_MINT,
      outputMint: mint,
      amount: lamports.toString(),
      user: keypair.publicKey.toBase58(),
      slippagePct: slippage,
      feePayer: keypair.publicKey.toBase58(),
      frontRunningProtection: false,
      tipAmount: priorityFee,
      encoding: 'base64',
    }),
  })

  if (!res.ok) throw new Error(`pump.fun API ${res.status}: ${await res.text()}`)
  const { transaction } = (await res.json()) as { transaction: string }
  const result = await buildSignSend(transaction, keypair, connection)
  emitEvent({ type: 'trade', mint, side: 'buy', sol: solAmount, ts: Date.now() })
  return result
}

export async function sell(params: SellParams): Promise<TradeResult> {
  const { mint, tokenAmount, slippage = 5, keypair, connection,
          curveState, maxPriceImpact = 5 } = params
  // convert human units to raw (6 decimals)
  const rawAmount = BigInt(Math.round(tokenAmount * 10 ** TOKEN_DECIMALS))

  if (curveState) {
    const impact = getSellPriceImpact(rawAmount, curveState)
    if (impact > maxPriceImpact) {
      console.warn(`[agenti] sell price impact ${impact.toFixed(2)}% exceeds ${maxPriceImpact}% threshold`)
    }
  }

  const res = await fetch(`${PUMP_API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputMint: mint,
      outputMint: NATIVE_MINT,
      amount: rawAmount.toString(),
      user: keypair.publicKey.toBase58(),
      slippagePct: slippage,
      feePayer: keypair.publicKey.toBase58(),
      frontRunningProtection: false,
      tipAmount: 0,
      encoding: 'base64',
    }),
  })

  if (!res.ok) throw new Error(`pump.fun API ${res.status}: ${await res.text()}`)
  const { transaction } = (await res.json()) as { transaction: string }
  const result = await buildSignSend(transaction, keypair, connection)
  emitEvent({ type: 'trade', mint, side: 'sell', sol: 0, ts: Date.now() })
  return result
}
