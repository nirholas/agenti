/**
 * Tests for PaymentRequired schema compliance
 * Validates spec compliance with x402 v2 - PaymentRequired Schema
 */

import { describe, it, expect } from 'vitest';
import { PAYMENT_REQUIRED_SCHEMA } from '../../src/types/schemas.js';
import type { PaymentRequired } from '../../src/types/payment.js';

describe('PaymentRequired Schema Compliance', () => {
  describe('Valid PaymentRequired objects', () => {
    it('should accept a valid response with all required fields', () => {
      const validResponse: PaymentRequired = {
        x402Version: 2,
        error: 'X-PAYMENT header is required',
        resource: {
          url: 'https://api.example.com/data',
          description: 'Access to premium data',
        },
        accepts: [
          {
            scheme: 'exact',
            network: 'starknet:sepolia',
            amount: '1000000',
            asset:
              '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            payTo: '0x1234567890abcdef1234567890abcdef12345678',
            maxTimeoutSeconds: 60,
          },
        ],
      };

      const result = PAYMENT_REQUIRED_SCHEMA.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should accept response with multiple payment options in accepts array', () => {
      const validResponse: PaymentRequired = {
        x402Version: 2,
        error: 'Payment required for this resource',
        resource: {
          url: 'https://api.example.com/data',
        },
        accepts: [
          {
            scheme: 'exact',
            network: 'starknet:sepolia',
            amount: '1000000',
            asset:
              '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            payTo: '0x1234567890abcdef1234567890abcdef12345678',
            maxTimeoutSeconds: 60,
          },
          {
            scheme: 'exact',
            network: 'starknet:mainnet',
            amount: '2000000',
            asset:
              '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
            payTo: '0xabcdef1234567890abcdef1234567890abcdef12',
            maxTimeoutSeconds: 120,
          },
        ],
      };

      const result = PAYMENT_REQUIRED_SCHEMA.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should accept response with mcp:// resource URL', () => {
      const validResponse: PaymentRequired = {
        x402Version: 2,
        error: 'Payment required',
        resource: {
          url: 'mcp://example-server/premium-tool',
        },
        accepts: [
          {
            scheme: 'exact',
            network: 'starknet:sepolia',
            amount: '1000000',
            asset:
              '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            payTo: '0x1234567890abcdef1234567890abcdef12345678',
            maxTimeoutSeconds: 60,
          },
        ],
      };

      const result = PAYMENT_REQUIRED_SCHEMA.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should accept response without error field (optional)', () => {
      const validResponse: PaymentRequired = {
        x402Version: 2,
        resource: {
          url: 'https://api.example.com/data',
        },
        accepts: [
          {
            scheme: 'exact',
            network: 'starknet:sepolia',
            amount: '1000000',
            asset:
              '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            payTo: '0x1234567890abcdef1234567890abcdef12345678',
            maxTimeoutSeconds: 60,
          },
        ],
      };

      const result = PAYMENT_REQUIRED_SCHEMA.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should accept response with extra fields in payment requirements', () => {
      const validResponse: PaymentRequired = {
        x402Version: 2,
        resource: {
          url: 'https://api.example.com/data',
        },
        accepts: [
          {
            scheme: 'exact',
            network: 'starknet:sepolia',
            amount: '1000000',
            asset:
              '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            payTo: '0x1234567890abcdef1234567890abcdef12345678',
            maxTimeoutSeconds: 60,
            extra: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
          },
        ],
      };

      const result = PAYMENT_REQUIRED_SCHEMA.safeParse(validResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid PaymentRequired objects', () => {
    it('should reject response missing maxTimeoutSeconds field', () => {
      const invalidResponse = {
        x402Version: 2,
        resource: { url: 'https://api.example.com/data' },
        accepts: [
          {
            scheme: 'exact',
            network: 'starknet:sepolia',
            amount: '1000000',
            asset:
              '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            payTo: '0x1234567890abcdef1234567890abcdef12345678',
            // Missing maxTimeoutSeconds - required per spec
          },
        ],
      };

      const result = PAYMENT_REQUIRED_SCHEMA.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response with zero maxTimeoutSeconds', () => {
      const invalidResponse = {
        x402Version: 2,
        resource: { url: 'https://api.example.com/data' },
        accepts: [
          {
            scheme: 'exact',
            network: 'starknet:sepolia',
            amount: '1000000',
            asset:
              '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            payTo: '0x1234567890abcdef1234567890abcdef12345678',
            maxTimeoutSeconds: 0, // Must be positive
          },
        ],
      };

      const result = PAYMENT_REQUIRED_SCHEMA.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response with negative maxTimeoutSeconds', () => {
      const invalidResponse = {
        x402Version: 2,
        resource: { url: 'https://api.example.com/data' },
        accepts: [
          {
            scheme: 'exact',
            network: 'starknet:sepolia',
            amount: '1000000',
            asset:
              '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            payTo: '0x1234567890abcdef1234567890abcdef12345678',
            maxTimeoutSeconds: -10, // Must be positive
          },
        ],
      };

      const result = PAYMENT_REQUIRED_SCHEMA.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response missing resource field', () => {
      const invalidResponse = {
        x402Version: 2,
        // Missing resource field
        accepts: [
          {
            scheme: 'exact',
            network: 'starknet:sepolia',
            amount: '1000000',
            asset:
              '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            payTo: '0x1234567890abcdef1234567890abcdef12345678',
            maxTimeoutSeconds: 60,
          },
        ],
      };

      const result = PAYMENT_REQUIRED_SCHEMA.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response missing accepts field', () => {
      const invalidResponse = {
        x402Version: 2,
        resource: { url: 'https://api.example.com/data' },
        // Missing accepts field
      };

      const result = PAYMENT_REQUIRED_SCHEMA.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response with empty accepts array', () => {
      const invalidResponse = {
        x402Version: 2,
        resource: { url: 'https://api.example.com/data' },
        accepts: [], // Empty array
      };

      const result = PAYMENT_REQUIRED_SCHEMA.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response with wrong x402Version', () => {
      const invalidResponse = {
        x402Version: 1, // Wrong version - must be 2
        resource: { url: 'https://api.example.com/data' },
        accepts: [
          {
            scheme: 'exact',
            network: 'starknet:sepolia',
            amount: '1000000',
            asset:
              '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            payTo: '0x1234567890abcdef1234567890abcdef12345678',
            maxTimeoutSeconds: 60,
          },
        ],
      };

      const result = PAYMENT_REQUIRED_SCHEMA.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject response with empty resource URL', () => {
      const invalidResponse = {
        x402Version: 2,
        resource: { url: '' }, // Empty string not allowed
        accepts: [
          {
            scheme: 'exact',
            network: 'starknet:sepolia',
            amount: '1000000',
            asset:
              '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            payTo: '0x1234567890abcdef1234567890abcdef12345678',
            maxTimeoutSeconds: 60,
          },
        ],
      };

      const result = PAYMENT_REQUIRED_SCHEMA.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('Type safety', () => {
    it('should enforce correct TypeScript types', () => {
      // This test ensures TypeScript compilation catches type errors
      const response: PaymentRequired = {
        x402Version: 2,
        resource: { url: 'https://api.example.com/data' },
        accepts: [
          {
            scheme: 'exact',
            network: 'starknet:sepolia',
            amount: '1000000',
            asset:
              '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            payTo: '0x1234567890abcdef1234567890abcdef12345678',
            maxTimeoutSeconds: 60,
          },
        ],
      };

      expect(response.x402Version).toBe(2);
      expect(response.accepts).toHaveLength(1);
    });
  });

  describe('Spec compliance notes', () => {
    it('should document v2 PaymentRequired structure', () => {
      // This test documents the x402 v2 PaymentRequired structure
      // Ref: x402 v2 - PaymentRequired Schema
      //
      // Required fields:
      // - x402Version: 2
      // - resource: { url: string, description?: string, mimeType?: string }
      // - accepts: Array<PaymentRequirements>
      //
      // Optional fields:
      // - error: string
      // - extensions: Record<string, ExtensionData>

      const specCompliantResponse: PaymentRequired = {
        x402Version: 2,
        error: 'X-PAYMENT header is required',
        resource: {
          url: 'https://api.example.com/data',
          description: 'Protected API endpoint',
        },
        accepts: [
          {
            scheme: 'exact',
            network: 'starknet:sepolia',
            amount: '1000000',
            asset:
              '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            payTo: '0x1234567890abcdef1234567890abcdef12345678',
            maxTimeoutSeconds: 60,
          },
        ],
      };

      expect(specCompliantResponse).toHaveProperty('resource');
      expect(specCompliantResponse).toHaveProperty('accepts');
      expect(specCompliantResponse.x402Version).toBe(2);
    });
  });
});
