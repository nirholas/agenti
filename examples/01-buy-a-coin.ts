/**
 * Tutorial 1: Buy a coin on Solana
 *
 * The most fundamental operation — spend SOL, receive a pump.fun token.
 * Works whether the coin is on the bonding curve or already graduated to the AMM.
 * The pump.fun API auto-detects which and builds the correct transaction.
 *
 * Run:
 *   SOLANA_PRIVATE_KEY=<base58-key> npx tsx examples/01-buy-a-coin.ts
 */

import { Connection, Keypair, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js'
import bs58 from 'bs58'
import { solana } from '@agenti/sdk'

// ─── Config ───────────────────────────────────────────────────────────────────

// Your Solana private key — base58 encoded (the format Phantom exports)
const PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY!

// Token mint address to buy — replace with your target
const MINT = 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC' // $PNUT (example)

// How much SOL to spend
const SOL_AMOUNT = 0.01 // 0.01 SOL

// Slippage tolerance
const SLIPPAGE = 5 // 5%

// ─── Main ─────────────────────────────────────────────────────────────────────

const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY))
const connection = new Connection(
  process.env.SOLANA_RPC_URL ?? clusterApiUrl('mainnet-beta'),
  'confirmed'
)

const trader = solana({ keypair, connection })

console.log(`Wallet: ${keypair.publicKey.toBase58()}`)

// Check balance before buying
const balance = await connection.getBalance(keypair.publicKey)
console.log(`SOL balance: ${balance / LAMPORTS_PER_SOL} SOL`)

if (balance < SOL_AMOUNT * LAMPORTS_PER_SOL) {
  console.error(`Insufficient balance. Need ${SOL_AMOUNT} SOL, have ${balance / LAMPORTS_PER_SOL}`)
  process.exit(1)
}

// Check coin state so we know what we're buying into
const state = await trader.coinState(MINT)
console.log(`Coin phase: ${state.phase}`) // 'bonding' | 'migrating' | 'graduated'
if (state.phase === 'graduated') {
  console.log(`AMM pool: ${state.pool}`)
}

console.log(`Buying ${SOL_AMOUNT} SOL worth of ${MINT}...`)

const result = await trader.buy({
  mint: MINT,
  solAmount: SOL_AMOUNT,
  slippage: SLIPPAGE,
})

console.log(`\n✓ Bought!`)
console.log(`Transaction: ${result.signature}`)
console.log(`Explorer:    ${result.explorerUrl}`)
