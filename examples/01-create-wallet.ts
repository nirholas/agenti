/**
 * Example 1: Generate a wallet
 *
 * Creates a fresh EVM + Solana keypair in one call.
 * No network access required — purely local key generation.
 *
 * Run:
 *   npx tsx examples/01-create-wallet.ts
 */

import { generateWallet } from '@agenti/core'

const wallet = await generateWallet()
console.log('EVM address:    ', wallet.evm.address)
console.log('Solana address: ', wallet.solana.address)
