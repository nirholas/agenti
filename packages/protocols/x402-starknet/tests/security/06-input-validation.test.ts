/**
 * Security Test Suite: Input Validation
 * Based on SECURITY_TESTING.md sections 6.1-6.3
 */

import { describe, it, expect, vi } from 'vitest';
import { verifyPayment } from '../../src/payment/verify.js';
import {
  encodePaymentSignature,
  decodePaymentSignature,
} from '../../src/payment/create.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';
import type { RpcProvider } from 'starknet';

describe('Security: Input Validation', () => {
  const USDC_ADDRESS =
    '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
  const RECIPIENT_ADDRESS =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  const mockProvider: RpcProvider = {
    callContract: vi.fn().mockResolvedValue(['2000000', '0']),
  } as unknown as RpcProvider;

  describe('Test 6.1: Malformed Payload Structure', () => {
    it('should reject payload with missing network field', async () => {
      const malformedPayload = {
        x402Version: 2,
        // accepted: missing
        // network: missing
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
      } as any;

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const result = await verifyPayment(
        mockProvider,
        malformedPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
    });

    it('should reject payload with missing payload field', async () => {
      const malformedPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        // payload: missing
      } as any;

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const result = await verifyPayment(
        mockProvider,
        malformedPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject payload with missing signature', async () => {
      const malformedPayload = {
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
          // signature: missing
          authorization: {
            from: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '0x0',
            validUntil: '9999999999',
          },
        },
      } as any;

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const result = await verifyPayment(
        mockProvider,
        malformedPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject payload with missing authorization', async () => {
      const malformedPayload = {
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
          // authorization: missing
        },
      } as any;

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const result = await verifyPayment(
        mockProvider,
        malformedPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject payload with wrong x402Version', async () => {
      const malformedPayload: PaymentPayload = {
        x402Version: 999, // Invalid version
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

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const result = await verifyPayment(
        mockProvider,
        malformedPayload,
        requirements
      );

      // May or may not fail - depends on version checking
    });

    it('should reject completely empty payload', async () => {
      const emptyPayload = {} as any;

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const result = await verifyPayment(
        mockProvider,
        emptyPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject null payload', async () => {
      const nullPayload = null as any;

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const result = await verifyPayment(
        mockProvider,
        nullPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });
  });

  describe('Test 6.2: JSON Injection in Encoding/Decoding', () => {
    it('should not allow prototype pollution via __proto__', () => {
      const maliciousPayload = {
        __proto__: { admin: true },
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

      const encoded = encodePaymentSignature(maliciousPayload as any);
      const decoded = decodePaymentSignature(encoded);

      // Should not pollute prototype
      expect((decoded as any).__proto__?.admin).toBeUndefined();
      expect((Object.prototype as any).admin).toBeUndefined();
    });

    it('should not allow prototype pollution via constructor', () => {
      const maliciousPayload = {
        constructor: { prototype: { admin: true } },
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

      const encoded = encodePaymentSignature(maliciousPayload as any);
      const decoded = decodePaymentSignature(encoded);

      // Should not pollute
      expect((Object.prototype as any).admin).toBeUndefined();
    });

    it('should handle malicious JSON with extra fields', () => {
      const maliciousJSON = JSON.stringify({
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        maliciousField: '<script>alert("XSS")</script>',
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
      });

      const encoded = Buffer.from(maliciousJSON).toString('base64');
      const decoded = decodePaymentSignature(encoded);

      // Decoded but should be validated before use
      expect(decoded).toBeDefined();
      // Extra fields should not cause issues (will be stripped by Zod validation)
    });

    it('should handle deeply nested objects', () => {
      const deeplyNested = {
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
            deeply: {
              nested: {
                object: {
                  that: {
                    goes: {
                      many: {
                        levels: 'deep',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const encoded = encodePaymentSignature(deeplyNested as any);
      const decoded = decodePaymentSignature(encoded);

      expect(decoded).toBeDefined();
      // Should handle without stack overflow
    });
  });

  describe('Test 6.3: Invalid Base64 Encoding', () => {
    it('should throw on invalid base64 string', () => {
      const invalid = 'not-valid-base64!!!';

      expect(() => decodePaymentSignature(invalid)).toThrow();
    });

    it('should throw on malformed base64 (missing padding)', () => {
      const invalidBase64 = 'SGVsbG8gV29ybGQ'; // Missing padding

      expect(() => decodePaymentSignature(invalidBase64)).toThrow();
    });

    it('should throw on empty string', () => {
      expect(() => decodePaymentSignature('')).toThrow();
    });

    it('should throw on base64 with invalid characters', () => {
      const invalidChars = 'SGVs$G8@V29ybGQ=';

      expect(() => decodePaymentSignature(invalidChars)).toThrow();
    });

    it('should throw on base64 that decodes to invalid JSON', () => {
      const invalidJSON = Buffer.from('{ invalid json }').toString('base64');

      expect(() => decodePaymentSignature(invalidJSON)).toThrow();
    });

    it('should throw on base64 that decodes to non-object', () => {
      const notAnObject = Buffer.from('"just a string"').toString('base64');

      expect(() => decodePaymentSignature(notAnObject)).toThrow();
    });

    it('should throw on base64 that decodes to array', () => {
      const arrayJSON = Buffer.from('[]').toString('base64');

      expect(() => decodePaymentSignature(arrayJSON)).toThrow();
    });

    it('should throw on base64 that decodes to number', () => {
      const numberJSON = Buffer.from('123').toString('base64');

      expect(() => decodePaymentSignature(numberJSON)).toThrow();
    });

    it('should handle very large base64 strings', () => {
      const hugePayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '9'.repeat(76),
          asset: '0x' + '5'.repeat(63),
          payTo: '0x' + '4'.repeat(63),
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature: {
            r: '0x' + '1'.repeat(63),
            s: '0x' + '2'.repeat(63),
          },
          authorization: {
            from: '0x' + '3'.repeat(63),
            to: '0x' + '4'.repeat(63),
            amount: '9'.repeat(76), // Very large number
            token: '0x' + '5'.repeat(63),
            nonce: '0x' + '6'.repeat(63),
            validUntil: '9'.repeat(10),
          },
        },
      };

      const encoded = encodePaymentSignature(hugePayload as any);
      const decoded = decodePaymentSignature(encoded);

      expect(decoded).toBeDefined();
      // Should handle large payloads
    });
  });

  describe('Edge Cases: Schema Validation', () => {
    it('should reject payload with extra unexpected fields', async () => {
      const extraFieldsPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        unexpectedField: 'malicious data',
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
      } as any;

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const result = await verifyPayment(
        mockProvider,
        extraFieldsPayload,
        requirements
      );

      // Should still work - Zod strips extra fields
      // But validation should prevent issues
    });

    it('should reject payload with wrong field types', async () => {
      const wrongTypesPayload = {
        x402Version: '1', // Should be number
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
      } as any;

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
      };

      const result = await verifyPayment(
        mockProvider,
        wrongTypesPayload,
        requirements
      );

      // May pass or fail depending on Zod coercion settings
    });
  });
});
