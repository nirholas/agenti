#!/usr/bin/env node
/**
 * End-to-end proof that a 402-gated handler never runs for an unsettled payment.
 *
 * This is the failure reported as issue #111: the SDK's HTTP wrappers verified
 * a payment signature and then ran the handler, so work was delivered against
 * an authorization that had never been settled and could be replayed. The unit
 * tests pin the ordering against a stubbed facilitator; this runs the real
 * facilitator over real HTTP with real EIP-3009 signatures, because a wrapper
 * that only behaves under a mock has not been proven.
 *
 * The facilitator here has no settler key, so settlement genuinely cannot
 * happen. A correct gate refuses every request. A gate that ships work on
 * verification alone leaks the handler's output, which is what this catches.
 */
import express from 'express'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { withPaymentExpress } from '@agenti/sdk/serve'
import { privateKeyToAccount } from 'viem/accounts'

const FACILITATOR_PORT = 4399
const API_PORT = 4111
const FACILITATOR_URL = `http://localhost:${FACILITATOR_PORT}`

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const PAY_TO = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const SECRET = 'PAID CONTENT'

// A well-known test key. It signs real authorizations; nothing is broadcast.
const account = privateKeyToAccount(
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
)

const TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
}

async function paymentHeader({ chainId = 8453, network = 'eip155:8453' } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const authorization = {
    from: account.address,
    to: PAY_TO,
    value: '100000',
    validAfter: String(now - 60),
    validBefore: String(now + 600),
    nonce: `0x${Math.floor(Math.random() * 1e15).toString(16).padStart(64, '0')}`,
  }
  const signature = await account.signTypedData({
    domain: { name: 'USD Coin', version: '2', chainId, verifyingContract: USDC_BASE },
    types: TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      ...authorization,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
    },
  })
  return Buffer.from(
    JSON.stringify({ x402Version: 2, scheme: 'exact', network, payload: { signature, authorization } }),
    'utf8',
  ).toString('base64')
}

const facilitator = spawn(
  process.execPath,
  [new URL('../../packages/facilitator/dist/bin.js', import.meta.url).pathname, '--port', String(FACILITATOR_PORT)],
  { stdio: 'ignore' },
)

let handlerRuns = 0
const app = express()

const gateConfig = {
  amount: '100000',
  address: PAY_TO,
  token: USDC_BASE,
  network: 'eip155:8453',
  facilitatorUrl: FACILITATOR_URL,
}

function paidHandler(_req, res) {
  handlerRuns += 1
  res.json({ secret: SECRET })
}

app.get('/premium', withPaymentExpress(paidHandler, gateConfig))

// The same gate in soft-gate mode. This route proves the SDK can actually read
// the bundled facilitator's verify verdict, which the settling route cannot
// show on its own because settlement is deliberately impossible here.
app.get('/soft', withPaymentExpress(paidHandler, { ...gateConfig, mode: 'verify' }))
const server = app.listen(API_PORT)
await new Promise((resolve) => server.once('listening', resolve))

// Wait for the facilitator to answer before sending anything at it.
for (let attempt = 0; attempt < 20; attempt += 1) {
  try {
    const res = await fetch(`${FACILITATOR_URL}/health`)
    if (res.ok) break
  } catch {
    // not up yet
  }
  await sleep(250)
}

const results = []

async function scenario(label, header, { path = '/premium', expectHandler = false } = {}) {
  const before = handlerRuns
  const res = await fetch(`http://localhost:${API_PORT}${path}`, {
    headers: header ? { 'PAYMENT-SIGNATURE': header } : {},
  })
  const body = await res.text()
  const ran = handlerRuns > before
  const leaked = body.includes(SECRET)
  const ok = expectHandler ? res.status === 200 && ran : res.status !== 200 && !ran && !leaked
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(42)} ${res.status}  handler_ran=${String(ran).padEnd(5)} leaked=${leaked}`,
  )
  results.push(ok)
}

await scenario('no payment offered', undefined)
await scenario(
  'signature for a chain not required',
  await paymentHeader({ chainId: 84532, network: 'eip155:84532' }),
)
await scenario('valid signature, settlement impossible', await paymentHeader())

// Soft gate: verification is the whole check, so a good signature gets through
// and a bad one does not. This is what proves the verify verdict is being read.
await scenario('soft gate, valid signature', await paymentHeader(), {
  path: '/soft',
  expectHandler: true,
})
await scenario(
  'soft gate, signature for the wrong chain',
  await paymentHeader({ chainId: 84532, network: 'eip155:84532' }),
  { path: '/soft' },
)

server.close()
facilitator.kill()

if (results.some((ok) => !ok)) {
  console.error('\nFAIL: a handler ran, or paid content escaped, without a settled payment.')
  process.exit(1)
}
console.log('\nThe gate held: no handler ran and no paid content escaped without settlement.')
