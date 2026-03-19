/**
 * Basic x402 Client Example
 *
 * This example demonstrates how to build an x402 client for Starknet
 * that handles the payment flow automatically.
 */

import { Account, RpcProvider } from 'starknet';
import {
  createPaymentPayload,
  decodePaymentRequired,
  encodePaymentSignature,
  DEFAULT_PAYMASTER_ENDPOINTS,
  HTTP_HEADERS,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
} from 'x402-starknet';

// Initialize Starknet provider
const provider = new RpcProvider({
  nodeUrl: 'https://starknet-sepolia.public.blastapi.io',
});

// These would come from your wallet or environment
declare const accountAddress: string;
declare const privateKey: string;

// Create account (starknet.js v9+)
const account = new Account({
  provider,
  address: accountAddress,
  signer: privateKey,
});

/**
 * Complete x402 client that handles the payment flow
 */
class X402Client {
  private account: Account;

  constructor(account: Account) {
    this.account = account;
  }

  /**
   * Make a request to a paid API endpoint
   */
  async fetchWithPayment(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // Step 1: Make initial request
    const response = await fetch(url, options);

    // Step 2: Check if payment is required
    if (response.status !== 402) {
      return response;
    }

    // Step 3: Extract payment requirements from 402 response
    const paymentRequiredHeader = response.headers.get(
      HTTP_HEADERS.PAYMENT_REQUIRED
    );
    if (!paymentRequiredHeader) {
      throw new Error('402 response missing PAYMENT-REQUIRED header');
    }

    const paymentRequired: PaymentRequired = decodePaymentRequired(
      paymentRequiredHeader
    );
    // eslint-disable-next-line no-console
    console.log('Payment required:', paymentRequired.error);

    // Step 4: Select the best payment option (if multiple offered)
    const requirements = this.selectPayment(paymentRequired.accepts);

    // Step 5: Create signed payment payload
    const payload = await this.createPayment(requirements);

    // Step 6: Retry request with payment - merge headers properly
    let existingHeaders: Record<string, string> = {};
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        existingHeaders[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      existingHeaders = Object.fromEntries(options.headers) as Record<
        string,
        string
      >;
    } else if (options.headers) {
      existingHeaders = options.headers as Record<string, string>;
    }

    const paidResponse = await fetch(url, {
      ...options,
      headers: {
        ...existingHeaders,
        [HTTP_HEADERS.PAYMENT_SIGNATURE]: encodePaymentSignature(payload),
      },
    });

    return paidResponse;
  }

  /**
   * Select the best payment option from available requirements
   * This is a simple implementation - you can add more sophisticated logic
   * (e.g., check balances, prefer certain tokens, etc.)
   */
  private selectPayment(
    accepts: Array<PaymentRequirements>
  ): PaymentRequirements {
    // For simplicity, just pick the first option
    // In production, you might check balances, prefer certain tokens, etc.
    const first = accepts[0];
    if (!first) {
      throw new Error('No payment options available');
    }
    return first;
  }

  /**
   * Create a signed payment payload
   */
  private async createPayment(
    requirements: PaymentRequirements
  ): Promise<PaymentPayload> {
    const paymasterEndpoint = DEFAULT_PAYMASTER_ENDPOINTS[requirements.network];

    const payload = await createPaymentPayload(this.account, 2, requirements, {
      endpoint: paymasterEndpoint,
      network: requirements.network,
    });

    return payload;
  }
}

// Usage example
async function main(): Promise<void> {
  const client = new X402Client(account);

  // Fetch from a paid API - payment is handled automatically
  const response = await client.fetchWithPayment(
    'https://api.example.com/premium-data'
  );
  const data = await response.json();
  // eslint-disable-next-line no-console
  console.log('Received data:', data);
}
// eslint-disable-next-line no-console
main().catch(console.error);
