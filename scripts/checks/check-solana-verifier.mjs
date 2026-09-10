#!/usr/bin/env node
/**
 * Verifies a real, already-settled Solana USDC transfer with the facilitator's
 * own verifier.
 *
 * The unit tests drive the verifier with RPC-shaped fixtures, which proves the
 * logic but not that the logic matches what Solana actually returns. This walks
 * recent activity on Circle's USDC mint, picks a transaction that genuinely
 * moved USDC between two owners, and asserts the verifier accepts it against
 * requirements built from what the chain says, then rejects the same transfer
 * when the amount, recipient, mint or cluster is changed.
 *
 * A network that cannot be reached is reported as skipped rather than failed,
 * because an offline machine is not a broken verifier. A reachable network that
 * disagrees with the verifier is a failure.
 */
import { Connection, PublicKey } from '@solana/web3.js'
import { verifySolanaPayment } from '@agenti/facilitator'

const RPC = process.env['SOLANA_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com'
const MAINNET = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
const DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const WSOL = 'So11111111111111111111111111111111111111112'

const connection = new Connection(RPC, 'confirmed')

/** Finds a recent transaction that moved USDC, and reports who paid whom. */
async function findUsdcTransfer() {
  const signatures = await connection.getSignaturesForAddress(new PublicKey(USDC), { limit: 25 })

  for (const { signature, err } of signatures) {
    if (err) continue
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })
    if (!tx?.meta) continue

    const pre = tx.meta.preTokenBalances ?? []
    const post = tx.meta.postTokenBalances ?? []
    const balanceBefore = (accountIndex) =>
      BigInt(pre.find((b) => b.accountIndex === accountIndex)?.uiTokenAmount.amount ?? '0')

    const gained = post.find(
      (p) =>
        p.mint === USDC &&
        p.owner &&
        BigInt(p.uiTokenAmount.amount) > balanceBefore(p.accountIndex),
    )
    if (!gained) continue

    const spent = post.find(
      (p) =>
        p.mint === USDC &&
        p.owner &&
        BigInt(p.uiTokenAmount.amount) < balanceBefore(p.accountIndex),
    )

    return {
      signature,
      payTo: gained.owner,
      amount: (BigInt(gained.uiTokenAmount.amount) - balanceBefore(gained.accountIndex)).toString(),
      payer: spent?.owner,
    }
  }
  return null
}

let transfer
try {
  transfer = await findUsdcTransfer()
} catch (err) {
  console.log(`Skipped: Solana RPC unreachable (${String(err.message).split('\n')[0]}).`)
  console.log(`Set SOLANA_RPC_URL to a reachable endpoint to run this check.`)
  process.exit(0)
}

if (!transfer) {
  console.log('Skipped: no USDC transfer found in the last 25 mint transactions.')
  process.exit(0)
}

console.log(`Verifying real mainnet transfer ${transfer.signature.slice(0, 16)}...`)
console.log(`  ${transfer.amount} USDC base units to ${transfer.payTo}\n`)

const payment = {
  x402Version: 2,
  scheme: 'exact',
  network: MAINNET,
  payload: { signature: transfer.signature, ...(transfer.payer ? { payer: transfer.payer } : {}) },
}

const baseRequirements = {
  scheme: 'exact',
  network: MAINNET,
  asset: USDC,
  payTo: transfer.payTo,
  amount: transfer.amount,
}

const cases = [
  ['accepts the transfer exactly as the chain records it', baseRequirements, true],
  ['accepts it against a lower price', { ...baseRequirements, amount: '1' }, true],
  [
    'rejects it against a higher price',
    { ...baseRequirements, amount: (BigInt(transfer.amount) + 1n).toString() },
    false,
  ],
  [
    'rejects it for a different recipient',
    { ...baseRequirements, payTo: '11111111111111111111111111111111' },
    false,
  ],
  ['rejects it for a different token', { ...baseRequirements, asset: WSOL }, false],
  ['rejects it on the wrong cluster', { ...baseRequirements, network: DEVNET }, false],
]

let failures = 0

for (const [label, requirements, shouldPass] of cases) {
  const result = await verifySolanaPayment(payment, requirements, { connection, commitment: 'confirmed' })
  const ok = result.valid === shouldPass
  if (!ok) failures += 1
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(48)} valid=${result.valid}${result.error ? ` (${result.error})` : ''}`,
  )
}

if (failures > 0) {
  console.error(`\n${failures} case(s) disagreed with the chain.`)
  process.exit(1)
}
console.log('\nThe verifier agrees with mainnet on every case.')
