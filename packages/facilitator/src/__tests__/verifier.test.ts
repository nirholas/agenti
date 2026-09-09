import { describe, it, expect, beforeEach } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'
import { verifyPayment } from '../verifier.js'
import { getChain, resolveNetworkPair, CHAINS } from '../chains.js'
import { markNonce } from '../nonce-store.js'
import type { PaymentPayload, PaymentRequired } from '../types.js'

// A throwaway key. Signatures below are produced for real by viem, so the
// verifier runs its true EIP-712 path rather than a stubbed one.
const PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const
const account = privateKeyToAccount(PRIVATE_KEY)

const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const PAY_TO = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

let nonceCounter = 0
function freshNonce(): `0x${string}` {
  nonceCounter += 1
  return `0x${nonceCounter.toString(16).padStart(64, '0')}` as `0x${string}`
}

/**
 * Signs a genuine EIP-3009 authorization for `chainId`, so a network-mismatch
 * test exercises a payload that is internally valid and only wrong about which
 * chain it belongs to.
 */
async function signedPayment(opts: {
  chainId: number
  network: string
  value?: string
  to?: string
  asset?: string
}): Promise<PaymentPayload> {
  const now = Math.floor(Date.now() / 1000)
  const authorization = {
    from: account.address,
    to: (opts.to ?? PAY_TO) as `0x${string}`,
    value: opts.value ?? '100000',
    validAfter: String(now - 60),
    validBefore: String(now + 600),
    nonce: freshNonce(),
  }

  const signature = await account.signTypedData({
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: opts.chainId,
      verifyingContract: (opts.asset ?? BASE_USDC) as `0x${string}`,
    },
    types: TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: authorization.from,
      to: authorization.to,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  })

  return {
    x402Version: 2,
    scheme: 'exact',
    network: opts.network,
    payload: { signature, authorization },
  }
}

function requirements(overrides: Partial<PaymentRequired> = {}): PaymentRequired {
  return {
    asset: BASE_USDC,
    payTo: PAY_TO,
    amount: '100000',
    network: 'eip155:8453',
    ...overrides,
  }
}

describe('resolveNetworkPair', () => {
  it('accepts a CAIP-2 payment against the same CAIP-2 requirement', () => {
    const r = resolveNetworkPair('eip155:8453', 'eip155:8453')
    expect(r).toEqual({ chain: expect.objectContaining({ caip2: 'eip155:8453' }) })
  })

  it('accepts a legacy v1 alias against its CAIP-2 equivalent', () => {
    const r = resolveNetworkPair('base-mainnet', 'eip155:8453')
    expect('chain' in r && r.chain.caip2).toBe('eip155:8453')
  })

  it('rejects a payment on a different chain than was required', () => {
    const r = resolveNetworkPair('eip155:84532', 'eip155:8453')
    expect('error' in r && r.error).toContain('Network mismatch')
  })

  it('rejects a network it does not support', () => {
    const r = resolveNetworkPair('eip155:999999', 'eip155:8453')
    expect('error' in r && r.error).toContain('Unsupported network')
  })

  it('rejects requirements naming an unsupported network', () => {
    const r = resolveNetworkPair('eip155:8453', 'eip155:999999')
    expect('error' in r && r.error).toContain('Unsupported required network')
  })
})

describe('getChain', () => {
  it('resolves every chain by its CAIP-2 id and by each alias', () => {
    for (const chain of CHAINS) {
      expect(getChain(chain.caip2)?.caip2).toBe(chain.caip2)
      for (const alias of chain.aliases) {
        expect(getChain(alias)?.caip2).toBe(chain.caip2)
      }
    }
  })

  it('returns undefined for an unknown network', () => {
    expect(getChain('solana:mainnet')).toBeUndefined()
  })
})

describe('verifyPayment', () => {
  beforeEach(() => {
    nonceCounter = Math.floor(Math.random() * 1_000_000)
  })

  it('accepts a correctly signed authorization on the required network', async () => {
    const payment = await signedPayment({ chainId: 8453, network: 'eip155:8453' })
    await expect(verifyPayment(payment, requirements())).resolves.toEqual({ valid: true })
  })

  it('accepts a v1 alias network that resolves to the required chain', async () => {
    const payment = await signedPayment({ chainId: 8453, network: 'base-mainnet' })
    await expect(verifyPayment(payment, requirements())).resolves.toEqual({ valid: true })
  })

  it('rejects an authorization signed for a different chain than required', async () => {
    // Signed for Base Sepolia and claiming it, while the resource wants Base mainnet.
    const payment = await signedPayment({ chainId: 84532, network: 'eip155:84532' })
    const result = await verifyPayment(payment, requirements())
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Network mismatch')
  })

  it('rejects a payload that claims the required network but was signed for another', async () => {
    // The signature's domain says Base Sepolia; the payload lies and says Base.
    const payment = await signedPayment({ chainId: 84532, network: 'eip155:8453' })
    const result = await verifyPayment(payment, requirements())
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Signer does not match from address')
  })

  it('rejects payment to a recipient other than the one required', async () => {
    const payment = await signedPayment({
      chainId: 8453,
      network: 'eip155:8453',
      to: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    })
    const result = await verifyPayment(payment, requirements())
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Payment recipient mismatch')
  })

  it('rejects an authorization worth less than the required amount', async () => {
    const payment = await signedPayment({ chainId: 8453, network: 'eip155:8453', value: '1' })
    const result = await verifyPayment(payment, requirements())
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Insufficient payment amount')
  })

  it('rejects an expired authorization', async () => {
    const payment = await signedPayment({ chainId: 8453, network: 'eip155:8453' })
    payment.payload.authorization.validBefore = String(Math.floor(Date.now() / 1000) - 1)
    const result = await verifyPayment(payment, requirements())
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Payment expired')
  })

  it('rejects a nonce that has already been settled', async () => {
    const payment = await signedPayment({ chainId: 8453, network: 'eip155:8453' })
    markNonce(
      payment.payload.authorization.from,
      payment.payload.authorization.nonce,
      BigInt(payment.payload.authorization.validBefore),
    )
    const result = await verifyPayment(payment, requirements())
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Nonce already used')
  })
})
