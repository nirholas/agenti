/**
 * Tutorial 4: Buy the moment a coin migrates to the AMM
 *
 * When a pump.fun token's bonding curve fills up (~$69k market cap),
 * it "graduates" — liquidity migrates to the PumpSwap AMM automatically.
 * This is a key moment: early buyers often take profit, creating a dip,
 * and new buyers rush in. Being first matters.
 *
 * This tutorial shows how to watch a token and fire a buy the instant migration completes.
 *
 * Run:
 *   SOLANA_PRIVATE_KEY=<key> MINT=<mint> npx tsx examples/04-buy-on-migration.ts
 */

import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js'
import bs58 from 'bs58'
import { solana } from '@agenti/sdk'

const keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY!))
const MINT = process.env.MINT!
const BUY_AMOUNT_SOL = Number(process.env.BUY_AMOUNT ?? '0.05')

const connection = new Connection(
  process.env.SOLANA_RPC_URL ?? clusterApiUrl('mainnet-beta'),
  'confirmed'
)
const trader = solana({ keypair, connection })

// ─── Check current state first ────────────────────────────────────────────────

const initial = await trader.coinState(MINT)

if (initial.phase === 'graduated') {
  console.log(`Already graduated. Pool: ${initial.pool}`)
  console.log('Buying on AMM directly...')
  const result = await trader.buy({ mint: MINT, solAmount: BUY_AMOUNT_SOL, slippage: 10 })
  console.log(`Bought! ${result.explorerUrl}`)
  process.exit(0)
}

if (initial.phase === 'migrating') {
  console.log('Migration in progress — waiting for pool to be live...')
}

if (initial.phase === 'bonding') {
  console.log(`On bonding curve (market cap: ${initial.marketCapSol} SOL)`)
  console.log('Watching for migration...')
}

// ─── Watch for migration and buy immediately ──────────────────────────────────

const start = Date.now()

const stop = trader.watchMigration(
  MINT,
  async ({ mint, pool, timestamp }) => {
    const latency = timestamp - start
    console.log(`\n🚀 MIGRATED! Pool: ${pool}`)
    console.log(`Detection latency: ${latency}ms`)
    console.log(`Buying ${BUY_AMOUNT_SOL} SOL immediately...`)

    try {
      const result = await trader.buy({
        mint,
        solAmount: BUY_AMOUNT_SOL,
        slippage: 15, // higher slippage on migration — lots of volatility
        priorityFee: 100_000, // 0.0001 SOL priority fee for faster inclusion
      })
      console.log(`\n✓ Bought post-migration!`)
      console.log(`Transaction: ${result.signature}`)
      console.log(`Explorer:    ${result.explorerUrl}`)
    } catch (e) {
      console.error('Buy failed:', e)
    }

    process.exit(0)
  },
  {
    pollIntervalMs: 1500, // check every 1.5s for low latency
    timeoutMs: 30 * 60 * 1000, // give up after 30 min
  }
)

console.log('Watching... (Ctrl+C to cancel)')

// Cleanup on exit
process.on('SIGINT', () => {
  stop()
  console.log('\nStopped watching.')
  process.exit(0)
})
