/**
 * Upto EVM Client Scheme
 *
 * Client-side implementation of the upto payment scheme for EVM chains.
 * Handles ERC-2612 permit signing with reactive caching - permits are
 * cached and re-used until the server rejects them (cap exhausted, expired).
 *
 * @example
 * ```typescript
 * import { x402Client, x402HTTPClient } from "@x402/core/client";
 * import { registerUptoEvmClientScheme } from "@daydreamsai/facilitator/upto";
 *
 * const x402 = new x402Client();
 * registerUptoEvmClientScheme(x402, {
 *   signer: account,
 *   publicClient,
 *   facilitatorUrl: "http://localhost:8090",
 * });
 *
 * const httpClient = new x402HTTPClient(x402);
 * const payload = await httpClient.createPaymentPayload(paymentRequired);
 * ```
 */

import type { Address, Hex } from "viem";
import { getAddress } from "viem";
import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkClient,
} from "@x402/core/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Signer interface for permit signing.
 * Compatible with viem's Account type.
 */
export interface UptoEvmClientSigner {
  address: Address;
  signTypedData: (params: {
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: Address;
    };
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<Hex>;
}

/**
 * Minimal public client interface for reading contract state.
 * Compatible with viem's PublicClient.
 */
export interface UptoEvmPublicClient {
  readContract: (params: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
  }) => Promise<unknown>;
}

export interface UptoEvmClientSchemeConfig {
  /** Wallet signer for permit signatures */
  signer: UptoEvmClientSigner;
  /** Public client for reading contract state (nonces) */
  publicClient: UptoEvmPublicClient;
  /** Facilitator URL for fetching signer address (optional if signer is configured locally) */
  facilitatorUrl?: string;
  /** Facilitator signer address (local override, skips /supported lookup) */
  facilitatorSigner?: Address;
  /** Facilitator signer mapping by network (local override, skips /supported lookup) */
  facilitatorSignerByNetwork?: Record<string, Address>;
  /** Deadline buffer in seconds (default: 60) */
  deadlineBufferSec?: number;
}

export interface UptoEvmClientConfig extends UptoEvmClientSchemeConfig {
  /** Optional specific networks to register (defaults to eip155:*) */
  networks?: string | string[];
}

// ============================================================================
// Constants
// ============================================================================

const NONCES_ABI = [
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "nonce", type: "uint256" }],
  },
] as const;

const PERMIT_TYPES: Record<string, Array<{ name: string; type: string }>> = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

// ============================================================================
// Permit Cache
// ============================================================================

interface CachedPermit {
  payload: Pick<PaymentPayload, "x402Version" | "payload">;
  deadline: bigint;
  /** Cache key for invalidation */
  key: string;
}

/**
 * Simple reactive permit cache.
 * Permits are cached and re-used until deadline expires.
 * Server errors (cap_exhausted, session_closed) should trigger invalidation.
 */
class PermitCache {
  private cache = new Map<string, CachedPermit>();
  private deadlineBufferSec: number;

  constructor(deadlineBufferSec = 60) {
    this.deadlineBufferSec = deadlineBufferSec;
  }

  /**
   * Generate cache key from requirements.
   * Key is based on network + asset + owner + spender (facilitator).
   */
  static createKey(
    network: string,
    asset: Address,
    owner: Address,
    spender: Address
  ): string {
    return `${network}:${asset.toLowerCase()}:${owner.toLowerCase()}:${spender.toLowerCase()}`;
  }

  get(key: string): CachedPermit | undefined {
    const cached = this.cache.get(key);
    if (!cached) return undefined;

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (cached.deadline <= now + BigInt(this.deadlineBufferSec)) {
      this.cache.delete(key);
      return undefined;
    }

    return cached;
  }

  set(key: string, permit: CachedPermit): void {
    this.cache.set(key, permit);
  }

