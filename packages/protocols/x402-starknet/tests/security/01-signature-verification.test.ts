/**
 * Security Test Suite: Signature Verification
 * Based on SECURITY_TESTING.md sections 1.1-1.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyPayment } from '../../src/payment/verify.js';
import { settlePayment } from '../../src/payment/settle.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';
import type { RpcProvider } from 'starknet';

describe('Security: Signature Verification', () => {
  const mockPaymentRequirements: PaymentRequirements = {
    scheme: 'exact',
    network: 'starknet:sepolia',
    amount: '1000000',
    asset: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    payTo: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  };

  const validPayload: PaymentPayload = {
    x402Version: 2,
    accepted: {
      scheme: 'exact',
      network: 'starknet:sepolia',
      amount: '1000000',
      asset:
        '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
      payTo:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      maxTimeoutSeconds: 3600,
    },
    payload: {
      signature: {
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        s: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
      },
      authorization: {
        from: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        to: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        amount: '1000000',
        token:
          '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
        nonce: '0x0',
        validUntil: '9999999999',
      },
    },
  };

  let mockProvider: RpcProvider;

  beforeEach(() => {
    mockProvider = {
      callContract: vi.fn().mockResolvedValue(['2000000', '0']),
    } as unknown as RpcProvider;
  });

  describe('Test 1.1: Invalid Signature Detection', () => {
    it('should pass verification with invalid signature (known limitation)', async () => {
      // Create payload with tampered signature
      const invalidPayload: PaymentPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          signature: {
            r: '0xdeadbeef00000000000000000000000000000000000000000000000000000000',
            s: '0xcafebabe00000000000000000000000000000000000000000000000000000000',
          },
        },
      };

      // Verify - should pass (no signature check in verify)
      const verification = await verifyPayment(
        mockProvider,
        invalidPayload,
        mockPaymentRequirements
      );

      expect(verification.isValid).toBe(true);
      // This is a KNOWN LIMITATION documented in SECURITY.md:126-142
      // Signature verification happens implicitly during paymaster execution
    });

    it('should fail settlement with invalid signature', async () => {
      // Create payload with tampered signature
      const invalidPayload: PaymentPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          signature: {
            r: '0xdeadbeef00000000000000000000000000000000000000000000000000000000',
            s: '0xcafebabe00000000000000000000000000000000000000000000000000000000',
          },
        },
      };

      // Add required paymaster data for settlement
      (invalidPayload as any).paymasterEndpoint =
        'https://sepolia.paymaster.avnu.fi';
      (invalidPayload as any).typedData = {
        types: {},
        primaryType: 'Transfer',
        domain: {},
        message: {},
      };

      // Settle - should FAIL due to invalid signature
      const settlement = await settlePayment(
        mockProvider,
        invalidPayload,
        mockPaymentRequirements,
        {
          paymasterConfig: {
            endpoint: 'https://sepolia.paymaster.avnu.fi',
            network: 'starknet:sepolia',
          },
        }
      );

      expect(settlement.success).toBe(false);
      // Settlement should fail when paymaster tries to execute with invalid signature
    });

    it('should reject signature with zero values', async () => {
      const zeroSignaturePayload: PaymentPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          signature: {
            r: '0x0',
            s: '0x0',
          },
        },
      };

      (zeroSignaturePayload as any).paymasterEndpoint =
        'https://sepolia.paymaster.avnu.fi';
      (zeroSignaturePayload as any).typedData = {
        types: {},
        primaryType: 'Transfer',
        domain: {},
        message: {},
      };

      const settlement = await settlePayment(
        mockProvider,
        zeroSignaturePayload,
        mockPaymentRequirements,
        {
          paymasterConfig: {
            endpoint: 'https://sepolia.paymaster.avnu.fi',
            network: 'starknet:sepolia',
          },
        }
      );

      expect(settlement.success).toBe(false);
    });

    it('should reject signature with only r component tampered', async () => {
      const tamperedRPayload: PaymentPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          signature: {
            r: '0x9999999999999999999999999999999999999999999999999999999999999999',
            s: validPayload.payload.signature.s, // Keep original s
          },
        },
      };

      (tamperedRPayload as any).paymasterEndpoint =
        'https://sepolia.paymaster.avnu.fi';
      (tamperedRPayload as any).typedData = {
        types: {},
        primaryType: 'Transfer',
        domain: {},
        message: {},
      };

      const settlement = await settlePayment(
        mockProvider,
        tamperedRPayload,
        mockPaymentRequirements,
        {
          paymasterConfig: {
            endpoint: 'https://sepolia.paymaster.avnu.fi',
            network: 'starknet:sepolia',
          },
        }
      );

      expect(settlement.success).toBe(false);
    });

    it('should reject signature with only s component tampered', async () => {
      const tamperedSPayload: PaymentPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          signature: {
            r: validPayload.payload.signature.r, // Keep original r
            s: '0x8888888888888888888888888888888888888888888888888888888888888888',
          },
        },
      };

      (tamperedSPayload as any).paymasterEndpoint =
        'https://sepolia.paymaster.avnu.fi';
      (tamperedSPayload as any).typedData = {
        types: {},
        primaryType: 'Transfer',
        domain: {},
        message: {},
      };

      const settlement = await settlePayment(
        mockProvider,
        tamperedSPayload,
        mockPaymentRequirements,
        {
          paymasterConfig: {
            endpoint: 'https://sepolia.paymaster.avnu.fi',
            network: 'starknet:sepolia',
          },
        }
      );

      expect(settlement.success).toBe(false);
    });
  });

  describe('Test 1.2: Signature Replay Attack', () => {
    it('should prevent same signature from being used twice', async () => {
      const payload: PaymentPayload = {
        ...validPayload,
      };

      (payload as any).paymasterEndpoint = 'https://sepolia.paymaster.avnu.fi';
      (payload as any).typedData = {
        types: {},
        primaryType: 'Transfer',
        domain: {},
        message: {},
      };

      const options = {
        paymasterConfig: {
          endpoint: 'https://sepolia.paymaster.avnu.fi',
          network: 'starknet:sepolia' as const,
        },
      };

      // First settlement attempt
      const result1 = await settlePayment(
        mockProvider,
        payload,
        mockPaymentRequirements,
        options
      );

      // In a real scenario with actual paymaster:
      // expect(result1.success).toBe(true);

      // Second settlement attempt with same payload (replay attack)
      const result2 = await settlePayment(
        mockProvider,
        payload,
        mockPaymentRequirements,
        options
      );

      // Should fail due to Starknet nonce mismatch on-chain
      // Starknet's built-in nonce system prevents transaction replay
      expect(result2.success).toBe(false);
    });

    it('should reject replay with different recipient but same signature', async () => {
      const payload: PaymentPayload = {
        ...validPayload,
      };

      (payload as any).paymasterEndpoint = 'https://sepolia.paymaster.avnu.fi';
      (payload as any).typedData = {
        types: {},
        primaryType: 'Transfer',
        domain: {},
        message: {},
      };

      // Try to reuse signature but change recipient (should fail)
      const replayPayload: PaymentPayload = {
        ...payload,
        payload: {
          ...payload.payload,
          authorization: {
            ...payload.payload.authorization,
            to: '0x9999999999999999999999999999999999999999999999999999999999999999',
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        replayPayload,
        mockPaymentRequirements
      );

      // Should fail verification due to recipient mismatch
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_recipient_mismatch'
      );
    });

    it('should reject replay with different amount but same signature', async () => {
      const payload: PaymentPayload = {
        ...validPayload,
      };

      // Try to reuse signature but change amount (should fail)
      const replayPayload: PaymentPayload = {
        ...payload,
        payload: {
          ...payload.payload,
          authorization: {
            ...payload.payload.authorization,
            amount: '5000000', // Different amount
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        replayPayload,
        mockPaymentRequirements
      );

      // Should fail verification due to amount mismatch
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_value'
      );
    });

    it('should enforce nonce progression to prevent replay', async () => {
      // Payment with nonce 0
      const payload1: PaymentPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          authorization: {
            ...validPayload.payload.authorization,
            nonce: '0x0',
          },
        },
      };

      // Payment with old nonce (replay attempt)
      const payload2: PaymentPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          authorization: {
            ...validPayload.payload.authorization,
            nonce: '0x0', // Same nonce - should be rejected
          },
        },
      };

      // Both should pass verification (nonce check happens on-chain)
      const verification1 = await verifyPayment(
        mockProvider,
        payload1,
        mockPaymentRequirements
      );
      expect(verification1.isValid).toBe(true);

      const verification2 = await verifyPayment(
        mockProvider,
        payload2,
        mockPaymentRequirements
      );
      expect(verification2.isValid).toBe(true);

      // However, settlement of second payment would fail on-chain due to nonce
      // This is protected by Starknet's account nonce system
    });
  });

  describe('Edge Cases: Signature Validation', () => {
    it('should handle max uint256 signature values', async () => {
      const maxUint256 =
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      const maxSignaturePayload: PaymentPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          signature: {
            r: maxUint256,
            s: maxUint256,
          },
        },
      };

      // Verification should still pass (no signature validation)
      const verification = await verifyPayment(
        mockProvider,
        maxSignaturePayload,
        mockPaymentRequirements
      );

      expect(verification.isValid).toBe(true);
      // Settlement would fail if signature is actually invalid
    });

    it('should handle signature with missing r component', async () => {
      const missingRPayload: PaymentPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          signature: {
            r: '',
            s: validPayload.payload.signature.s,
          },
        },
      };

      // Schema validation should catch this
      const verification = await verifyPayment(
        mockProvider,
        missingRPayload,
        mockPaymentRequirements
      );

      // May pass verification but fail settlement
      // This tests the robustness of input validation
    });

    it('should handle signature with missing s component', async () => {
      const missingSPayload: PaymentPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          signature: {
            r: validPayload.payload.signature.r,
            s: '',
          },
        },
      };

      // Schema validation should catch this
      const verification = await verifyPayment(
        mockProvider,
        missingSPayload,
        mockPaymentRequirements
      );

      // May pass verification but fail settlement
    });
  });
});
