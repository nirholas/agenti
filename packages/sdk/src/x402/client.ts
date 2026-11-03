/**
 * Builds a payer-side x402 client on the official `@x402/*` packages.
 *
 * Signing, header encoding and spend controls all come from the Coinbase
 * reference implementation, so agenti stays wire-compatible with every
 * conformant server and facilitator. This module only adds what agenti needs
 * on top:
 *
 * - One client that pays on EVM (v2 CAIP-2 `eip155:*` plus every v1 network
 *   name the reference package knows) and Solana (`solana:*` plus v1 names).
 * - Legacy network aliases (`base-mainnet`, `solana-mainnet`, `mainnet-beta`,
 *   ...) that agenti's own facilitator and older x402 servers still emit.
 * - A Solana signer that is derived lazily, so a caller with only an EVM key
 *   can still pay EVM-priced resources.
 */
import { x402Client } from '@x402/core/client'
import type { SpendControls } from '@x402/core/client'
import type {
  PaymentPayloadContext,
  PaymentPayloadResult,
  PaymentRequirements,
  SchemeNetworkClient,
} from '@x402/core/types'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { ExactEvmSchemeV1 } from '@x402/evm/exact/v1/client'
import { NETWORKS as EVM_V1_NETWORKS } from '@x402/evm/v1'
import { findDefaultAsset as findEvmDefaultAsset } from '@x402/evm'
import { ExactSvmScheme } from '@x402/svm/exact/client'
import { ExactSvmSchemeV1 } from '@x402/svm/exact/v1/client'
import { NETWORKS as SVM_V1_NETWORKS } from '@x402/svm/v1'
import { findDefaultAsset as findSvmDefaultAsset } from '@x402/svm'
import { createKeyPairSignerFromBytes } from '@solana/kit'
import type { KeyPairSigner } from '@solana/kit'
import { privateKeyToAccount } from 'viem/accounts'
import type { EVMWallet, SolanaWallet } from '@agenti/core'

/** CAIP-2 ids of the Solana clusters x402 settles on. */
export const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
export const SOLANA_DEVNET_CAIP2 = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'

/**
 * v1 EVM network names used by agenti's facilitator and other pre-standard
 * servers that the reference package does not list, mapped to chain ids.
 */
export const LEGACY_EVM_NETWORKS: Readonly<Record<string, number>> = {
  'base-mainnet': 8453,
  'ethereum-mainnet': 1,
  'polygon-mainnet': 137,
  'arbitrum-mainnet': 42161,
  arbitrum: 42161,
  'arbitrum-sepolia': 421614,
  optimism: 10,
  'optimism-mainnet': 10,
  'bsc-mainnet': 56,
  bsc: 56,
  'bsc-testnet': 97,
}

/** v1 Solana aliases mapped to the names the reference package signs for. */
export const LEGACY_SOLANA_NETWORKS: Readonly<Record<string, string>> = {
  'solana-mainnet': 'solana',
  'mainnet-beta': 'solana',
  devnet: 'solana-devnet',
}

const V1_SOLANA_CAIP2: Readonly<Record<string, string>> = {
  solana: SOLANA_MAINNET_CAIP2,
  'solana-devnet': SOLANA_DEVNET_CAIP2,
}

export interface AgentiX402ClientOptions {
  /** EVM key used for EIP-3009 / Permit2 authorizations. */
  evm?: EVMWallet
  /** Solana keypair (64-byte secret key) used for SPL transfer payloads. */
  solana?: SolanaWallet
  /**
   * Solana RPC used to build payment transactions. Defaults to the
   * SOLANA_RPC_URL environment variable, then the reference package's
   * public endpoint for the cluster being paid on.
   */
  solanaRpcUrl?: string
  /** EVM RPC used for gas-sponsoring extensions (EIP-2612 / ERC-20 approve). */
  evmRpcUrl?: string
  /**
   * Spend controls applied by the reference client before anything is signed.
   * Omit for the reference default: only well-known stablecoins, at most $1
   * per payment. Pass `false` to disable when you enforce limits yourself.
   */
  spendControls?: SpendControls | false
}

function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  const value = env?.[name]
  return value && value.length > 0 ? value : undefined
}

/**
 * Wraps a scheme so it signs requirements for an alias network under the
 * name the reference implementation understands, then reports the network
 * the server asked for, so the server sees its own requirements echoed back.
 */
class AliasedNetworkScheme implements SchemeNetworkClient {
  readonly scheme: string
  readonly findDefaultAsset: SchemeNetworkClient['findDefaultAsset']

  constructor(
    private readonly inner: SchemeNetworkClient,
    private readonly canonical: string,
    lookupNetwork: string,
    findDefault: NonNullable<SchemeNetworkClient['findDefaultAsset']>,
  ) {
    this.scheme = inner.scheme
    this.findDefaultAsset = (asset) => findDefault(asset, lookupNetwork as `${string}:${string}`)
  }