  /** Invalidate a cached permit (call on server rejection) */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /** Invalidate all permits for a network/asset/owner combination */
  invalidateForOwner(network: string, asset: Address, owner: Address): void {
    const prefix = `${network}:${asset.toLowerCase()}:${owner.toLowerCase()}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

// ============================================================================
// Facilitator Signer Cache
// ============================================================================

async function fetchFacilitatorSigner(
  facilitatorUrl: string,
  network: string
): Promise<Address> {
  const res = await fetch(`${facilitatorUrl}/supported`);
  const supported = (await res.json()) as {
    signers?: Record<string, string[]>;
  };

  // Try exact network match first, then wildcard
  const signers =
    supported.signers?.[network] ?? supported.signers?.["eip155:*"] ?? [];

  if (signers.length === 0) {
    throw new Error(`No facilitator signer found for network ${network}`);
  }

  return getAddress(signers[0]) as Address;
}

// ============================================================================
// Client Scheme
// ============================================================================

export class UptoEvmClientScheme implements SchemeNetworkClient {
  readonly scheme = "upto";

  private readonly signer: UptoEvmClientSigner;
  private readonly publicClient: UptoEvmPublicClient;
  private readonly facilitatorUrl?: string;
  private readonly facilitatorSigner?: Address;
  private readonly facilitatorSignerByNetwork?: Record<string, Address>;
  private readonly permitCache: PermitCache;
  private facilitatorSignerCache = new Map<string, Address>();

  constructor(config: UptoEvmClientSchemeConfig) {
    const hasLocalSigner =
      !!config.facilitatorSigner ||
      (config.facilitatorSignerByNetwork &&
        Object.keys(config.facilitatorSignerByNetwork).length > 0);

    if (!config.facilitatorUrl && !hasLocalSigner) {
      throw new Error(
        "UptoEvmClientScheme requires facilitatorUrl or local facilitator signer configuration."
      );
    }

    this.signer = config.signer;
    this.publicClient = config.publicClient;
    this.facilitatorUrl = config.facilitatorUrl;
    this.facilitatorSigner = config.facilitatorSigner;
    this.facilitatorSignerByNetwork = config.facilitatorSignerByNetwork;
    this.permitCache = new PermitCache(config.deadlineBufferSec ?? 60);
  }

  /**
   * Invalidate cached permit for a specific session.
   * Call this when server returns cap_exhausted or session_closed.
   */
  invalidatePermit(network: string, asset: Address): void {
    this.permitCache.invalidateForOwner(
      network,
      asset,
      this.signer.address
    );
  }

  private async getFacilitatorSigner(network: string): Promise<Address> {
    const cached = this.facilitatorSignerCache.get(network);
    if (cached) return cached;

    const signer = await this.resolveFacilitatorSigner(network);
    this.facilitatorSignerCache.set(network, signer);
    return signer;
  }

  private async resolveFacilitatorSigner(network: string): Promise<Address> {
    if (this.facilitatorSignerByNetwork?.[network]) {
      return getAddress(this.facilitatorSignerByNetwork[network]) as Address;
    }

    const wildcard = this.facilitatorSignerByNetwork?.["eip155:*"];
    if (wildcard) {
      return getAddress(wildcard) as Address;
    }

    if (this.facilitatorSigner) {
      return getAddress(this.facilitatorSigner) as Address;
    }

    if (!this.facilitatorUrl) {
      throw new Error(`No facilitator signer configured for ${network}`);
    }

    return fetchFacilitatorSigner(this.facilitatorUrl, network);
  }

  async createPaymentPayload(
    x402Version: number,
    requirements: PaymentRequirements
  ): Promise<Pick<PaymentPayload, "x402Version" | "payload">> {
    const owner = getAddress(this.signer.address);
    const spender = await this.getFacilitatorSigner(requirements.network);
    const asset = getAddress(requirements.asset) as Address;

    const cacheKey = PermitCache.createKey(
      requirements.network,
      asset,
      owner,
      spender
    );

    // Check cache first
    const cached = this.permitCache.get(cacheKey);
    if (cached) {
      return cached.payload;
    }

    // Extract permit domain from requirements
    const extra = requirements.extra as Record<string, unknown> | undefined;
    const name = extra?.name as string | undefined;
    const version = extra?.version as string | undefined;

    if (!name || !version) {
      throw new Error("Requirements missing ERC-2612 domain name/version in extra");
    }

    // Determine cap (maxAmountRequired or fall back to amount)
    const maxAmountRequired = BigInt(
      (extra?.maxAmountRequired as string | undefined) ??
        (extra?.maxAmount as string | undefined) ??
        requirements.amount
    );

    // Get nonce from contract
    const nonce = (await this.publicClient.readContract({
      address: asset,
      abi: NONCES_ABI,
      functionName: "nonces",
      args: [owner],
    })) as bigint;

    // Calculate deadline
    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds
    );

    const chainId = Number(requirements.network.split(":")[1]);

    // Sign permit
    const signature = await this.signer.signTypedData({
      domain: {
        name,
        version,
        chainId,
        verifyingContract: asset,
      },
      types: PERMIT_TYPES,
      primaryType: "Permit",
      message: {
        owner,
        spender,
        value: maxAmountRequired,
        nonce,
        deadline,
      },
    });

    const payload: Pick<PaymentPayload, "x402Version" | "payload"> = {
      x402Version,
      payload: {
        authorization: {
          from: owner,
          to: spender,
          value: maxAmountRequired.toString(),
          validBefore: deadline.toString(),
          nonce: nonce.toString(),
        },
        signature,
      },
    };

    // Cache the permit
    this.permitCache.set(cacheKey, {
      payload,
      deadline,
      key: cacheKey,
    });

    return payload;
  }
}

// ============================================================================
// Registration Helper
// ============================================================================

/**
 * Register the upto EVM client scheme with an x402 client.
 *
 * @example
 * ```typescript
 * const x402 = new x402Client();
 * registerUptoEvmClientScheme(x402, {
 *   signer: account,
 *   publicClient,
 *   facilitatorUrl: "http://localhost:8090",
 * });
 * ```
 */
export function registerUptoEvmClientScheme(
  client: { register(network: string, scheme: SchemeNetworkClient): unknown },
  config: UptoEvmClientConfig
): UptoEvmClientScheme {
  const { networks, ...schemeConfig } = config;
  const scheme = new UptoEvmClientScheme(schemeConfig);
  const registerNetworks = Array.isArray(networks)
    ? networks
    : networks
      ? [networks]
      : ["eip155:*"];

  for (const network of registerNetworks) {
    client.register(network, scheme);
  }
  return scheme;
}
