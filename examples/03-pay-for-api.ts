/**
 * Example 3: Call an x402-gated API
 *
 * The agent detects a 402 Payment Required response, signs an
 * EIP-3009 USDC transfer on Base, and retries the request automatically.
 *
 * Run:
 *   EVM_KEY=0x... npx tsx examples/03-pay-for-api.ts
 */

import { agenti } from '@agenti/sdk'

const agent = agenti({ evm: { privateKey: process.env.EVM_KEY as `0x${string}` } })
const res = await agent.pay('https://api.example.com/data')
console.log(await res.json())
