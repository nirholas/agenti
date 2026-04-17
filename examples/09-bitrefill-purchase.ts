/**
 * Example 9: Buy an Amazon gift card with USDC via Bitrefill
 *
 * Flow:
 *   1. Search for "Amazon" gift cards
 *   2. Create a USDC invoice (returns payment address + amount)
 *   3. agent.pay() handles x402 or direct USDC transfer
 *   4. Poll until order completes and redemption code is ready
 *   5. Print redemption code
 *
 * Run:
 *   EVM_KEY=0x... BITREFILL_API_KEY=... npx tsx examples/09-bitrefill-purchase.ts
 */

import { agenti } from '@agenti/sdk'
import { searchProducts, createInvoice, waitForOrder } from '@agenti/sdk'

const EVM_KEY = process.env.EVM_KEY as `0x${string}`
const BITREFILL_API_KEY = process.env.BITREFILL_API_KEY ?? ''

if (!EVM_KEY || !BITREFILL_API_KEY) {
  console.error('Set EVM_KEY and BITREFILL_API_KEY env vars')
  process.exit(1)
}

const config = {
  apiKey: BITREFILL_API_KEY,
  testMode: process.env.BITREFILL_TEST_MODE === 'true',
}

// 1. Search for Amazon gift cards
console.log('Searching for Amazon gift cards...')
const products = await searchProducts(config, 'Amazon', { country: 'US', type: 'giftcard' })
console.log(`Found ${products.length} products`)

const amazon = products[0]
if (!amazon) {
  console.error('No Amazon gift cards found')
  process.exit(1)
}

console.log(`Selected: ${amazon.name} — denominations: $${amazon.denominations.join(', $')}`)

// 2. Create a USDC invoice for a $25 gift card
const denomination = amazon.denominations.find((d) => d === 25) ?? amazon.denominations[0]
console.log(`Creating USDC invoice for $${denomination}...`)

const invoice = await createInvoice(config, {
  productId: amazon.id,
  value: denomination,
  paymentMethod: 'usdc',
  deliveryEmail: 'agent@example.com',
})

console.log(`Invoice created: ${invoice.id}`)
console.log(`Pay ${invoice.amountDue} ${invoice.currency} to ${invoice.paymentAddress}`)
console.log(`Expires: ${new Date(invoice.expiresAt * 1000).toISOString()}`)

// 3. Use agent.pay() to settle the USDC payment (handles x402 or direct transfer)
const agent = agenti({ evm: { privateKey: EVM_KEY } })

// Construct a payment URL for the invoice address (direct USDC transfer via x402)
const paymentUrl = `https://api.bitrefill.com/v2/invoices/${invoice.id}/pay`
console.log('Sending USDC payment...')

try {
  const payResponse = await agent.pay(paymentUrl, {
    method: 'POST',
    body: JSON.stringify({ payment_method: 'usdc', amount: invoice.amountDue }),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BITREFILL_API_KEY}`,
    },
  })
  console.log('Payment response:', payResponse.status)
} catch (err) {
  console.log('Note: Direct payment API may require manual USDC transfer to:', invoice.paymentAddress)
  console.log('Amount:', invoice.amountDue, invoice.currency)
}

// 4. Wait for the order to complete
console.log('Waiting for order to complete...')
const order = await waitForOrder(config, invoice.id, { timeoutMs: 120_000 })

console.log(`Order status: ${order.status}`)
if (order.redemptionCode) {
  console.log(`Redemption code: ${order.redemptionCode}`)
} else {
  console.log('Order:', JSON.stringify(order, null, 2))
}
