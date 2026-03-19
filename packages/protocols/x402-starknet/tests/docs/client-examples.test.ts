/**
 * Documentation Tests - Client Examples
 *
 * These tests verify that the client-side examples in the documentation
 * compile and work correctly with the library's exports.
 */

import { describe, it, expect } from 'vitest';
import {
  createPaymentPayload,
  decodePaymentRequired,
  encodePaymentSignature,
  DEFAULT_PAYMASTER_ENDPOINTS,
  HTTP_HEADERS,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
} from '../../src/index.js';

describe('Client Examples - Type Safety', () => {
  it('should export all required client functions', () => {
    expect(typeof createPaymentPayload).toBe('function');
    expect(typeof decodePaymentRequired).toBe('function');
    expect(typeof encodePaymentSignature).toBe('function');
  });

  it('should export HTTP_HEADERS constants', () => {
    expect(HTTP_HEADERS.PAYMENT_REQUIRED).toBe('PAYMENT-REQUIRED');
    expect(HTTP_HEADERS.PAYMENT_SIGNATURE).toBe('PAYMENT-SIGNATURE');
    expect(HTTP_HEADERS.PAYMENT_RESPONSE).toBe('PAYMENT-RESPONSE');
  });

  it('should export DEFAULT_PAYMASTER_ENDPOINTS', () => {
    expect(DEFAULT_PAYMASTER_ENDPOINTS['starknet:mainnet']).toBeDefined();
    expect(DEFAULT_PAYMASTER_ENDPOINTS['starknet:sepolia']).toBeDefined();
    expect(DEFAULT_PAYMASTER_ENDPOINTS['starknet:devnet']).toBeDefined();
  });

  it('should decode payment required header', () => {
    const paymentRequired: PaymentRequired = {
      x402Version: 2,
      error: 'Payment required',
      accepts: [
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset:
            '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
          payTo: '0x1234567890abcdef',
          maxTimeoutSeconds: 300,
        },
      ],
    };

    // Encode and decode round-trip
    const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString(
      'base64'
    );
    const decoded = decodePaymentRequired(encoded);

    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepts).toHaveLength(1);
    expect(decoded.accepts[0]?.scheme).toBe('exact');
  });

  it('should encode payment signature', () => {
    const mockPayload: PaymentPayload = {
      x402Version: 2,
      accepted: {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset:
          '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
        payTo: '0x1234567890abcdef',
        maxTimeoutSeconds: 300,
      },
      payload: {
        signature: { r: '0x123', s: '0x456' },
        authorization: {
          from: '0x111',
          validUntil: 9999999999,
          value: '1000000',
        },
      },
    };

    const encoded = encodePaymentSignature(mockPayload);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });
});

describe('Client Examples - Payment Selection', () => {
  it('should handle single payment option', () => {
    const accepts: PaymentRequirements[] = [
      {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset:
          '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
        payTo: '0x1234567890abcdef',
        maxTimeoutSeconds: 300,
      },
    ];

    // Simple selection logic from example
    const first = accepts[0];
    expect(first).toBeDefined();
    expect(first?.network).toBe('starknet:sepolia');
  });

  it('should handle multiple payment options', () => {
    const accepts: PaymentRequirements[] = [
      {
        scheme: 'exact',
        network: 'starknet:mainnet',
        amount: '100000', // Lower amount
        asset:
          '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
        payTo: '0x1234',
        maxTimeoutSeconds: 300,
      },
      {
        scheme: 'exact',
        network: 'starknet:mainnet',
        amount: '200000', // Higher amount
        asset:
          '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
        payTo: '0x1234',
        maxTimeoutSeconds: 300,
      },
    ];

    expect(accepts).toHaveLength(2);
    // In production, client would check balances and pick optimal option
    expect(accepts[0]?.amount).toBe('100000');
  });
});
