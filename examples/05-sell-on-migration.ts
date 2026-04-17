/**
 * Tutorial 5: Sell when a coin migrates
 *
 * The inverse of tutorial 4 — you bought early on the bonding curve,
 * and you want to exit the moment it graduates. This avoids holding
 * through post-migration volatility and secures your bonding curve gains.
 *
 * Run:
 *   SOLANA_PRIVATE_KEY=<key> MINT=<mint> TOKEN_AMOUNT=<amount> npx tsx examples/05-sell-on-migration.ts
 */

import { Connection, Keypair, clusterApiUrl, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import bs58 from 'bs58'
import { solana } from '@agenti/sdk'

const keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY!))
const MINT = process.env.MINT!

const connection = new Connection(
  process.env.SOLANA_RPC_URL ?? clusterApiUrl('mainnet-beta'),
  'confirmed'
)
const trader = solana({ keypair, connection })

// ─── Get your current token balance ───────────────────────────────────────────

async function getTokenBalance(mint: string, owner: Keypair): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(
      new PublicKey(mint),
      owner.publicKey
    )
    const info = await connection.getTokenAccountBalance(ata)
    return Number(info.value.uiAmount ?? 0)
  } catch {
    return 0
  }
}

const tokenBalance = await getTokenBalance(MINT, keypair)
// Allow override from env, otherwise sell entire balance
const SELL_AMOUNT = process.env.TOKEN_AMOUNT ? Number(process.env.TOKEN_AMOUNT) : tokenBalance

console.log(`Wallet: ${keypair.publicKey.toBase58()}`)
console.log(`Token balance: ${tokenBalance} tokens`)
console.log(`Will sell: ${SELL_AMOUNT} tokens on migration`)

if (SELL_AMOUNT <= 0) {
  console.error('No tokens to sell. Buy first using tutorial 01.')
  process.exit(1)
}

// ─── Check if already graduated ───────────────────────────────────────────────

const initial = await trader.coinState(MINT)

if (initial.phase === 'graduated') {
  console.log('Already graduated — selling now...')
  const result = await trader.sell({ mint: MINT, tokenAmount: SELL_AMOUNT, slippage: 10 })
  console.log(`Sold! ${result.explorerUrl}`)
  process.exit(0)
}

console.log(`Coin is on ${initial.phase}. Waiting for migration to sell...`)

// ─── Watch for migration and sell immediately ─────────────────────────────────

const stop = trader.watchMigration(
  MINT,
  async ({ mint, pool }) => {
    console.log(`\n🎯 Migrated to AMM! Pool: ${pool}`)
    console.log(`Selling ${SELL_AMOUNT} tokens...`)

    // Re-check actual balance at migration time (may have changed)
    const currentBalance = await getTokenBalance(mint, keypair)
    const sellAmount = Math.min(SELL_AMOUNT, currentBalance)

    if (sellAmount <= 0) {
      console.log('No tokens left to sell.')
      process.exit(0)
    }

    try {
      const result = await trader.sell({
        mint,
        tokenAmount: sellAmount,
        slippage: 15, // higher slippage for speed on migration
        keypair,
        connection,
      })
      console.log(`\n✓ Sold ${sellAmount} tokens on migration!`)
      console.log(`Transaction: ${result.signature}`)
      console.log(`Explorer:    ${result.explorerUrl}`)
    } catch (e) {
      console.error('Sell failed:', e)
    }

    process.exit(0)
  },
  { pollIntervalMs: 1500, timeoutMs: 60 * 60 * 1000 } // watch up to 1 hour
)

console.log('Watching for migration... (Ctrl+C to cancel)')

process.on('SIGINT', () => {
  stop()
  process.exit(0)
})
