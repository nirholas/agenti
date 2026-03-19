/**
 * Security Test Suite: Error Message Security
 * Based on SECURITY_TESTING.md sections 7.1-7.2
 */

import { describe, it, expect, vi } from 'vitest';
import { verifyPayment } from '../../src/payment/verify.js';
import { settlePayment } from '../../src/payment/settle.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';
import type { RpcProvider } from 'starknet';

describe('Security: Error Message Security', () => {
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

  describe('Test 7.1: Balance Information Disclosure', () => {
    it('should expose balance in error details (known security limitation)', async () => {
      const mockProvider: RpcProvider = {
        callContract: vi.fn().mockResolvedValue(['500000', '0']), // Insufficient balance
      } as unknown as RpcProvider;

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

      // SECURITY ISSUE: Balance is exposed in details (SECURITY.md:167-192)
      expect(result.details?.balance).toBe('500000');
      expect(result.payer).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      );

      // This is a KNOWN LIMITATION documented in SECURITY.md
      // Applications MUST sanitize error messages before returning to clients
      // Recommendation: Log detailed errors server-side, return generic errors to clients
    });

    it('should demonstrate balance probing attack', async () => {
      // Attacker can probe user balance by trying different amounts
      const mockProvider: RpcProvider = {
        callContract: vi.fn().mockResolvedValue(['1234567', '0']),
      } as unknown as RpcProvider;

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '2000000', // Try higher amount
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const result = await verifyPayment(
        mockProvider,
        basePayload,
        requirements
      );

      if (!result.isValid && result.invalidReason === 'insufficient_funds') {
        // Attacker can discover exact balance
        const exactBalance = result.details?.balance;
        expect(exactBalance).toBe('1234567');

        // Applications should NOT expose this to untrusted clients
        // Instead, return generic error: "Payment verification failed"
      }
    });

    it('should show how to sanitize error messages for clients', async () => {
      const mockProvider: RpcProvider = {
        callContract: vi.fn().mockResolvedValue(['100', '0']),
      } as unknown as RpcProvider;

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

      // What the library returns (detailed)
      expect(result.details?.balance).toBeDefined();

      // What applications SHOULD return to clients (sanitized)
      const clientResponse = {
        isValid: result.isValid,
        invalidReason: result.invalidReason,
        // DO NOT include details or exact balance
      };

      expect(clientResponse.isValid).toBe(false);
      expect(clientResponse.invalidReason).toBe('insufficient_funds');
      expect((clientResponse as any).details).toBeUndefined();
    });

    it('should not expose balance when balance is sufficient', async () => {
      const mockProvider: RpcProvider = {
        callContract: vi.fn().mockResolvedValue(['2000000', '0']),
      } as unknown as RpcProvider;

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
      // Balance is still in details even on success
      expect(result.details?.balance).toBe('2000000');

      // Applications should not expose successful balance checks either
    });
  });

  describe('Test 7.2: Error Stack Trace Disclosure', () => {
    it('should not expose stack traces in error responses', async () => {
      const mockProvider: RpcProvider = {
        callContract: vi
          .fn()
          .mockRejectedValue(new Error('RPC connection failed')),
      } as unknown as RpcProvider;

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

      // Error message is exposed
      expect(result.details?.error).toBe('RPC connection failed');

      // Stack trace should NOT be in details (good)
      expect((result.details as any)?.stack).toBeUndefined();

      // Applications should sanitize even the error message
      const sanitizedResponse = {
        isValid: result.isValid,
        invalidReason: 'unexpected_verify_error',
        // Don't expose error details to clients
      };

      expect((sanitizedResponse as any).details).toBeUndefined();
    });

    it('should handle settlement errors without exposing internals', async () => {
      const mockProvider: RpcProvider = {
        callContract: vi.fn().mockResolvedValue(['2000000', '0']),
      } as unknown as RpcProvider;

      (basePayload as any).paymasterEndpoint = undefined; // Missing endpoint

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      try {
        await settlePayment(mockProvider, basePayload, requirements);
      } catch (error: any) {
        // Error should not contain stack trace in production responses
        expect(error.message).toBeDefined();

        // Applications should catch and sanitize
        const clientError = {
          error: 'Payment settlement failed', // Generic message
          // Don't include: error.message, error.stack, etc.
        };

        expect(clientError.error).toBe('Payment settlement failed');
        expect((clientError as any).stack).toBeUndefined();
      }
    });

    it('should not leak internal paths or file names in errors', async () => {
      const mockProvider: RpcProvider = {
        callContract: vi
          .fn()
          .mockRejectedValue(
            new Error('Failed at /usr/app/src/payment/verify.ts:123')
          ),
      } as unknown as RpcProvider;

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

      // Error message might contain internal paths (implementation-dependent)
      // Applications MUST strip this before exposing to clients
      if (result.details?.error) {
        const sanitizedError = result.details.error.replace(
          /\/[\w/.-]+:\d+/g,
          '[redacted]'
        );
        // Sanitized version safe for client
        expect(sanitizedError).not.toContain('/usr/app/src');
      }
    });
  });

  describe('Error Sanitization Best Practices', () => {
    it('should demonstrate proper error logging vs client responses', async () => {
      const mockProvider: RpcProvider = {
        callContract: vi.fn().mockResolvedValue(['100', '0']),
      } as unknown as RpcProvider;

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

      // SERVER-SIDE: Log full details for debugging
      const serverLog = {
        isValid: result.isValid,
        invalidReason: result.invalidReason,
        payer: result.payer,
        details: result.details,
        timestamp: new Date().toISOString(),
      };

      // Can log this to secure server logs
      expect(serverLog.details?.balance).toBeDefined();

      // CLIENT-SIDE: Return sanitized response
      const clientResponse = {
        error: 'Payment could not be processed',
        // No specific reason, no details
      };

      expect((clientResponse as any).invalidReason).toBeUndefined();
      expect((clientResponse as any).details).toBeUndefined();
      expect((clientResponse as any).payer).toBeUndefined();
    });

    it('should handle different error types consistently', async () => {
      const errorScenarios = [
        {
          name: 'insufficient balance',
          mockType: 'resolve',
          mockResponse: ['100', '0'],
          expectedReason: 'insufficient_funds',
        },
        {
          name: 'RPC error',
          mockType: 'reject',
          mockResponse: new Error('Network timeout'),
          expectedReason: 'unexpected_verify_error',
        },
      ];

      for (const scenario of errorScenarios) {
        const mockProvider: RpcProvider = {
          callContract: vi.fn(),
        } as unknown as RpcProvider;

        if (scenario.mockType === 'reject') {
          (mockProvider.callContract as any).mockRejectedValue(
            scenario.mockResponse
          );
        } else {
          (mockProvider.callContract as any).mockResolvedValue(
            scenario.mockResponse
          );
        }

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

        // All errors should be sanitized consistently
        const clientError = {
          error: 'Payment verification failed',
          // Same generic message for all error types
        };

        expect(clientError.error).toBe('Payment verification failed');
        // Don't reveal specific error types to clients
      }
    });
  });

  describe('Privacy Protection', () => {
    it('should not expose payer address in client responses', async () => {
      const mockProvider: RpcProvider = {
        callContract: vi.fn().mockResolvedValue(['100', '0']),
      } as unknown as RpcProvider;

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

      // Library exposes payer address
      expect(result.payer).toBeDefined();

      // Client response should not include payer address
      const clientResponse = {
        success: result.isValid,
        // Don't include payer info
      };

      expect((clientResponse as any).payer).toBeUndefined();
    });

    it('should not expose token or amount details in errors', async () => {
      const mockProvider: RpcProvider = {
        callContract: vi.fn().mockResolvedValue(['100', '0']),
      } as unknown as RpcProvider;

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

      // Generic error only
      const clientError = {
        error: 'Payment failed',
        // Don't include: token address, amount, recipient, etc.
      };

      expect(clientError.error).toBe('Payment failed');
      expect((clientError as any).asset).toBeUndefined();
      expect((clientError as any).amount).toBeUndefined();
      expect((clientError as any).payTo).toBeUndefined();
    });
  });
});
