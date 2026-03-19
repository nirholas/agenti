/**
 * Documentation Tests - API Examples
 *
 * These tests verify that the server-side API examples in the documentation
 * compile and work correctly with the library's exports.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  // Payment requirements builders
  buildUSDCPayment,
  buildETHPayment,
  buildSTRKPayment,
  buildPaymentRequirements,
  // Verification and settlement
  verifyPayment,
  settlePayment,
  createProvider,
  createPaymasterConfig,
  createSettlementOptions,
  // HTTP utilities
  encodePaymentRequired,
  decodePaymentSignature,
  HTTP_HEADERS,
  // Validation schemas
  PAYMENT_PAYLOAD_SCHEMA,
  PAYMENT_REQUIREMENTS_SCHEMA,
  // Types
  type PaymentRequired,
  type PaymentRequirements,
} from '../../src/index.js';

describe('API Examples - Payment Builders', () => {
  const PAYMENT_RECIPIENT = '0x1234567890abcdef';

  it('should build USDC payment requirements', () => {
    const payment = buildUSDCPayment({
      network: 'starknet:mainnet',
      amount: 0.1, // $0.10
      payTo: PAYMENT_RECIPIENT,
    });

    expect(payment.scheme).toBe('exact');
    expect(payment.network).toBe('starknet:mainnet');
    expect(payment.payTo).toBe(PAYMENT_RECIPIENT);
    expect(payment.asset).toBeDefined();
    // Amount should be converted to atomic units (6 decimals for USDC)
    expect(payment.amount).toBe('100000');
  });

  it('should build ETH payment requirements', () => {
    const payment = buildETHPayment({
      network: 'starknet:sepolia',
      amount: 0.001,
      payTo: PAYMENT_RECIPIENT,
    });

    expect(payment.scheme).toBe('exact');
    expect(payment.network).toBe('starknet:sepolia');
    expect(payment.asset).toBeDefined();
  });

  it('should build STRK payment requirements', () => {
    const payment = buildSTRKPayment({
      network: 'starknet:sepolia',
      amount: 1,
      payTo: PAYMENT_RECIPIENT,
    });

    expect(payment.scheme).toBe('exact');
    expect(payment.network).toBe('starknet:sepolia');
    expect(payment.asset).toBeDefined();
  });

  it('should build generic payment requirements', () => {
    const payment = buildPaymentRequirements({
      network: 'starknet:mainnet',
      amount: 1.5,
      asset: 'ETH',
      payTo: PAYMENT_RECIPIENT,
      maxTimeoutSeconds: 600,
    });

    expect(payment.scheme).toBe('exact');
    expect(payment.maxTimeoutSeconds).toBe(600);
  });
});

describe('API Examples - PaymentRequired Response', () => {
  it('should create valid 402 response structure', () => {
    const requirements = buildETHPayment({
      network: 'starknet:sepolia',
      amount: 0.001,
      payTo: '0x1234',
    });

    const paymentRequired: PaymentRequired = {
      x402Version: 2,
      error: 'Payment required to access this resource',
      resource: {
        url: '/api/protected',
        description: 'Protected API endpoint',
      },
      accepts: [requirements],
    };

    expect(paymentRequired.x402Version).toBe(2);
    expect(paymentRequired.accepts).toHaveLength(1);
    expect(paymentRequired.resource?.url).toBe('/api/protected');
  });

  it('should encode payment required for header', () => {
    const paymentRequired: PaymentRequired = {
      x402Version: 2,
      error: 'Payment required',
      accepts: [
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: '0x1234',
          payTo: '0x5678',
          maxTimeoutSeconds: 300,
        },
      ],
    };

    const encoded = encodePaymentRequired(paymentRequired);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });
});

describe('API Examples - Validation Schemas', () => {
  it('should validate payment requirements', () => {
    const rawRequirements = {
      scheme: 'exact',
      network: 'starknet:sepolia',
      amount: '1000000',
      asset:
        '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
      payTo: '0x1234567890abcdef',
      maxTimeoutSeconds: 300,
    };

    const result = PAYMENT_REQUIREMENTS_SCHEMA.safeParse(rawRequirements);
    expect(result.success).toBe(true);
  });

  it('should reject invalid payment requirements', () => {
    const invalidRequirements = {
      scheme: 'invalid_scheme',
      network: 'invalid:network',
    };

    const result = PAYMENT_REQUIREMENTS_SCHEMA.safeParse(invalidRequirements);
    expect(result.success).toBe(false);
  });

  it('should validate payment payload', () => {
    const rawPayload = {
      x402Version: 2,
      accepted: {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset:
          '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
        payTo:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        maxTimeoutSeconds: 300,
      },
      payload: {
        signature: { r: '0x123abc', s: '0x456def' },
        authorization: {
          from: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          to: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          amount: '1000000',
          token:
            '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
          nonce: '0x1',
          validUntil: '9999999999',
        },
      },
    };

    const result = PAYMENT_PAYLOAD_SCHEMA.safeParse(rawPayload);
    expect(result.success).toBe(true);
  });
});

describe('API Examples - Provider and Settlement Config', () => {
  it('should create provider for network', () => {
    const provider = createProvider('starknet:sepolia');
    expect(provider).toBeDefined();
  });

  it('should create paymaster config', () => {
    const config = createPaymasterConfig('starknet:mainnet', {
      apiKey: 'test-api-key',
    });

    expect(config.network).toBe('starknet:mainnet');
    expect(config.apiKey).toBe('test-api-key');
    expect(config.endpoint).toBeDefined();
  });

  it('should create settlement options', () => {
    const options = createSettlementOptions('starknet:mainnet', {
      apiKey: 'test-api-key',
    });

    expect(options.paymasterConfig).toBeDefined();
    expect(options.paymasterConfig?.network).toBe('starknet:mainnet');
  });
});

describe('API Examples - HTTP Headers', () => {
  it('should have correct header names', () => {
    expect(HTTP_HEADERS.PAYMENT_REQUIRED).toBe('PAYMENT-REQUIRED');
    expect(HTTP_HEADERS.PAYMENT_SIGNATURE).toBe('PAYMENT-SIGNATURE');
    expect(HTTP_HEADERS.PAYMENT_RESPONSE).toBe('PAYMENT-RESPONSE');
  });

  it('should use lowercase header for request parsing', () => {
    // Express/Node.js lowercase headers
    const headerName = HTTP_HEADERS.PAYMENT_SIGNATURE.toLowerCase();
    expect(headerName).toBe('payment-signature');
  });
});
