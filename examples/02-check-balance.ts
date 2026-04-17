/**
 * Example 2: Check USDC and SOL balances
 *
 * Loads a wallet from an existing EVM private key and fetches
 * on-chain balances across Base and Solana.
 *
 * Run:
 *   EVM_KEY=0x... npx tsx examples/02-check-balance.ts
 */

import { agenti } from '@agenti/sdk'

const agent = agenti({ evm: { privateKey: process.env.EVM_KEY as `0x${string}` } })
const balances = await agent.balance()
console.log(balances)
