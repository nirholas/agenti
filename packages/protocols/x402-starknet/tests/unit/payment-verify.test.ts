import { describe, it, expect, vi } from 'vitest';
import {
  verifyPayment,
  extractPayerAddress,
} from '../../src/payment/verify.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';
import type { RpcProvider } from 'starknet';

describe('Payment Verification', () => {
  const mockPaymentRequirements: PaymentRequirements = {
    scheme: 'exact',
    network: 'starknet:sepolia',
    amount: '1000000',
    asset: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    payTo: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    maxTimeoutSeconds: 3600,
  };

  const mockPayload: PaymentPayload = {
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

  describe('extractPayerAddress', () => {
    it('should extract payer from authorization', () => {
      const payer = extractPayerAddress(mockPayload);
      expect(payer).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      );
    });
  });

  describe('verifyPayment', () => {
    it('should verify valid payment with sufficient balance', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['2000000', '0']), // Balance: 2M (> 1M required)
      } as unknown as RpcProvider;

      const result = await verifyPayment(
        mockProvider,
        mockPayload,
        mockPaymentRequirements
      );

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      );
      expect(result.details?.balance).toBe('2000000');
    });

    it('should reject payment with insufficient balance', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['500000', '0']), // Balance: 500K (< 1M required)
      } as unknown as RpcProvider;

      const result = await verifyPayment(
        mockProvider,
        mockPayload,
        mockPaymentRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('insufficient_funds');
      expect(result.payer).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      );
      expect(result.details?.balance).toBe('500000');
    });

    it('should reject payment with wrong network', async () => {
      const mockProvider = {} as RpcProvider;

      const wrongNetworkPayload: PaymentPayload = {
        ...mockPayload,
        accepted: {
          ...mockPayload.accepted,
          network: 'starknet:mainnet', // Different from requirement (sepolia)
        },
      };

      const result = await verifyPayment(
        mockProvider,
        wrongNetworkPayload,
        mockPaymentRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_network');
    });

    it('should verify when scheme matches (both exact)', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['2000000', '0']), // Sufficient balance
      } as unknown as RpcProvider;

      const wrongSchemeRequirements: PaymentRequirements = {
        ...mockPaymentRequirements,
        scheme: 'exact' as const,
      };

      // Both payload and requirements have 'exact' scheme
      const result = await verifyPayment(
        mockProvider,
        mockPayload,
        wrongSchemeRequirements
      );

      // Should pass since both are 'exact' and balance is sufficient
      expect(result.isValid).toBe(true);
    });

    it('should reject payment with wrong token', async () => {
      const mockProvider = {} as RpcProvider;

      const wrongTokenPayload: PaymentPayload = {
        ...mockPayload,
        payload: {
          ...mockPayload.payload,
          authorization: {
            ...mockPayload.payload.authorization,
            token:
              '0x999999999999999999999999999999999999999999999999999999999999999', // Different token
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        wrongTokenPayload,
        mockPaymentRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_token_mismatch'
      );
    });

    it('should reject payment with wrong recipient', async () => {
      const mockProvider = {} as RpcProvider;

      const wrongRecipientPayload: PaymentPayload = {
        ...mockPayload,
        payload: {
          ...mockPayload.payload,
          authorization: {
            ...mockPayload.payload.authorization,
            to: '0x888888888888888888888888888888888888888888888888888888888888888', // Different recipient
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        wrongRecipientPayload,
        mockPaymentRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_recipient_mismatch'
      );
    });

    it('should reject payment with wrong amount', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['5000000', '0']),
      } as unknown as RpcProvider;

      const wrongAmountPayload: PaymentPayload = {
        ...mockPayload,
        payload: {
          ...mockPayload.payload,
          authorization: {
            ...mockPayload.payload.authorization,
            amount: '500000', // Different from requirement (1M)
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        wrongAmountPayload,
        mockPaymentRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_starknet_payload_authorization_value'
      );
    });

    it('should handle provider errors gracefully', async () => {
      const mockProvider = {
        callContract: vi.fn().mockRejectedValue(new Error('RPC error')),
      } as unknown as RpcProvider;

      const result = await verifyPayment(
        mockProvider,
        mockPayload,
        mockPaymentRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('unexpected_verify_error');
      expect(result.details?.error).toBe('RPC error');
    });

    it('should handle zero balance', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['0', '0']),
      } as unknown as RpcProvider;

      const result = await verifyPayment(
        mockProvider,
        mockPayload,
        mockPaymentRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('insufficient_funds');
      expect(result.details?.balance).toBe('0');
    });

    it('should handle exact balance match', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['1000000', '0']), // Exactly required amount
      } as unknown as RpcProvider;

      const result = await verifyPayment(
        mockProvider,
        mockPayload,
        mockPaymentRequirements
      );

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      );
    });

    it('should handle large Uint256 balances', async () => {
      const mockProvider = {
        callContract: vi
          .fn()
          .mockResolvedValue(['0xffffffffffffffffffffffffffffffff', '0x1']),
      } as unknown as RpcProvider;

      const result = await verifyPayment(
        mockProvider,
        mockPayload,
        mockPaymentRequirements
      );

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      );
      expect(result.details?.balance).toBeDefined();
    });

    it('should reject payment with invalid validUntil format', async () => {
      const mockProvider = {} as RpcProvider;

      const invalidTimestampPayload: PaymentPayload = {
        ...mockPayload,
        payload: {
          ...mockPayload.payload,
          authorization: {
            ...mockPayload.payload.authorization,
            validUntil: 'not-a-number',
          },
        },
      };

      const result = await verifyPayment(
        mockProvider,
        invalidTimestampPayload,
        mockPaymentRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
      // Schema validation catches this before our code
      expect(result.details?.error).toBeDefined();
    });

    it('should verify payment with valid signature using typedData', async () => {
      const mockProvider = {
        callContract: vi.fn((request) => {
          // Mock balance check for balanceOf
          if (request.entrypoint === 'balanceOf') {
            return Promise.resolve(['2000000', '0']);
          }
          // Mock signature verification for isValidSignature
          if (request.entrypoint === 'isValidSignature') {
            return Promise.resolve(['0x1']); // Valid signature
          }
          return Promise.resolve(['0']);
        }),
      } as unknown as RpcProvider;

      const payloadWithTypedData: PaymentPayload = {
        ...mockPayload,
        typedData: {
          types: {
            StarknetDomain: [
              { name: 'name', type: 'shortstring' },
              { name: 'version', type: 'shortstring' },
              { name: 'chainId', type: 'shortstring' },
              { name: 'revision', type: 'shortstring' },
            ],
            Authorization: [
              { name: 'from', type: 'ContractAddress' },
              { name: 'to', type: 'ContractAddress' },
              { name: 'token', type: 'ContractAddress' },
              { name: 'amount', type: 'u256' },
              { name: 'nonce', type: 'felt' },
              { name: 'validUntil', type: 'felt' },
            ],
          },
          primaryType: 'Authorization',
          domain: {
            name: 'x402',
            version: '1',
            chainId: '0x534e5f5345504f4c4941',
            revision: '1',
          },
          message: mockPayload.payload.authorization,
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payloadWithTypedData,
        mockPaymentRequirements
      );

      expect(result.isValid).toBe(true);
    });

    it('should skip signature verification with invalid typedData', async () => {
      const mockProvider = {
        callContract: vi.fn((request) => {
          // Mock balance check for balanceOf
          if (request.entrypoint === 'balanceOf') {
            return Promise.resolve(['2000000', '0']);
          }
          return Promise.resolve(['0']);
        }),
      } as unknown as RpcProvider;

      // Provide invalid typedData that won't validate
      const payloadWithInvalidTypedData: PaymentPayload = {
        ...mockPayload,
        typedData: {
          types: {},
          primaryType: 'Invalid',
          domain: {},
          message: {},
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payloadWithInvalidTypedData,
        mockPaymentRequirements
      );

      // Should succeed - invalid typedData is skipped, signature verified at settlement
      expect(result.isValid).toBe(true);
    });

    it('should handle signature verification network errors gracefully', async () => {
      const mockProvider = {
        callContract: vi.fn((request) => {
          // Mock balance check for balanceOf
          if (request.entrypoint === 'balanceOf') {
            return Promise.resolve(['2000000', '0']);
          }
          // Mock signature verification error
          if (request.entrypoint === 'isValidSignature') {
            return Promise.reject(new Error('Network timeout'));
          }
          return Promise.resolve(['0']);
        }),
      } as unknown as RpcProvider;

      const payloadWithTypedData: PaymentPayload = {
        ...mockPayload,
        typedData: {
          types: {
            StarknetDomain: [
              { name: 'name', type: 'shortstring' },
              { name: 'version', type: 'shortstring' },
              { name: 'chainId', type: 'shortstring' },
              { name: 'revision', type: 'shortstring' },
            ],
            Authorization: [
              { name: 'from', type: 'ContractAddress' },
              { name: 'to', type: 'ContractAddress' },
              { name: 'token', type: 'ContractAddress' },
              { name: 'amount', type: 'u256' },
              { name: 'nonce', type: 'felt' },
              { name: 'validUntil', type: 'felt' },
            ],
          },
          primaryType: 'Authorization',
          domain: {
            name: 'x402',
            version: '1',
            chainId: '0x534e5f5345504f4c4941',
            revision: '1',
          },
          message: mockPayload.payload.authorization,
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payloadWithTypedData,
        mockPaymentRequirements
      );

      // Should succeed because signature verification errors are skipped
      expect(result.isValid).toBe(true);
    });

    it('should skip signature verification on unknown errors', async () => {
      const mockProvider = {
        callContract: vi.fn((request) => {
          if (request.entrypoint === 'balanceOf') {
            return Promise.resolve(['2000000', '0']);
          }
          if (request.entrypoint === 'isValidSignature') {
            return Promise.reject(new Error('Unknown network error'));
          }
          return Promise.resolve(['0']);
        }),
      } as unknown as RpcProvider;

      const payloadWithTypedData: PaymentPayload = {
        ...mockPayload,
        typedData: {
          types: {
            StarknetDomain: [
              { name: 'name', type: 'shortstring' },
              { name: 'version', type: 'shortstring' },
              { name: 'chainId', type: 'shortstring' },
              { name: 'revision', type: 'shortstring' },
            ],
            Authorization: [
              { name: 'from', type: 'ContractAddress' },
              { name: 'to', type: 'ContractAddress' },
              { name: 'token', type: 'ContractAddress' },
              { name: 'amount', type: 'u256' },
              { name: 'nonce', type: 'felt' },
              { name: 'validUntil', type: 'felt' },
            ],
          },
          primaryType: 'Authorization',
          domain: {
            name: 'x402',
            version: '1',
            chainId: '0x534e5f5345504f4c4941',
            revision: '1',
          },
          message: mockPayload.payload.authorization,
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payloadWithTypedData,
        mockPaymentRequirements
      );

      // Should succeed - signature verification errors are caught and skipped
      expect(result.isValid).toBe(true);
    });

    it('should verify payment without typedData', async () => {
      const mockProvider = {
        callContract: vi.fn((request) => {
          if (request.entrypoint === 'balanceOf') {
            return Promise.resolve(['2000000', '0']);
          }
          return Promise.resolve(['0']);
        }),
      } as unknown as RpcProvider;

      // Payment without typedData - signature verification skipped
      const result = await verifyPayment(
        mockProvider,
        mockPayload, // No typedData field
        mockPaymentRequirements
      );

      // Should succeed - signature will be verified during settlement
      expect(result.isValid).toBe(true);
    });

    it('should accept non-zero signature verification result (VALID magic)', async () => {
      const mockProvider = {
        callContract: vi.fn((request) => {
          if (request.entrypoint === 'balanceOf') {
            return Promise.resolve(['2000000', '0']);
          }
          if (request.entrypoint === 'isValidSignature') {
            return Promise.resolve(['0x56414c4944']); // 'VALID' magic value
          }
          return Promise.resolve(['0']);
        }),
      } as unknown as RpcProvider;

      const payloadWithTypedData: PaymentPayload = {
        ...mockPayload,
        typedData: {
          types: {
            StarknetDomain: [
              { name: 'name', type: 'shortstring' },
              { name: 'version', type: 'shortstring' },
              { name: 'chainId', type: 'shortstring' },
              { name: 'revision', type: 'shortstring' },
            ],
            Authorization: [
              { name: 'from', type: 'ContractAddress' },
              { name: 'to', type: 'ContractAddress' },
              { name: 'token', type: 'ContractAddress' },
              { name: 'amount', type: 'u256' },
              { name: 'nonce', type: 'felt' },
              { name: 'validUntil', type: 'felt' },
            ],
          },
          primaryType: 'Authorization',
          domain: {
            name: 'x402',
            version: '1',
            chainId: '0x534e5f5345504f4c4941',
            revision: '1',
          },
          message: mockPayload.payload.authorization,
        },
      };

      const result = await verifyPayment(
        mockProvider,
        payloadWithTypedData,
        mockPaymentRequirements
      );

      expect(result.isValid).toBe(true);
    });
  });
});
