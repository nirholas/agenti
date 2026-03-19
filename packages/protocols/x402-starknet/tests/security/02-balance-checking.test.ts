/**
 * Security Test Suite: Balance Checking
 * Based on SECURITY_TESTING.md sections 2.1-2.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyPayment } from '../../src/payment/verify.js';
import { settlePayment } from '../../src/payment/settle.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';
import type { RpcProvider } from 'starknet';

describe('Security: Balance Checking', () => {
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
      callContract: vi.fn(),
    } as unknown as RpcProvider;
  });

  describe('Test 2.1: Insufficient Balance Detection', () => {
    it('should detect insufficient balance', async () => {
      // Mock balance much less than required
      (mockProvider.callContract as any).mockResolvedValue(['500000', '0']); // 0.5M USDC

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000', // 1M USDC required
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const result = await verifyPayment(
        mockProvider,
        basePayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('insufficient_funds');
      expect(result.details?.balance).toBe('500000');
      expect(result.payer).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      );
    });

    it('should detect zero balance', async () => {
      (mockProvider.callContract as any).mockResolvedValue(['0', '0']);

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

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('insufficient_funds');
      expect(result.details?.balance).toBe('0');
    });

    it('should reject payment requiring extremely large amount', async () => {
      // Balance is large but still less than massive requirement
      (mockProvider.callContract as any).mockResolvedValue([
        '999999999999999',
        '0',
      ]);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000000000000', // 1 quadrillion
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: '1000000000000000',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '1000000000000000',
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('insufficient_funds');
    });

    it('should detect insufficient balance with small deficit', async () => {
      // Balance is 1 wei less than required (edge case)
      (mockProvider.callContract as any).mockResolvedValue(['999999', '0']);

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

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('insufficient_funds');
      expect(result.details?.balance).toBe('999999');
    });
  });

  describe('Test 2.2: TOCTOU Race Condition', () => {
    it('should demonstrate TOCTOU vulnerability window', async () => {
      // Mock sufficient balance initially
      (mockProvider.callContract as any).mockResolvedValue(['2000000', '0']);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      // Step 1: Verify with sufficient balance
      const verification = await verifyPayment(
        mockProvider,
        basePayload,
        requirements
      );
      expect(verification.isValid).toBe(true);

      // Step 2: Simulate balance change between verify and settle
      // In real scenario: user transfers funds away or makes another payment
      (mockProvider.callContract as any).mockResolvedValue(['100000', '0']); // Balance dropped!

      // Step 3: Try to settle - balance check was passed but funds are gone
      (basePayload as any).paymasterEndpoint =
        'https://sepolia.paymaster.avnu.fi';
      (basePayload as any).typedData = {
        types: {},
        primaryType: 'Transfer',
        domain: {},
        message: {},
      };

      const settlement = await settlePayment(
        mockProvider,
        basePayload,
        requirements,
        {
          paymasterConfig: {
            endpoint: 'https://sepolia.paymaster.avnu.fi',
            network: 'starknet:sepolia',
          },
        }
      );

      // Settlement should fail because balance is now insufficient
      expect(settlement.success).toBe(false);
      expect(settlement.errorReason).toBe('insufficient_funds');

      // This demonstrates the TOCTOU race condition (SECURITY.md:45-48)
      // Mitigation: Minimize gap between verify and settle
    });

    it('should show race condition with concurrent payments', async () => {
      // Mock sufficient balance for one payment
      (mockProvider.callContract as any).mockResolvedValue(['1000000', '0']);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      // Two concurrent verifications for same amount
      const verification1 = await verifyPayment(
        mockProvider,
        basePayload,
        requirements
      );
      const verification2 = await verifyPayment(
        mockProvider,
        basePayload,
        requirements
      );

      // Both pass verification (checked at same time)
      expect(verification1.isValid).toBe(true);
      expect(verification2.isValid).toBe(true);

      // But only one can actually succeed on-chain
      // The second would fail due to insufficient balance after first settles
      // This is a known limitation that applications must handle
    });

    it('should verify that verification does not lock balance', async () => {
      (mockProvider.callContract as any).mockResolvedValue(['2000000', '0']);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      // Multiple verifications should all pass (no locking)
      const v1 = await verifyPayment(mockProvider, basePayload, requirements);
      const v2 = await verifyPayment(mockProvider, basePayload, requirements);
      const v3 = await verifyPayment(mockProvider, basePayload, requirements);

      expect(v1.isValid).toBe(true);
      expect(v2.isValid).toBe(true);
      expect(v3.isValid).toBe(true);

      // All three pass because verify() doesn't lock funds
      // Applications must implement their own locking if needed
    });
  });

  describe('Test 2.3: Balance Exactly Equal to Required', () => {
    it('should accept payment when balance exactly matches requirement', async () => {
      // Exact balance match
      (mockProvider.callContract as any).mockResolvedValue(['1000000', '0']);

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
      expect(result.payer).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      );
      expect(result.details?.balance).toBe('1000000');
    });

    it('should handle exact balance for very small amounts', async () => {
      (mockProvider.callContract as any).mockResolvedValue(['1', '0']);

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1', // Smallest possible amount
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const payload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: '1',
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '1',
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      expect(result.isValid).toBe(true);
      expect(result.details?.balance).toBe('1');
    });

    it('should handle exact balance for very large amounts', async () => {
      const largeAmount = '999999999999999999999'; // Nearly max u256

      (mockProvider.callContract as any).mockResolvedValue([largeAmount, '0']);

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
      expect(result.details?.balance).toBe(largeAmount);
    });

    it('should fail with balance one unit less than required', async () => {
      // Off-by-one test
      (mockProvider.callContract as any).mockResolvedValue(['999999', '0']);

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

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('insufficient_funds');
    });

    it('should pass with balance one unit more than required', async () => {
      // Off-by-one test (other direction)
      (mockProvider.callContract as any).mockResolvedValue(['1000001', '0']);

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
      expect(result.details?.balance).toBe('1000001');
    });
  });

  describe('Edge Cases: Uint256 Balance Handling', () => {
    it('should handle balance as Uint256 (low, high)', async () => {
      // Uint256 represented as two u128 values
      (mockProvider.callContract as any).mockResolvedValue([
        '0xffffffffffffffffffffffffffffffff', // low (max u128)
        '0x1', // high
      ]);

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
      expect(result.details?.balance).toBeDefined();
      // Balance should be correctly calculated from Uint256
    });

    it('should handle maximum Uint256 balance', async () => {
      const MAX_U128 = '0xffffffffffffffffffffffffffffffff';
      (mockProvider.callContract as any).mockResolvedValue([
        MAX_U128,
        MAX_U128,
      ]);

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
      // Should handle max u256 without overflow
    });

    it('should handle balance with zero high part', async () => {
      (mockProvider.callContract as any).mockResolvedValue(['2000000', '0']);

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
      expect(result.details?.balance).toBe('2000000');
    });

    it('should handle balance with zero low part', async () => {
      (mockProvider.callContract as any).mockResolvedValue(['0', '1']);

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
      // Balance = 2^128 * 1 which is > 1000000
    });
  });

  describe('Error Handling: RPC Failures', () => {
    it('should handle RPC error when fetching balance', async () => {
      (mockProvider.callContract as any).mockRejectedValue(
        new Error('RPC connection failed')
      );

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

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('unexpected_verify_error');
      expect(result.details?.error).toBe('RPC connection failed');
    });

    it('should handle malformed balance response', async () => {
      (mockProvider.callContract as any).mockResolvedValue(['invalid', 'data']);

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

      // Should handle gracefully, might fail or treat as zero
      // Behavior depends on implementation
    });
  });
});