  async createPaymentPayload(
    x402Version: number,
    requirements: PaymentRequirements,
    context?: PaymentPayloadContext,
  ): Promise<PaymentPayloadResult> {
    const result = await this.inner.createPaymentPayload(
      x402Version,
      { ...requirements, network: this.canonical as PaymentRequirements['network'] },
      context,
    )
    if ('network' in result) {
      return { ...result, network: requirements.network } as PaymentPayloadResult
    }
    return result
  }
}

/**
 * Signs v1 requirements on chains the reference v1 scheme has no name for, by
 * translating them to their CAIP-2 form and signing with the v2 EVM scheme.
 * The EIP-3009 authorization is identical across protocol versions; only the
 * envelope differs, and this rebuilds the v1 envelope around it.
 */
class LegacyEvmV1Scheme implements SchemeNetworkClient {
  readonly scheme = 'exact'
  readonly findDefaultAsset: SchemeNetworkClient['findDefaultAsset']

  constructor(
    private readonly v2: ExactEvmScheme,
    private readonly chainId: number,
  ) {
    this.findDefaultAsset = (asset) => findEvmDefaultAsset(asset, `eip155:${chainId}`)
  }

  async createPaymentPayload(
    _x402Version: number,
    requirements: PaymentRequirements,
  ): Promise<PaymentPayloadResult> {
    const v1 = requirements as PaymentRequirements & { maxAmountRequired?: string }
    const amount = v1.maxAmountRequired ?? requirements.amount
    const signed = await this.v2.createPaymentPayload(2, {
      ...requirements,
      network: `eip155:${this.chainId}`,
      amount,
    })
    return {
      x402Version: 1,
      scheme: requirements.scheme,
      network: requirements.network,
      payload: signed.payload,
    } as PaymentPayloadResult
  }
}

/**
 * Derives the Solana signer on first use. Key validation happens here rather
 * than at construction, so an EVM-only caller is never blocked by a missing
 * or placeholder Solana key, while a Solana payment with a bad key fails with
 * the real reason.
 */
class LazySvmScheme implements SchemeNetworkClient {
  readonly scheme = 'exact'
  readonly findDefaultAsset = findSvmDefaultAsset
  private inner: Promise<SchemeNetworkClient> | undefined

  constructor(
    private readonly signer: () => Promise<KeyPairSigner>,
    private readonly build: (signer: KeyPairSigner) => SchemeNetworkClient,
  ) {}

  async createPaymentPayload(
    x402Version: number,
    requirements: PaymentRequirements,
    context?: PaymentPayloadContext,
  ): Promise<PaymentPayloadResult> {
    this.inner ??= this.signer().then(this.build)
    const scheme = await this.inner.catch((err: unknown) => {
      this.inner = undefined
      throw err
    })
    return scheme.createPaymentPayload(x402Version, requirements, context)
  }
}

function solanaSignerFactory(wallet: SolanaWallet): () => Promise<KeyPairSigner> {
  let pending: Promise<KeyPairSigner> | undefined
  return () => {
    pending ??= createKeyPairSignerFromBytes(wallet.privateKey).catch((err: unknown) => {
      pending = undefined
      const reason = err instanceof Error ? err.message : String(err)
      throw new Error(`Solana wallet ${wallet.address} cannot sign x402 payments: ${reason}`)
    })
    return pending
  }
}

/**
 * Creates an official x402 client wired with agenti's EVM and Solana wallets.
 * Use it directly with `@x402/fetch` or `@x402/axios`, or through `pay()`.
 */
export function createAgentiX402Client(options: AgentiX402ClientOptions): x402Client {
  const client = new x402Client()

  if (options.evm) {
    const account = privateKeyToAccount(options.evm.privateKey)
    const evmRpcUrl = options.evmRpcUrl ?? readEnv('EVM_RPC_URL')
    const v2 = new ExactEvmScheme(account, evmRpcUrl ? { rpcUrl: evmRpcUrl } : undefined)
    client.register('eip155:*', v2)
    const v1 = new ExactEvmSchemeV1(account)
    for (const network of EVM_V1_NETWORKS) client.registerV1(network, v1)
    for (const [network, chainId] of Object.entries(LEGACY_EVM_NETWORKS)) {
      client.registerV1(network, new LegacyEvmV1Scheme(v2, chainId))
    }
  }

  if (options.solana) {
    const rpcUrl = options.solanaRpcUrl ?? readEnv('SOLANA_RPC_URL')
    const config = rpcUrl ? { rpcUrl } : undefined
    const signer = solanaSignerFactory(options.solana)
    client.register('solana:*', new LazySvmScheme(signer, (s) => new ExactSvmScheme(s, config)))
    const v1 = new LazySvmScheme(signer, (s) => new ExactSvmSchemeV1(s, config))
    for (const network of SVM_V1_NETWORKS) client.registerV1(network, v1)
    for (const [alias, canonical] of Object.entries(LEGACY_SOLANA_NETWORKS)) {
      const lookup = V1_SOLANA_CAIP2[canonical] ?? SOLANA_MAINNET_CAIP2
      client.registerV1(alias, new AliasedNetworkScheme(v1, canonical, lookup, findSvmDefaultAsset))
    }
  }

  if (options.spendControls !== undefined) client.setSpendControls(options.spendControls)
  return client
}
