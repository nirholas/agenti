import { z } from "zod";

/**
 * @chaoschain/x402-client
 * 
 * TypeScript client for the ChaosChain x402 decentralized facilitator.
 * This client provides a simple interface to verify and settle x402 payments
 * using a decentralized CRE workflow instead of a centralized facilitator.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Payment Requirements
 * Specifies what the resource server accepts for payment
 */
export interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description?: string;
  mimeType?: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  asset: string;
  extra?: Record<string, unknown> | null;
}

/**
 * Verification Response
 * Returned by the facilitator after verifying a payment
 */
export interface VerifyResponse {
  isValid: boolean;
  invalidReason: string | null;
  consensusProof?: string;
  reportId?: string;
  timestamp?: number;
}

/**
 * Settlement Response
 * Returned by the facilitator after settling a payment
 */
export interface SettleResponse {
  success: boolean;
  error: string | null;
  txHash: string | null;
  networkId: string | null;
  consensusProof?: string;
  timestamp?: number;
}

/**
 * Supported Schemes Response
 * Lists payment schemes and networks supported by the facilitator
 */
export interface SupportedSchemesResponse {
  kinds: Array<{
    scheme: string;
    network: string;
  }>;
}

/**
 * Client Configuration
 */
export interface X402ClientConfig {
  facilitatorUrl: string;
  x402Version?: number;
  timeout?: number; // Request timeout in milliseconds
}

// ============================================================================
// CLIENT
// ============================================================================

/**
 * X402 Client
 * 
 * Provides methods to interact with the decentralized x402 facilitator.
 * 
 * @example
 * ```typescript
 * const client = new X402Client({
 *   facilitatorUrl: 'http://localhost:8402'
 * });
 * 
 * const result = await client.verifyPayment(
 *   'base64_encoded_payment_header',
 *   paymentRequirements
 * );
 * ```
 */
export class X402Client {
  private facilitatorUrl: string;
  private x402Version: number;
  private timeout: number;

  constructor(config: X402ClientConfig) {
    this.facilitatorUrl = config.facilitatorUrl.replace(/\/$/, ""); // Remove trailing slash
    this.x402Version = config.x402Version ?? 1;
    this.timeout = config.timeout ?? 30000; // 30 seconds default
  }

  /**
   * Verify Payment
   * 
   * Verifies an x402 payment payload via the decentralized facilitator.
   * The facilitator uses BFT consensus across a CRE DON to verify the payment.
   * 
   * @param paymentHeader - Base64 encoded X-PAYMENT header
   * @param paymentRequirements - Payment requirements from the resource server
   * @returns Verification response with consensus proof
   * 
   * @example
   * ```typescript
   * const result = await client.verifyPayment(
   *   'eyJ4NDAyVmVyc2lvbiI6MX0=',
   *   {
   *     scheme: 'exact',
   *     network: 'base-sepolia',
   *     maxAmountRequired: '1000000',
   *     payTo: '0x...',
   *     asset: '0x...',
   *     resource: '/api/weather'
   *   }
   * );
   * 
   * if (result.isValid) {
   *   console.log('Payment verified!', result.consensusProof);
   * }
   * ```
   */
  async verifyPayment(
    paymentHeader: string,
    paymentRequirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.facilitatorUrl}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          x402Version: this.x402Version,
          paymentHeader,
          paymentRequirements,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Verification failed: ${response.status} ${response.statusText} - ${errorData.error || ""}`
        );
      }

      const data = await response.json();
      return data as VerifyResponse;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Verification request timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Settle Payment
   * 
   * Settles an x402 payment via the decentralized facilitator.
   * The facilitator uses BFT consensus across a CRE DON to execute the
   * on-chain settlement transaction.
   * 
   * @param paymentHeader - Base64 encoded X-PAYMENT header
   * @param paymentRequirements - Payment requirements from the resource server
   * @returns Settlement response with transaction hash and consensus proof
   * 
   * @example
   * ```typescript
   * const result = await client.settlePayment(
   *   'eyJ4NDAyVmVyc2lvbiI6MX0=',
   *   {
   *     scheme: 'exact',
   *     network: 'base-sepolia',
   *     maxAmountRequired: '1000000',
   *     payTo: '0x...',
   *     asset: '0x...',
   *     resource: '/api/weather'
   *   }
   * );
   * 
   * if (result.success) {
   *   console.log('Payment settled!', result.txHash);
   * }
   * ```
   */
  async settlePayment(
    paymentHeader: string,
    paymentRequirements: PaymentRequirements
  ): Promise<SettleResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.facilitatorUrl}/settle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          x402Version: this.x402Version,
          paymentHeader,
          paymentRequirements,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Settlement failed: ${response.status} ${response.statusText} - ${errorData.error || ""}`
        );
      }

      const data = await response.json();
      return data as SettleResponse;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Settlement request timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get Supported Schemes
   * 
   * Queries the facilitator for supported payment schemes and networks.
   * 
   * @returns List of supported (scheme, network) pairs
   * 
   * @example
   * ```typescript
   * const supported = await client.getSupportedSchemes();
   * console.log('Supported:', supported.kinds);
   * // [{ scheme: 'exact', network: 'base-sepolia' }, ...]
   * ```
   */
  async getSupportedSchemes(): Promise<SupportedSchemesResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.facilitatorUrl}/supported`, {
        method: "GET",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to get supported schemes: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data as SupportedSchemesResponse;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Health Check
   * 
   * Checks if the facilitator is responsive.
   * 
   * @returns Service information if healthy
   * @throws Error if the facilitator is unreachable
   */
  async healthCheck(): Promise<{
    service: string;
    version: string;
    mode: string;
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.facilitatorUrl}/`, {
        method: "GET",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Health check failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Health check timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Create X402 Client
 * 
 * Factory function to create a new X402Client instance.
 * 
 * @param config - Client configuration
 * @returns New X402Client instance
 * 
 * @example
 * ```typescript
 * import { createX402Client } from '@chaoschain/x402-client';
 * 
 * const client = createX402Client({
 *   facilitatorUrl: process.env.X402_FACILITATOR_URL || 'http://localhost:8402'
 * });
 * ```
 */
export function createX402Client(config: X402ClientConfig): X402Client {
  return new X402Client(config);
}

// Export types
export type { X402ClientConfig };

