import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, describe, expect, it } from 'vitest'
import { getAddress, verifyTypedData } from 'viem'
import { Keypair } from '@solana/web3.js'
import type { EVMWallet, SolanaWallet } from '@agenti/core'
import { pay } from '../pay.js'
import { agentiEvents } from '../events.js'

// Hardhat/Anvil account #0: a public test vector, never funded on mainnet.
const EVM_WALLET: EVMWallet = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
}
// All-zero secret key: deliberately unusable, so Solana options must fail.
const BAD_SOLANA_WALLET: SolanaWallet = {
  address: '11111111111111111111111111111111',
  privateKey: new Uint8Array(64),
}

// A real, freshly generated keypair: valid, unfunded, never used for value.
const generated = Keypair.generate()
const GOOD_SOLANA_WALLET: SolanaWallet = {
  address: generated.publicKey.toBase58(),
  privateKey: generated.secretKey,
}

const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const RECIPIENT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const SOLANA_DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'

interface Offer {
  network: string
  amount: string
  asset?: string
  payTo?: string
  /** Solana only: omit the facilitator fee payer, asking the payer to self-settle. */
  selfSettle?: boolean
}

function requirements(offer: Offer) {
  const evm = offer.network.startsWith('eip155:')
  return {
    scheme: 'exact',
    network: offer.network,
    amount: offer.amount,
    asset: offer.asset ?? (evm ? USDC_BASE_SEPOLIA : '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
    payTo: offer.payTo ?? (evm ? RECIPIENT : '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
    maxTimeoutSeconds: 120,
    extra: evm
      ? { name: 'USDC', version: '2' }
      : offer.selfSettle
        ? {}
        : { feePayer: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin' },
  }
}

/**
 * A real HTTP resource server speaking x402 v2. Unpaid requests get a 402 with
 * a PAYMENT-REQUIRED header; paid requests have their EIP-3009 signature
 * verified cryptographically before the resource is served.
 */
function startServer(offers: Offer[]) {
  const paid: Array<{ accepted: { network: string; amount: string }; signer: string }> = []
  const server = createServer(async (req, res) => {
    const signature = req.headers['payment-signature']
    if (typeof signature !== 'string') {
      const challenge = {
        x402Version: 2,
        resource: { url: `http://${req.headers.host}${req.url}`, description: 'test resource' },
        accepts: offers.map(requirements),
      }
      res.writeHead(402, {
        'Content-Type': 'application/json',
        'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(challenge)).toString('base64'),
      })
      res.end('{}')
      return
    }
    const payload = JSON.parse(Buffer.from(signature, 'base64').toString('utf8'))
    const { authorization, signature: sig } = payload.payload
    const chainId = Number(String(payload.accepted.network).split(':')[1])
    const valid = await verifyTypedData({
      address: getAddress(authorization.from),
      domain: {
        name: payload.accepted.extra.name,
        version: payload.accepted.extra.version,
        chainId,
        verifyingContract: getAddress(payload.accepted.asset),
      },
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      primaryType: 'TransferWithAuthorization',
      message: {
        from: getAddress(authorization.from),
        to: getAddress(authorization.to),
        value: BigInt(authorization.value),
        validAfter: BigInt(authorization.validAfter),
        validBefore: BigInt(authorization.validBefore),
        nonce: authorization.nonce,
      },
      signature: sig,
    })
    if (!valid || getAddress(authorization.to) !== getAddress(payload.accepted.payTo)) {
      res.writeHead(402, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'invalid signature' }))
      return
    }
    paid.push({ accepted: payload.accepted, signer: authorization.from })
    const settle = { success: true, transaction: '0xabc123', network: payload.accepted.network }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'PAYMENT-RESPONSE': Buffer.from(JSON.stringify(settle)).toString('base64'),
    })
    res.end(JSON.stringify({ ok: true }))
  })
  return { server, paid }
}

async function listen(offers: Offer[]) {
  const { server, paid } = startServer(offers)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return { url: `http://127.0.0.1:${port}/resource`, paid, close: () => server.close() }
}

