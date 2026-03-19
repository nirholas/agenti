/**
 * Test suite for validUntil timestamp checking in payment verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyPayment } from '../../src/payment/verify.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';
import type { RpcProvider } from 'starknet';

describe('Payment Verification: validUntil Expiry Checks', () => {
  const USDC_ADDRESS =
    '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
  const RECIPIENT_ADDRESS =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const PAYER_ADDRESS =
    '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

  const baseRequirements: PaymentRequirements = {
    scheme: 'exact',
    network: 'starknet:sepolia',
    amount: '1000000',
    asset: USDC_ADDRESS,
    payTo: RECIPIENT_ADDRESS,
    resource: 'https://api.example.com/data',
    maxTimeoutSeconds: 60,
  };

  let mockProvider: RpcProvider;

  beforeEach(() => {
    // Mock provider with sufficient balance
    mockProvider = {
      callContract: vi.fn().mockResolvedValue(['1000000', '0']), // Balance: 1M (exact match)
    } as unknown as RpcProvider;
  });

  describe('Valid (non-expired) payments', () => {
    it('should accept payment with validUntil far in the future', async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: futureTimestamp.toString(),
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payload,
        baseRequirements
      );

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(PAYER_ADDRESS);
      expect(result.invalidReason).toBeUndefined();
    });

    it('should accept payment with validUntil exactly at current time', async () => {
      const currentTimestamp = Math.floor(Date.now() / 1000);

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: currentTimestamp.toString(),
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payload,
        baseRequirements
      );

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(PAYER_ADDRESS);
    });

    it('should accept payment with very large validUntil timestamp', async () => {
      // Far future: year 2100
      const farFutureTimestamp = '4102444800';

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: farFutureTimestamp,
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payload,
        baseRequirements
      );

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(PAYER_ADDRESS);
    });
  });

  describe('Expired payments', () => {
    it('should reject payment with validUntil in the past', async () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: pastTimestamp.toString(),
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payload,
        baseRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_valid_until'
      );
      expect(result.payer).toBe(PAYER_ADDRESS);
      expect(result.details?.validUntil).toBe(pastTimestamp.toString());
      expect(result.details?.currentTimestamp).toBeDefined();
    });

    it('should reject payment that expired 1 second ago', async () => {
      const justExpired = Math.floor(Date.now() / 1000) - 1;

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: justExpired.toString(),
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payload,
        baseRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_valid_until'
      );
      expect(result.payer).toBe(PAYER_ADDRESS);
    });

    it('should accept payment with validUntil = 0 (no expiration)', async () => {
      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: '0',
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payload,
        baseRequirements
      );

      // validUntil = 0 means no expiration, so payment should be valid
      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(PAYER_ADDRESS);
    });

    it('should reject payment with validUntil = 1 (very old timestamp)', async () => {
      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: '1',
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payload,
        baseRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_valid_until'
      );
    });
  });

  describe('Invalid validUntil formats', () => {
    it('should reject payment with non-numeric validUntil (caught by schema)', async () => {
      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: 'invalid',
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payload,
        baseRequirements
      );

      // Schema validation catches this before timestamp check
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
      expect(result.payer).toBeUndefined(); // Schema validation fails before extracting payer
      expect(result.details?.error).toBeDefined();
    });

    it('should reject payment with empty validUntil (caught by schema)', async () => {
      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: '',
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payload,
        baseRequirements
      );

      // Schema validation catches empty string
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
      expect(result.details?.error).toBeDefined();
    });

    it('should reject payment with negative validUntil (caught by schema)', async () => {
      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: '-1',
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payload,
        baseRequirements
      );

      // Schema validation catches negative numbers (regex requires digits only, no minus sign)
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
    });

    it('should reject payment with floating point validUntil (caught by schema)', async () => {
      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: '123.456',
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payload,
        baseRequirements
      );

      // Schema validation catches decimal point (regex requires digits only)
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
    });
  });

  describe('Edge cases', () => {
    it('should handle very small time windows correctly', async () => {
      // Create a payment that expires in 2 seconds
      const shortExpiry = Math.floor(Date.now() / 1000) + 2;

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: shortExpiry.toString(),
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payload,
        baseRequirements
      );

      // Should still be valid if checked immediately
      expect(result.isValid).toBe(true);
    });

    it('should include timestamp details in expired payment response', async () => {
      const expiredTimestamp = 1000000; // Very old timestamp

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: expiredTimestamp.toString(),
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payload,
        baseRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_valid_until'
      );
      expect(result.details).toBeDefined();
      expect(result.details?.validUntil).toBe(expiredTimestamp.toString());
      expect(result.details?.currentTimestamp).toBeDefined();

      // Verify current timestamp is reasonable
      const currentTimestamp = parseInt(
        result.details?.currentTimestamp as string,
        10
      );
      expect(currentTimestamp).toBeGreaterThan(expiredTimestamp);
      expect(currentTimestamp).toBeGreaterThan(1700000000); // After 2023
    });
  });

  describe('Integration with other validations', () => {
    it('should check validUntil before balance check', async () => {
      // Create expired payment with insufficient balance
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 3600;

      const insufficientBalanceProvider = {
        callContract: vi.fn().mockResolvedValue(['0', '0']), // 0 balance (insufficient)
      } as unknown as RpcProvider;

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: expiredTimestamp.toString(),
          },
        },
      };

      const result = await verifyPayment(
        insufficientBalanceProvider,
        payload,
        baseRequirements
      );

      // Should fail with 'expired' not 'insufficient_funds'
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_valid_until'
      );
    });

    it('should accept valid payment with all checks passing', async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
          },
          authorization: {
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: futureTimestamp.toString(),
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payload,
        baseRequirements
      );

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(PAYER_ADDRESS);
      expect(result.details?.balance).toBe('1000000');
    });
  });
});
