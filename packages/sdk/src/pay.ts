import { emitEvent } from './events.js'
import { createWalletClient, getAddress, http, toHex } from 'viem'
import { base, arbitrum, mainnet, polygon, baseSepolia, bsc, bscTestnet } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import type { EVMWallet, SolanaWallet } from '@agenti/core'

// ---------------------------------------------------------------------------
// Network map — CAIP-2 chain IDs (eip155:<chainId>) as used by x402 v2, plus
// the legacy plain-name keys used by x402 v1 for backwards compatibility.
// ---------------------------------------------------------------------------
const EVM_NETWORKS: Record<string, typeof base | typeof arbitrum | typeof mainnet | typeof polygon | typeof baseSepolia | typeof bsc | typeof bscTestnet> = {
  // x402 v2 CAIP-2 format
  'eip155:8453': base,
  'eip155:42161': arbitrum,
  'eip155:1': mainnet,
  'eip155:137': polygon,
  'eip155:84532': baseSepolia,
  'eip155:56': bsc,
  'eip155:97': bscTestnet,
  // x402 v1 legacy plain-name format
  'base-mainnet': base,
  'arbitrum-mainnet': arbitrum,
  'ethereum-mainnet': mainnet,
  'polygon-mainnet': polygon,
  'bsc-mainnet': bsc,
} as const

// ---------------------------------------------------------------------------
// Payment requirement types — aligned with x402 core types.
// v1 uses `maxAmountRequired`; v2 uses `amount`.
// ---------------------------------------------------------------------------

/** A single payment option within a 402 response (x402 v1 shape). */
interface X402AcceptV1 {
  scheme: string
  network: string
  maxAmountRequired: string
  payTo: `0x${string}`
  maxTimeoutSeconds: number
  asset: `0x${string}`
  extra?: { name?: string; version?: string }
}

/** A single payment option within a 402 response (x402 v2 shape). */
interface X402AcceptV2 {
  scheme: string
  network: string
  /** Amount in the token's smallest unit (e.g. USDC: 6 decimals). */
  amount: string
  payTo: string
  maxTimeoutSeconds: number
  asset: string
  extra?: Record<string, unknown>
}

/** The full body returned by a 402 response (x402 v1). */
interface X402RequirementsV1 {
  x402Version: 1
  accepts: X402AcceptV1[]
}

/** The full body returned by a 402 response (x402 v2). */
interface X402RequirementsV2 {
  x402Version: 2
  resource: { url: string; description?: string }
  accepts: X402AcceptV2[]
  extensions?: Record<string, unknown>
}

type X402Requirements = X402RequirementsV1 | X402RequirementsV2

// ---------------------------------------------------------------------------
// Base64 helpers (safe for both Node.js and browser runtimes).
// Mirrors x402 core safeBase64Encode / safeBase64Decode.
// ---------------------------------------------------------------------------

function safeBase64Encode(data: string): string {
  if (typeof globalThis !== 'undefined' && typeof (globalThis as typeof globalThis & { btoa?: (s: string) => string }).btoa === 'function') {
    const bytes = new TextEncoder().encode(data)
    const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
    return (globalThis as typeof globalThis & { btoa: (s: string) => string }).btoa(binary)
  }
  return Buffer.from(data, 'utf8').toString('base64')
}

// ---------------------------------------------------------------------------
// EIP-3009 signature building
// ---------------------------------------------------------------------------

/**
 * Creates a cryptographically random 32-byte nonce as a hex string.
 * Mirrors x402 core createNonce().
 */
function createNonce(): `0x${string}` {
  const cryptoObj =
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
      ? globalThis.crypto
      : // eslint-disable-next-line @typescript-eslint/no-require-imports
        (require('crypto').webcrypto as typeof globalThis.crypto)
  return toHex(cryptoObj.getRandomValues(new Uint8Array(32)))
}

/**
 * Resolves a network string (either CAIP-2 "eip155:8453" or legacy
 * "base-mainnet") to a viem chain object.
 */
function resolveChain(network: string) {
  const chain = EVM_NETWORKS[network]
  if (!chain) throw new Error(`Unsupported x402 network: ${network}`)
  return chain
}

/**
 * Signs an EIP-3009 TransferWithAuthorization typed-data payload and returns
 * the full payment object encoded as a base64 string suitable for the
 * X-Payment / PAYMENT-SIGNATURE header.
 *
 * Key fixes vs. original implementation:
 * - validAfter is now set 10 minutes in the past (matches x402 reference impl)
 *   to avoid clock-skew rejections from facilitators.
 * - Addresses are checksummed via getAddress() before signing.
 * - Network normalisation handles both CAIP-2 (v2) and plain-name (v1) keys.
 * - The payment object is encoded as standard base64 (not base64url), which
 *   is what x402 facilitators expect.
 */