describe('pay() on the official x402 client', () => {
  const servers: Array<() => void> = []
  afterAll(() => servers.forEach((close) => close()))

  it('pays a v2 challenge with a signature the server verifies', async () => {
    const s = await listen([{ network: 'eip155:84532', amount: '10000' }])
    servers.push(s.close)
    const events: Array<{ txHash?: string; amount: string }> = []
    const onPay = (e: Event) => events.push((e as CustomEvent).detail)
    agentiEvents.addEventListener('pay', onPay)

    const res = await pay(s.url, EVM_WALLET, BAD_SOLANA_WALLET)
    agentiEvents.removeEventListener('pay', onPay)

    expect(res.status).toBe(200)
    expect(s.paid).toHaveLength(1)
    expect(s.paid[0]?.signer).toBe(EVM_WALLET.address)
    expect(s.paid[0]?.accepted.amount).toBe('10000')
    expect(events.at(-1)).toMatchObject({ amount: '10000', txHash: '0xabc123' })
  })

  it('refuses before signing when every option exceeds maxAmount', async () => {
    const s = await listen([{ network: 'eip155:84532', amount: '5000000' }])
    servers.push(s.close)
    await expect(pay(s.url, EVM_WALLET, BAD_SOLANA_WALLET, { maxAmount: '1000000' })).rejects.toThrow(
      /exceeds maxAmount 1000000/,
    )
    expect(s.paid).toHaveLength(0)
  })

  it('applies the reference $1 default cap when no maxAmount is given', async () => {
    const s = await listen([{ network: 'eip155:84532', amount: '2000000' }])
    servers.push(s.close)
    await expect(pay(s.url, EVM_WALLET, BAD_SOLANA_WALLET)).rejects.toThrow(/Could not pay/)
    expect(s.paid).toHaveLength(0)
  })

  it('lets maxAmount raise the cap above $1', async () => {
    const s = await listen([{ network: 'eip155:84532', amount: '2000000' }])
    servers.push(s.close)
    const res = await pay(s.url, EVM_WALLET, BAD_SOLANA_WALLET, { maxAmount: 3_000_000n })
    expect(res.status).toBe(200)
    expect(s.paid[0]?.accepted.amount).toBe('2000000')
  })

  it('skips options above maxAmount and pays one within it', async () => {
    const s = await listen([
      { network: 'eip155:84532', amount: '900000' },
      { network: 'eip155:84532', amount: '400000', payTo: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
    ])
    servers.push(s.close)
    await pay(s.url, EVM_WALLET, BAD_SOLANA_WALLET, { maxAmount: '500000' })
    expect(s.paid[0]?.accepted.amount).toBe('400000')
  })

  it('falls back to the next network when the preferred one cannot be paid', async () => {
    const s = await listen([
      { network: SOLANA_DEVNET, amount: '10000' },
      { network: 'eip155:84532', amount: '10000' },
    ])
    servers.push(s.close)
    const res = await pay(s.url, EVM_WALLET, BAD_SOLANA_WALLET, { preferNetworks: ['solana:*'] })
    expect(res.status).toBe(200)
    expect(s.paid[0]?.accepted.network).toBe('eip155:84532')
  })

  it('explains why when no offered network can be paid', async () => {
    const s = await listen([{ network: SOLANA_DEVNET, amount: '10000' }])
    servers.push(s.close)
    await expect(pay(s.url, EVM_WALLET, BAD_SOLANA_WALLET)).rejects.toThrow(
      /Solana wallet 1{32} cannot sign x402 payments/,
    )
  })

  it('refuses a self-settled Solana payment over the $1 default before touching the key', async () => {
    const s = await listen([
      { network: SOLANA_DEVNET, amount: '2000000', selfSettle: true },
      { network: 'eip155:84532', amount: '10000' },
    ])
    servers.push(s.close)
    const res = await pay(s.url, EVM_WALLET, GOOD_SOLANA_WALLET)
    expect(res.status).toBe(200)
    expect(s.paid[0]?.accepted.network).toBe('eip155:84532')
  })

  it('refuses a self-settled Solana payment in a non-default token', async () => {
    const s = await listen([
      { network: SOLANA_DEVNET, amount: '10', selfSettle: true, asset: 'So11111111111111111111111111111111111111112' },
    ])
    servers.push(s.close)
    await expect(pay(s.url, EVM_WALLET, GOOD_SOLANA_WALLET)).rejects.toThrow(/not a default stablecoin/)
  })

  it('reports an unusable Solana key on a self-settled challenge', async () => {
    const s = await listen([{ network: SOLANA_DEVNET, amount: '10000', selfSettle: true }])
    servers.push(s.close)
    await expect(pay(s.url, EVM_WALLET, BAD_SOLANA_WALLET)).rejects.toThrow(
      /Solana wallet 1{32} cannot sign x402 payments/,
    )
  })
})
