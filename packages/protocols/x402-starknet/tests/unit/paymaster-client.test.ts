import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PaymasterClient,
  createPaymasterClient,
} from '../../src/paymaster/client.js';
import { X402Error } from '../../src/errors.js';
import type { PaymasterConfig } from '../../src/types/paymaster.js';
import { createMockFetch } from '../helpers/mock-fetch.js';

describe('PaymasterClient', () => {
  const config: PaymasterConfig = {
    endpoint: 'https://test.paymaster.example.com',
    network: 'starknet:sepolia',
    apiKey: 'test-api-key',
  };

  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('createPaymasterClient', () => {
    it('should create a client instance', () => {
      const client = createPaymasterClient(config);
      expect(client).toBeInstanceOf(PaymasterClient);
      expect(client.getEndpoint()).toBe(config.endpoint);
      expect(client.getNetwork()).toBe(config.network);
    });
  });

  describe('buildTransaction', () => {
    it('should build a transaction successfully', async () => {
      const mockResponse = {
        type: 'invoke' as const,
        typed_data: {
          domain: {},
          types: {},
          primaryType: 'Invoke',
          message: {},
        },
        calls: [],
      };

      global.fetch = vi
        .fn()
        .mockImplementation(createMockFetch({ result: mockResponse }));

      const client = createPaymasterClient(config);
      const result = await client.buildTransaction({
        transaction: {
          type: 'invoke',
          invoke: {
            user_address: '0x1234',
            calls: [],
          },
        },
        parameters: {
          version: '0x1',
          fee_mode: { mode: 'sponsored' },
        },
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        config.endpoint,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-paymaster-api-key': 'test-api-key',
          }),
        })
      );
    });

    it('should throw X402Error on RPC error', async () => {
      const mockError = {
        code: -32000,
        message: 'Test error',
        data: { details: 'error details' },
      };

      global.fetch = vi
        .fn()
        .mockImplementation(createMockFetch({ error: mockError }));

      const client = createPaymasterClient(config);

      await expect(
        client.buildTransaction({
          transaction: {
            type: 'invoke',
            invoke: {
              user_address: '0x1234',
              calls: [],
            },
          },
          parameters: {
            version: '0x1',
            fee_mode: { mode: 'sponsored' },
          },
        })
      ).rejects.toThrow(X402Error);
    });

    it('should throw X402Error on HTTP error', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        })
      );

      const client = createPaymasterClient(config);

      await expect(
        client.buildTransaction({
          transaction: {
            type: 'invoke',
            invoke: {
              user_address: '0x1234',
              calls: [],
            },
          },
          parameters: {
            version: '0x1',
            fee_mode: { mode: 'sponsored' },
          },
        })
      ).rejects.toThrow(X402Error);
    });
  });

  describe('executeTransaction', () => {
    it('should execute a transaction successfully', async () => {
      const mockResponse = {
        transaction_hash: '0xabcdef',
      };

      global.fetch = vi
        .fn()
        .mockImplementation(createMockFetch({ result: mockResponse }));

      const client = createPaymasterClient(config);
      const result = await client.executeTransaction({
        transaction: {
          type: 'invoke',
          invoke: {
            user_address: '0x1234',
            calls: [],
          },
        },
        parameters: {
          version: '0x1',
          fee_mode: { mode: 'sponsored' },
        },
        signature: ['0xsig1', '0xsig2'],
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getSupportedTokens', () => {
    it('should get supported tokens', async () => {
      const mockResponse = {
        tokens: ['0xtoken1', '0xtoken2'],
      };

      global.fetch = vi
        .fn()
        .mockImplementation(createMockFetch({ result: mockResponse }));

      const client = createPaymasterClient(config);
      const result = await client.getSupportedTokens();

      expect(result).toEqual(mockResponse);
      expect(result.tokens).toHaveLength(2);
    });
  });

  describe('isAvailable', () => {
    it('should check availability', async () => {
      const mockResponse = {
        available: true,
      };

      global.fetch = vi
        .fn()
        .mockImplementation(createMockFetch({ result: mockResponse }));

      const client = createPaymasterClient(config);
      const result = await client.isAvailable();

      expect(result.available).toBe(true);
    });
  });

  describe('API key handling', () => {
    it('should work without API key', async () => {
      const configWithoutKey: PaymasterConfig = {
        endpoint: 'https://test.paymaster.example.com',
        network: 'starknet:sepolia',
      };

      const mockResponse = { available: true };

      global.fetch = vi
        .fn()
        .mockImplementation(createMockFetch({ result: mockResponse }));

      const client = createPaymasterClient(configWithoutKey);
      await client.isAvailable();

      expect(global.fetch).toHaveBeenCalledWith(
        configWithoutKey.endpoint,
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'x-paymaster-api-key': expect.anything(),
          }),
        })
      );
    });
  });
});