async function signEVMPayment(
  network: string,
  amount: string,
  payTo: string,
  asset: string,
  maxTimeoutSeconds: number,
  extra: { name?: string; version?: string } | Record<string, unknown> | undefined,
  wallet: EVMWallet,
  x402Version: number,
  scheme: string,
): Promise<string> {
  const chain = resolveChain(network)
  const account = privateKeyToAccount(wallet.privateKey)

  const now = Math.floor(Date.now() / 1000)
  // validAfter: 10 minutes in the past to absorb minor clock skew
  const validAfter = BigInt(now - 600).toString()
  const validBefore = BigInt(now + maxTimeoutSeconds).toString()
  const nonce = createNonce()

  const authorization = {
    from: account.address,
    to: getAddress(payTo as `0x${string}`),
    value: BigInt(amount),
    validAfter: BigInt(validAfter),
    validBefore: BigInt(validBefore),
    nonce,
  }

  const walletClient = createWalletClient({ account, chain, transport: http() })

  const extraTyped = extra as { name?: string; version?: string } | undefined

  const signature = await walletClient.signTypedData({
    domain: {
      name: extraTyped?.name ?? 'USD Coin',
      version: extraTyped?.version ?? '2',
      chainId: chain.id,
      verifyingContract: getAddress(asset as `0x${string}`),
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
    message: authorization,
  })

  // Payment payload shape matches x402 core PaymentPayload (both v1 and v2).
  // Numeric BigInt values must be stringified for safe JSON serialisation.
  const payment = {
    x402Version,
    scheme,
    network,
    payload: {
      signature,
      authorization: {
        from: authorization.from,
        to: authorization.to,
        value: authorization.value.toString(),
        validAfter: validAfter,
        validBefore: validBefore,
        nonce,
      },
    },
  }

  // Encode as standard base64 (mirrors x402 core safeBase64Encode(JSON.stringify(payload))).
  return safeBase64Encode(JSON.stringify(payment))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Makes an HTTP request, automatically handling 402 Payment Required responses
 * by building and attaching an EIP-3009 payment header.
 *
 * Supports both x402 protocol v1 (X-Payment header, body-based requirements)
 * and v2 (PAYMENT-SIGNATURE header, PAYMENT-REQUIRED header).
 *
 * For Solana networks, delegates to the agenti Solana payments module.
 */
export async function pay(
  url: string,
  evmWallet: EVMWallet,
  solanaWallet: SolanaWallet,
  options?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, options)
  if (response.status !== 402) return response

  // ------------------------------------------------------------------
  // Parse payment requirements.
  // v2: requirements are in the PAYMENT-REQUIRED response header (base64).
  // v1: requirements are the JSON response body.
  // ------------------------------------------------------------------
  let requirements: X402Requirements | undefined

  const paymentRequiredHeader = response.headers.get('PAYMENT-REQUIRED')
  if (paymentRequiredHeader) {
    // v2 header-based requirements
    try {
      const decoded =
        typeof globalThis !== 'undefined' && typeof (globalThis as typeof globalThis & { atob?: (s: string) => string }).atob === 'function'
          ? (() => {
              const atob = (globalThis as typeof globalThis & { atob: (s: string) => string }).atob
              const binary = atob(paymentRequiredHeader)
              const bytes = new Uint8Array(binary.length)
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
              return new TextDecoder('utf-8').decode(bytes)
            })()
          : Buffer.from(paymentRequiredHeader, 'base64').toString('utf-8')
      requirements = JSON.parse(decoded) as X402Requirements
    } catch {
      // fall through to body parse
    }
  }

  if (!requirements) {
    try {
      requirements = (await response.json()) as X402Requirements
    } catch {
      return response
    }
  }

  if (!requirements || !requirements.accepts?.length) return response

  // Non-null assertion is safe: we just checked accepts.length > 0
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const accept = requirements.accepts[0]!
  const version = requirements.x402Version ?? 1

  // ------------------------------------------------------------------
  // Determine amount — v2 uses `amount`, v1 uses `maxAmountRequired`.
  // ------------------------------------------------------------------
  const amount =
    'amount' in accept
      ? (accept as X402AcceptV2).amount
      : (accept as X402AcceptV1).maxAmountRequired

  const maxTimeoutSeconds =
    'maxTimeoutSeconds' in accept ? accept.maxTimeoutSeconds : 300

  // ------------------------------------------------------------------
  // Route to the correct payment implementation.
  // ------------------------------------------------------------------
  if (accept.network.toLowerCase().includes('solana')) {
    const { createX402Fetch } = await import('./solana/payments.js')
    const { Keypair, Connection, clusterApiUrl } = await import('@solana/web3.js')
    const keypair = Keypair.fromSecretKey(solanaWallet.privateKey)
    const connection = new Connection(clusterApiUrl('mainnet-beta'))
    const solFetch = createX402Fetch(keypair, connection)
    return solFetch(url, options)
  }

  // EVM: build EIP-3009 TransferWithAuthorization signature
  const paymentHeader = await signEVMPayment(
    accept.network,
    amount,
    accept.payTo,
    accept.asset,
    maxTimeoutSeconds,
    accept.extra,
    evmWallet,
    version,
    accept.scheme,
  )

  // ------------------------------------------------------------------
  // Choose correct header name per protocol version.
  // v2 uses PAYMENT-SIGNATURE; v1 uses X-Payment.
  // Both are accepted by most facilitators for backwards compatibility.
  // ------------------------------------------------------------------
  const headerName = version >= 2 ? 'PAYMENT-SIGNATURE' : 'X-Payment'

  const result = await fetch(url, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      [headerName]: paymentHeader,
      // Always include the v1 header too so cross-version servers work
      'X-Payment': paymentHeader,
    },
  })

  emitEvent({ type: 'pay', url, amount, network: accept.network, ts: Date.now() })

  return result
}
