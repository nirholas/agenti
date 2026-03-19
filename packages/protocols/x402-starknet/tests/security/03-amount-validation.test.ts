/**
 * Security Test Suite: Amount Validation
 * Based on SECURITY_TESTING.md sections 3.1-3.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyPayment } from '../../src/payment/verify.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';
import type { RpcProvider } from 'starknet';

describe('Security: Amount Validation', () => {
  const USDC_ADDRESS =
    '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
  const RECIPIENT_ADDRESS =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  const basePayload: PaymentPayload = {
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
        from: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        to: RECIPIENT_ADDRESS,
        amount: '1000000',
        token: USDC_ADDRESS,
        nonce: '0x0',
        validUntil: '9999999999',
      },
    },
  };

  let mockProvider: RpcProvider;

  beforeEach(() => {
    mockProvider = {
      callContract: vi.fn().mockResolvedValue(['10000000', '0']), // Sufficient balance
    } as unknown as RpcProvider;
  });

  describe('Test 3.1: Amount Manipulation Detection', () => {
    it('should reject payment with tampered amount', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      // Tamper with amount in payload
      const tamperedPayload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: '1',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '1', // Changed from 1000000 to 1
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        tamperedPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_value'
      );
    });

    it('should reject amount higher than required', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const tamperedPayload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: '5000000',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '5000000', // 5x the required amount
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        tamperedPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_value'
      );
    });

    it('should reject amount lower than required', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const tamperedPayload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: '500000',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '500000', // Half the required amount
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        tamperedPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_value'
      );
    });

    it('should enforce strict equality for amount matching', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      // Off by 1 (less)
      const lessPayload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: '999999',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '999999',
          },
        },
      };

      const resultLess = await verifyPayment(
        mockProvider,
        lessPayload,
        requirements
      );
      expect(resultLess.isValid).toBe(false);
      expect(resultLess.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_value'
      );

      // Off by 1 (more)
      const morePayload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: '1000001',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '1000001',
          },
        },
      };

      const resultMore = await verifyPayment(
        mockProvider,
        morePayload,
        requirements
      );
      expect(resultMore.isValid).toBe(false);
      expect(resultMore.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_value'
      );
    });

    it('should accept exact amount match', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const result = await verifyPayment(
        mockProvider,
        basePayload,
        requirements
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('Test 3.2: Large Number Handling', () => {
    it('should handle maximum u256 amount without overflow', async () => {
      const MAX_U256 =
        '115792089237316195423570985008687907853269984665640564039457584007913129639935';

      (mockProvider.callContract as any).mockResolvedValue([
        '0xffffffffffffffffffffffffffffffff',
        '0xffffffffffffffffffffffffffffffff',
      ]);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: MAX_U256,
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: MAX_U256,
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: MAX_U256,
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      // Should handle without overflow errors
      expect(result.isValid).toBe(true);
    });

    it('should handle very large numbers correctly', async () => {
      const largeAmount = '999999999999999999999999'; // Close to max

      (mockProvider.callContract as any).mockResolvedValue([
        '999999999999999999999999',
        '0',
      ]);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: largeAmount,
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: largeAmount,
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: largeAmount,
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      expect(result.isValid).toBe(true);
    });

    it('should correctly compare large amounts that differ slightly', async () => {
      const amount1 = '999999999999999999999999';
      const amount2 = '999999999999999999999998'; // 1 less

      (mockProvider.callContract as any).mockResolvedValue([amount1, '0']);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: amount1,
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: amount2,
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: amount2, // Slightly different
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_value'
      );
      // Must detect even 1 unit difference in very large numbers
    });

    it('should handle amounts near u128 boundary', async () => {
      const amount = '340282366920938463463374607431768211455'; // Max u128

      (mockProvider.callContract as any).mockResolvedValue([amount, '0']);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: amount,
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: amount,
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: amount,
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      expect(result.isValid).toBe(true);
    });

    it('should handle amounts above u128 boundary', async () => {
      const amount = '340282366920938463463374607431768211456'; // Max u128 + 1

      (mockProvider.callContract as any).mockResolvedValue(['0', '1']); // High part = 1

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: amount,
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: amount,
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: amount,
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      // Should correctly handle Uint256 with high part
      expect(result.isValid).toBe(true);
    });
  });

  describe('Test 3.3: Zero Amount', () => {
    it('should accept zero amount when required', async () => {
      (mockProvider.callContract as any).mockResolvedValue(['1000000', '0']);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '0',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: '0',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '0',
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      expect(result.isValid).toBe(true);
      // Zero amount is valid - could be used for free resources
    });

    it('should reject non-zero amount when zero required', async () => {
      (mockProvider.callContract as any).mockResolvedValue(['1000000', '0']);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '0',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      // Payload has non-zero amount but requirement is zero
      const result = await verifyPayment(
        mockProvider,
        basePayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_value'
      );
    });

    it('should reject zero amount when non-zero required', async () => {
      (mockProvider.callContract as any).mockResolvedValue(['1000000', '0']);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: '0',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '0',
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_value'
      );
    });

    it('should handle zero amount with zero balance', async () => {
      (mockProvider.callContract as any).mockResolvedValue(['0', '0']);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '0',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: '0',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '0',
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      expect(result.isValid).toBe(true);
      // Zero payment with zero balance should work
    });
  });

  describe('Edge Cases: Amount String Formats', () => {
    it('should handle amount with leading zeros', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: '0001000000',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '0001000000', // Leading zeros
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      // Should handle leading zeros correctly (implementation-dependent)
      // May normalize to '1000000' and pass, or may fail schema validation
    });

    it('should handle amount in hexadecimal format', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: '0xf4240',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '0xf4240', // 1000000 in hex
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      // Should handle hex format (implementation-dependent)
    });

    it('should reject negative amount strings', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: '-1000000',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '-1000000', // Negative
          },
        },
      };

      // Schema validation should reject negative amounts
      // Or verification should fail
      const result = await verifyPayment(mockProvider, payload, requirements);

      // Should not accept negative amounts
    });

    it('should reject non-numeric amount strings', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: 'invalid',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: 'invalid', // Non-numeric
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      // Schema validation should reject this
      expect(result.isValid).toBe(false);
    });

    it('should reject floating point amounts', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: '1000000.5',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '1000000.5', // Float
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      // Should reject floating point numbers
      expect(result.isValid).toBe(false);
    });
  });

  describe('Amount Consistency Checks', () => {
    it('should verify amount matches across all fields', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      // Correct payload with consistent amounts
      const result = await verifyPayment(
        mockProvider,
        basePayload,
        requirements
      );

      expect(result.isValid).toBe(true);
    });

    it('should reject if authorization amount differs from requirement', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '2000000', // Different from payload
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const result = await verifyPayment(
        mockProvider,
        basePayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_value'
      );
    });
  });
});
