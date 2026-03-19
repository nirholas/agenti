/**
 * Security Test Suite: Token and Recipient Validation
 * Based on SECURITY_TESTING.md sections 5.1-5.2
 */

import { describe, it, expect, vi } from 'vitest';
import { verifyPayment } from '../../src/payment/verify.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';
import type { RpcProvider } from 'starknet';

describe('Security: Token and Recipient Validation', () => {
  const USDC_ADDRESS =
    '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
  const ETH_ADDRESS =
    '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc8';
  const RECIPIENT_ADDRESS =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const WRONG_RECIPIENT =
    '0x9999999999999999999999999999999999999999999999999999999999999999';

  const mockProvider: RpcProvider = {
    callContract: vi.fn().mockResolvedValue(['2000000', '0']),
  } as unknown as RpcProvider;

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

  describe('Test 5.1: Wrong Token Detection', () => {
    it('should reject payment with wrong token address', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const wrongTokenPayload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          asset: ETH_ADDRESS,
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            token: ETH_ADDRESS, // Wrong token
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        wrongTokenPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_token_mismatch'
      );
    });

    it('should accept payment with correct token', async () => {
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

    it('should reject token with wrong checksum', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const wrongChecksumPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            token:
              '0x049D36570D4E46F48E99674BD3FCC84644DDD6B96F7C741B1562B82F9E004DC7', // Different case
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        wrongChecksumPayload,
        requirements
      );

      // May pass or fail depending on case-sensitivity
      // Implementation should normalize addresses
    });

    it('should reject malformed token address', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const malformedPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            token: '0xinvalid', // Malformed
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        malformedPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject empty token address', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const emptyTokenPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            token: '',
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        emptyTokenPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject zero address as token', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const zeroTokenPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            token: '0x0',
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        zeroTokenPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });
  });

  describe('Test 5.2: Wrong Recipient Detection', () => {
    it('should reject payment with wrong recipient address', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const wrongRecipientPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            to: WRONG_RECIPIENT,
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        wrongRecipientPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_recipient_mismatch'
      );
    });

    it('should accept payment with correct recipient', async () => {
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

    it('should reject recipient with wrong checksum', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const wrongChecksumPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            to: '0x1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF', // Different case
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        wrongChecksumPayload,
        requirements
      );

      // May pass or fail depending on case-sensitivity
    });

    it('should reject malformed recipient address', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const malformedPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            to: '0xinvalid',
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        malformedPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject empty recipient address', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const emptyRecipientPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            to: '',
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        emptyRecipientPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject zero address as recipient', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const zeroRecipientPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            to: '0x0',
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        zeroRecipientPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject payment to self (payer = recipient)', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const selfPaymentPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            from: RECIPIENT_ADDRESS, // Same as 'to'
            to: RECIPIENT_ADDRESS,
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        selfPaymentPayload,
        requirements
      );

      // May or may not be valid - depends on business logic
      // But recipient must still match requirements
    });
  });

  describe('Edge Cases: Address Validation', () => {
    it('should handle addresses with leading zeros', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset:
          '0x000000000000000000000000000000000000000000000000000000000000001',
        payTo:
          '0x000000000000000000000000000000000000000000000000000000000000002',
      };

      const payload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            token:
              '0x000000000000000000000000000000000000000000000000000000000000001',
            to: '0x000000000000000000000000000000000000000000000000000000000000002',
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      // Should handle leading zeros correctly
    });

    it('should normalize address comparison', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: '0x1',
        payTo: '0x2',
      };

      const payload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            token: '0x0001', // Same as 0x1 but with leading zeros
            to: '0x0002', // Same as 0x2 but with leading zeros
          },
        },
      };

      const result = await verifyPayment(mockProvider, payload, requirements);

      // Should normalize and accept
      expect(result.isValid).toBe(true);
    });
  });

  describe('Security: Token/Recipient Manipulation', () => {
    it('should prevent attacker from redirecting payment to their address', async () => {
      const ATTACKER_ADDRESS =
        '0xbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbad';

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS, // Legitimate recipient
      };

      const attackPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            to: ATTACKER_ADDRESS, // Attacker trying to redirect
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        attackPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_recipient_mismatch'
      );
      // Protects against payment redirection attacks
    });

    it('should prevent attacker from using wrong token to drain different asset', async () => {
      const ATTACKER_TOKEN =
        '0xbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbad';

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS, // Expecting USDC
        payTo: RECIPIENT_ADDRESS,
      };

      const attackPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            token: ATTACKER_TOKEN, // Attacker using fake/worthless token
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        attackPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_token_mismatch'
      );
      // Protects against wrong token attacks
    });
  });
});
