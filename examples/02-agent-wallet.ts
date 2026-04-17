/**
 * Tutorial 2: Give a wallet to an agent
 *
 * How to generate or load a wallet and pass it to an AI agent — whether
 * that's a Claude session via MCP, a LangChain agent, or your own LLM loop.
 * This covers wallet creation, funding checks, and attaching it to an agenti instance.
 *
 * Run:
 *   npx tsx examples/02-agent-wallet.ts
 */

import { Connection, Keypair, clusterApiUrl, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { generateWallet, solana } from '@agenti/sdk'

// ─── Option A: Generate a brand-new wallet ────────────────────────────────────

const fresh = generateWallet()

console.log('=== New Wallet ===')
console.log('EVM address:     ', fresh.evm.address)
console.log('EVM private key: ', fresh.evm.privateKey, '← store this securely')
console.log('Solana address:  ', fresh.solana.address)
console.log(
  'Solana key (hex):',
  Buffer.from(fresh.solana.privateKey).toString('hex'),
  '← store this securely'
)
console.log(
  'Solana key (bs58):',
  bs58.encode(fresh.solana.privateKey),
  '← this is the Phantom-compatible format'
)

// ─── Option B: Load an existing wallet ────────────────────────────────────────

// From a base58 private key (Phantom export format)
function walletFromBase58(privateKey: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(privateKey))
}

// From a hex private key (64 bytes)
function walletFromHex(hex: string): Keypair {
  return Keypair.fromSecretKey(Buffer.from(hex, 'hex'))
}

// From a JSON byte array (Solana CLI / Anchor format)
function walletFromJsonArray(arr: number[]): Keypair {
  return Keypair.fromSecretKey(new Uint8Array(arr))
}

// ─── Option C: Derive from environment variables ─────────────────────────────

function agentWalletFromEnv(): Keypair {
  const key = process.env.SOLANA_PRIVATE_KEY
  if (!key) throw new Error('SOLANA_PRIVATE_KEY env var required')
  return Keypair.fromSecretKey(bs58.decode(key))
}

// ─── Attach wallet to agenti and check readiness ─────────────────────────────

async function setupAgent(keypair: Keypair) {
  const connection = new Connection(
    process.env.SOLANA_RPC_URL ?? clusterApiUrl('mainnet-beta'),
    'confirmed'
  )

  const trader = solana({ keypair, connection })

  const balance = await connection.getBalance(keypair.publicKey)
  const solBalance = balance / LAMPORTS_PER_SOL

  console.log('\n=== Agent Wallet Ready ===')
  console.log('Address:    ', keypair.publicKey.toBase58())
  console.log('SOL balance:', solBalance)
  console.log('Can trade:  ', solBalance > 0.01 ? 'yes' : 'no — fund with at least 0.01 SOL')

  if (solBalance < 0.001) {
    console.log('\nFund this wallet to get started:')
    console.log(`  solana airdrop 1 ${keypair.publicKey.toBase58()} --url devnet  # devnet only`)
    console.log(`  # or send SOL from Phantom/Backpack to: ${keypair.publicKey.toBase58()}`)
  }

  return trader
}

// Demo with a fresh wallet (no real funds)
const demo = generateWallet()
const demoKeypair = Keypair.fromSecretKey(demo.solana.privateKey)
await setupAgent(demoKeypair)

// In production, you'd do:
// const keypair = agentWalletFromEnv()
// const trader = await setupAgent(keypair)
// await trader.buy({ mint: '...', solAmount: 0.1 })
