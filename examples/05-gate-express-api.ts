/**
 * Example 5: Express API gated by x402 payment
 *
 * Any client without a valid payment header gets a 402 with the
 * exact payment requirements. Agenti-powered clients pay and retry.
 *
 * Run:
 *   RECEIVER_ADDRESS=0x... npx tsx examples/05-gate-express-api.ts
 */

import express from 'express'
import { withPaymentExpress } from '@agenti/sdk'

const app = express()

app.get(
  '/premium',
  withPaymentExpress(
    async (_req, res) => res.json({ secret: 'hello paying customer' }),
    {
      amount: '10000',  // 0.01 USDC (6 decimals)
      address: process.env.RECEIVER_ADDRESS as `0x${string}`,
    },
  ),
)

app.listen(3000, () => console.log('Listening on http://localhost:3000'))
