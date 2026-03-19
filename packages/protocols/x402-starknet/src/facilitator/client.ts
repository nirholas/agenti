/**
 * Facilitator client for x402 payment verification and settlement
 * Spec compliance: x402 v2 - Facilitator API
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  SupportedResponse,
} from '../types/index.js';
import { err } from '../errors.js';

/**
 * Configuration for the facilitator client
 */
export interface FacilitatorClientConfig {
  /** Base URL of the facilitator service */
  baseUrl: string;
  /** Optional API key for authentication */
  apiKey?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom fetch implementation (for testing) */
  fetch?: typeof fetch;
}

/**
 * Facilitator client interface
 * Spec compliance: x402 v2 - Facilitator API
 */
export interface IFacilitatorClient {
  /**
   * Verify a payment payload against requirements
   * @param payload - Payment payload from client
   * @param requirements - Payment requirements from server
   * @returns Verification response
   */
  verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse>;

  /**
   * Settle a verified payment
   * @param payload - Payment payload from client
   * @param requirements - Payment requirements from server
   * @returns Settlement response
   */
  settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse>;

  /**
   * Get supported payment kinds
   * @returns Supported payment kinds, extensions, and signers
   */
  supported(): Promise<SupportedResponse>;
}

/**
 * HTTP client for communicating with x402 facilitator services
 *
 * @example
 * ```typescript
 * const client = new FacilitatorClient({
 *   baseUrl: 'https://facilitator.example.com',
 *   apiKey: 'your-api-key'
 * });
 *
 * // Check supported payment kinds
 * const supported = await client.supported();
 *
 * // Verify a payment
 * const verifyResult = await client.verify(payload, requirements);
 *
 * // Settle if valid
 * if (verifyResult.isValid) {
 *   const settleResult = await client.settle(payload, requirements);
 * }
 * ```
 */
export class FacilitatorClient implements IFacilitatorClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeout: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: FacilitatorClientConfig) {
    // Normalize base URL (remove trailing slash)
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30000;
    this.fetchFn = config.fetch ?? fetch;
  }

  /**
   * Verify a payment payload against requirements
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    const response = await this.request<VerifyResponse>('/verify', {
      method: 'POST',
      body: JSON.stringify({
        paymentPayload: payload,
        paymentRequirements: requirements,
      }),
    });

    return response;
  }

  /**
   * Settle a verified payment
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    const response = await this.request<SettleResponse>('/settle', {
      method: 'POST',
      body: JSON.stringify({
        paymentPayload: payload,
        paymentRequirements: requirements,
      }),
    });

    return response;
  }

  /**
   * Get supported payment kinds
   */
  async supported(): Promise<SupportedResponse> {
    const response = await this.request<SupportedResponse>('/supported', {
      method: 'GET',
    });

    return response;
  }

  /**
   * Make an HTTP request to the facilitator
   */
  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const response = await this.fetchFn(url, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers as Record<string, string>),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw err.network(
          `Facilitator request failed: ${String(response.status)} ${response.statusText}`,
          undefined,
          {
            status: response.status,
            statusText: response.statusText,
            body: errorBody,
            url,
          }
        );
      }

      const data: unknown = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw err.timeout(this.timeout);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Create a facilitator client instance
 *
 * @param config - Client configuration
 * @returns Configured facilitator client
 *
 * @example
 * ```typescript
 * const client = createFacilitatorClient({
 *   baseUrl: 'https://facilitator.example.com',
 * });
 * ```
 */
export function createFacilitatorClient(
  config: FacilitatorClientConfig
): IFacilitatorClient {
  return new FacilitatorClient(config);
}
