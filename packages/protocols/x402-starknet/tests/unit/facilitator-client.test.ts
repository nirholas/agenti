/**
 * Tests for FacilitatorClient
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FacilitatorClient,
  createFacilitatorClient,
} from '../../src/facilitator/client.js';
import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  SupportedResponse,
} from '../../src/types/index.js';

describe('FacilitatorClient', () => {
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
      maxTimeoutSeconds: 300,
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

  const mockRequirements: PaymentRequirements = {
    scheme: 'exact',
    network: 'starknet:sepolia',
    amount: '1000000',
    asset: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    payTo: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    maxTimeoutSeconds: 300,
  };

  describe('constructor', () => {
    it('should create client with base URL', () => {
      const client = new FacilitatorClient({
        baseUrl: 'https://facilitator.example.com',
      });
      expect(client).toBeInstanceOf(FacilitatorClient);
    });

    it('should normalize base URL by removing trailing slash', () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ kinds: [], extensions: [], signers: {} }),
      });

      const client = new FacilitatorClient({
        baseUrl: 'https://facilitator.example.com/',
        fetch: mockFetch,
      });

      void client.supported();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://facilitator.example.com/supported',
        expect.any(Object)
      );
    });
  });

  describe('createFacilitatorClient', () => {
    it('should create a client instance', () => {
      const client = createFacilitatorClient({
        baseUrl: 'https://facilitator.example.com',
      });
      expect(client).toBeInstanceOf(FacilitatorClient);
    });
  });

  describe('verify', () => {
    it('should make POST request to /verify', async () => {
      const mockVerifyResponse: VerifyResponse = {
        isValid: true,
        payer:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVerifyResponse),
      });

      const client = new FacilitatorClient({
        baseUrl: 'https://facilitator.example.com',
        fetch: mockFetch,
      });

      const result = await client.verify(mockPayload, mockRequirements);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://facilitator.example.com/verify',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual(mockVerifyResponse);
    });

    it('should return invalid response correctly', async () => {
      const mockVerifyResponse: VerifyResponse = {
        isValid: false,
        invalidReason: 'insufficient_funds',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVerifyResponse),
      });

      const client = new FacilitatorClient({
        baseUrl: 'https://facilitator.example.com',
        fetch: mockFetch,
      });

      const result = await client.verify(mockPayload, mockRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('insufficient_funds');
    });
  });

  describe('settle', () => {
    it('should make POST request to /settle', async () => {
      const mockSettleResponse: SettleResponse = {
        success: true,
        payer:
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        transaction:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        network: 'starknet:sepolia',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSettleResponse),
      });

      const client = new FacilitatorClient({
        baseUrl: 'https://facilitator.example.com',
        fetch: mockFetch,
      });

      const result = await client.settle(mockPayload, mockRequirements);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://facilitator.example.com/settle',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result).toEqual(mockSettleResponse);
    });

    it('should return failed settlement response correctly', async () => {
      const mockSettleResponse: SettleResponse = {
        success: false,
        errorReason: 'Transaction rejected',
        transaction: '',
        network: 'starknet:sepolia',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSettleResponse),
      });

      const client = new FacilitatorClient({
        baseUrl: 'https://facilitator.example.com',
        fetch: mockFetch,
      });

      const result = await client.settle(mockPayload, mockRequirements);

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe('Transaction rejected');
      expect(result.transaction).toBe('');
    });
  });

  describe('supported', () => {
    it('should make GET request to /supported', async () => {
      const mockSupportedResponse: SupportedResponse = {
        kinds: [
          {
            x402Version: 2,
            scheme: 'exact',
            network: 'starknet:sepolia',
          },
          {
            x402Version: 2,
            scheme: 'exact',
            network: 'starknet:mainnet',
          },
        ],
        extensions: [],
        signers: {
          'starknet:*': [
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          ],
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSupportedResponse),
      });

      const client = new FacilitatorClient({
        baseUrl: 'https://facilitator.example.com',
        fetch: mockFetch,
      });

      const result = await client.supported();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://facilitator.example.com/supported',
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result).toEqual(mockSupportedResponse);
      expect(result.kinds).toHaveLength(2);
    });
  });

  describe('authentication', () => {
    it('should include Authorization header when apiKey is provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ kinds: [], extensions: [], signers: {} }),
      });

      const client = new FacilitatorClient({
        baseUrl: 'https://facilitator.example.com',
        apiKey: 'test-api-key',
        fetch: mockFetch,
      });

      await client.supported();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should not include Authorization header when apiKey is not provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ kinds: [], extensions: [], signers: {} }),
      });

      const client = new FacilitatorClient({
        baseUrl: 'https://facilitator.example.com',
        fetch: mockFetch,
      });

      await client.supported();

      const calledWith = mockFetch.mock.calls[0];
      expect(calledWith[1].headers).not.toHaveProperty('Authorization');
    });
  });

  describe('error handling', () => {
    it('should throw network error on non-ok response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error details'),
      });

      const client = new FacilitatorClient({
        baseUrl: 'https://facilitator.example.com',
        fetch: mockFetch,
      });

      await expect(client.supported()).rejects.toThrow(
        'Facilitator request failed: 500 Internal Server Error'
      );
    });

    it('should throw network error on 404 response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Endpoint not found'),
      });

      const client = new FacilitatorClient({
        baseUrl: 'https://facilitator.example.com',
        fetch: mockFetch,
      });

      await expect(client.supported()).rejects.toThrow(
        'Facilitator request failed: 404 Not Found'
      );
    });

    it('should throw timeout error when request times out', async () => {
      const mockFetch = vi.fn().mockImplementation((_url, options) => {
        return new Promise((_, reject) => {
          const abortError = new Error('Aborted');
          abortError.name = 'AbortError';

          // Simulate abort being called
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              reject(abortError);
            });
          }

          // Trigger the abort after a short delay
          setTimeout(() => {
            if (options?.signal?.aborted) {
              reject(abortError);
            }
          }, 10);
        });
      });

      const client = new FacilitatorClient({
        baseUrl: 'https://facilitator.example.com',
        timeout: 1, // Very short timeout
        fetch: mockFetch,
      });

      await expect(client.supported()).rejects.toThrow('Timed out after 1 ms');
    });
  });

  describe('request body', () => {
    it('should send correct payload for verify', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ isValid: true }),
      });

      const client = new FacilitatorClient({
        baseUrl: 'https://facilitator.example.com',
        fetch: mockFetch,
      });

      await client.verify(mockPayload, mockRequirements);

      const calledWith = mockFetch.mock.calls[0];
      const body = JSON.parse(calledWith[1].body as string) as {
        paymentPayload: PaymentPayload;
        paymentRequirements: PaymentRequirements;
      };

      expect(body.paymentPayload).toEqual(mockPayload);
      expect(body.paymentRequirements).toEqual(mockRequirements);
    });

    it('should send correct payload for settle', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            transaction: '0x123',
            network: 'starknet:sepolia',
          }),
      });

      const client = new FacilitatorClient({
        baseUrl: 'https://facilitator.example.com',
        fetch: mockFetch,
      });

      await client.settle(mockPayload, mockRequirements);

      const calledWith = mockFetch.mock.calls[0];
      const body = JSON.parse(calledWith[1].body as string) as {
        paymentPayload: PaymentPayload;
        paymentRequirements: PaymentRequirements;
      };

      expect(body.paymentPayload).toEqual(mockPayload);
      expect(body.paymentRequirements).toEqual(mockRequirements);
    });
  });
});
