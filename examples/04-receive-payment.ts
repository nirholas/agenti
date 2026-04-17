/**
 * Example 4: Create a payment invoice
 *
 * Generates an invoice with a deposit address and amount so another
 * agent or user knows exactly where to send funds.
 *
 * Run:
 *   EVM_KEY=0x... npx tsx examples/04-receive-payment.ts
 */

import { agenti } from '@agenti/sdk'

const agent = agenti({ evm: { privateKey: process.env.EVM_KEY as `0x${string}` } })
const invoice = await agent.receive({ amount: 1, token: 'USDC', chain: 'base' })
console.log('Send USDC to:', invoice.address)
console.log(invoice)
