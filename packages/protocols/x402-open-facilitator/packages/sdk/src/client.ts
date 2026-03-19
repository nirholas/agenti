import type {
  FacilitatorConfig,
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  SupportedResponse,
} from './types.js';
import {
  FacilitatorError,
  NetworkError,
  VerificationError,
  SettlementError,
} from './errors.js';
import { buildUrl, normalizeUrl, getVersionSafe } from './utils.js';

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_URL = 'https://pay.openfacilitator.io';

export class OpenFacilitator {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly headers: Record<string, string>;
  private supportedCache: SupportedResponse | null = null;
  private supportedPromise: Promise<SupportedResponse> | null = null;

  constructor(config: FacilitatorConfig = {}) {
    this.baseUrl = normalizeUrl(config.url ?? DEFAULT_URL);
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * Get the facilitator URL
   */
  get url(): string {
    return this.baseUrl;
  }

  /**
   * Verify a payment is valid
   * @param payment - The payment payload
   * @param requirements - Payment requirements for validation
   */
  async verify(
    payment: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    try {
      const version = getVersionSafe(payment);
      const body = {
        x402Version: version,
        paymentPayload: payment,
        paymentRequirements: requirements,
      };

      const response = await this.request<VerifyResponse>('/verify', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return response;
    } catch (error) {
      if (error instanceof FacilitatorError) throw error;
      throw new VerificationError(
        `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Settle/broadcast a payment transaction
   * @param payment - The payment payload
   * @param requirements - Payment requirements for validation
   */
  async settle(
    payment: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    try {
      const version = getVersionSafe(payment);
      const body = {
        x402Version: version,
        paymentPayload: payment,
        paymentRequirements: requirements,
      };

      const response = await this.request<SettleResponse>('/settle', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return response;
    } catch (error) {
      if (error instanceof FacilitatorError) throw error;
      throw new SettlementError(
        `Settlement failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Get supported networks and payment kinds
   */
  async supported(): Promise<SupportedResponse> {
    try {
      const response = await this.request<SupportedResponse>('/supported', {
        method: 'GET',
      });

      return response;
    } catch (error) {
      if (error instanceof FacilitatorError) throw error;
      throw new NetworkError(
        `Failed to fetch supported networks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Health check - verify facilitator is reachable
   */
  async health(): Promise<boolean> {
    try {
      await this.supported();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get fee payer address for a specific network.
   * Fee payers are wallet addresses that pay transaction fees when settling payments.
   * Currently only Solana networks have fee payers.
   * @param network - Network identifier (e.g., "solana", "solana:mainnet")
   * @returns Fee payer address or undefined if not available for the network
   */
  async getFeePayer(network: string): Promise<string | undefined> {
    const supported = await this.getSupportedCached();

    // Look for matching network in kinds (check both exact match and partial match)
    for (const kind of supported.kinds) {
      if (kind.network === network || kind.network.includes(network) || network.includes(kind.network)) {
        if (kind.extra?.feePayer) {
          return kind.extra.feePayer;
        }
      }
    }

    return undefined;
  }

  /**
   * Get all fee payers mapped by network.
   * Fee payers are wallet addresses that pay transaction fees when settling payments.
   * @returns Map of network identifiers to fee payer addresses
   */
  async getFeePayerMap(): Promise<Record<string, string>> {
    const supported = await this.getSupportedCached();
    const feePayerMap: Record<string, string> = {};

    for (const kind of supported.kinds) {
      if (kind.extra?.feePayer) {
        feePayerMap[kind.network] = kind.extra.feePayer;
      }
    }

    return feePayerMap;
  }

  /**
   * Get cached supported response, fetching if needed.
   * Uses deduplication to prevent concurrent requests.
   */
  private async getSupportedCached(): Promise<SupportedResponse> {
    if (this.supportedCache) {
      return this.supportedCache;
    }

    // Deduplicate concurrent requests
    if (!this.supportedPromise) {
      this.supportedPromise = this.supported().then((response) => {
        this.supportedCache = response;
        this.supportedPromise = null;
        return response;
      });
    }

    return this.supportedPromise;
  }

  /**
   * Clear cached supported response.
   * Useful if facilitator configuration may have changed.
   */
  clearCache(): void {
    this.supportedCache = null;
    this.supportedPromise = null;
  }

  /**
   * Internal request helper
   */
  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = buildUrl(this.baseUrl, path);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          ...this.headers,
          ...(init.headers as Record<string, string>),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.error || errorBody.message || errorMessage;
        } catch {
          // Ignore JSON parse errors
        }

        throw new FacilitatorError(errorMessage, 'HTTP_ERROR', response.status);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof FacilitatorError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError(`Request timeout after ${this.timeout}ms`);
      }

      throw new NetworkError(
        `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }
}

/**
 * Create a facilitator client with default OpenFacilitator URL
 * @deprecated Just use `new OpenFacilitator()` - it defaults to the public endpoint
 */
export function createDefaultFacilitator(): OpenFacilitator {
  return new OpenFacilitator();
}
