/**
 * Tests for DiscoveryClient
 */

import { describe, it, expect, vi } from 'vitest';
import {
  DiscoveryClient,
  createDiscoveryClient,
} from '../../src/discovery/client.js';
import type {
  DiscoveryResponse,
  RegisterResourceResponse,
  PaymentRequirements,
} from '../../src/types/index.js';

describe('DiscoveryClient', () => {
  const mockPaymentRequirements: PaymentRequirements = {
    scheme: 'exact',
    network: 'starknet:sepolia',
    amount: '1000000',
    asset: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    payTo: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    maxTimeoutSeconds: 300,
  };

  describe('constructor', () => {
    it('should create client with base URL', () => {
      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
      });
      expect(client).toBeInstanceOf(DiscoveryClient);
    });

    it('should normalize base URL by removing trailing slash', () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resources: [], pagination: {} }),
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com/',
        fetch: mockFetch,
      });

      void client.discover();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://bazaar.example.com/discovery/resources',
        expect.any(Object)
      );
    });
  });

  describe('discover', () => {
    it('should call discovery endpoint without params', async () => {
      const mockResponse: DiscoveryResponse = {
        resources: [],
        pagination: {
          total: 0,
          limit: 10,
          offset: 0,
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
        fetch: mockFetch,
      });

      const result = await client.discover();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://bazaar.example.com/discovery/resources',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should add query params for type filter', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resources: [], pagination: {} }),
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
        fetch: mockFetch,
      });

      await client.discover({ type: 'http' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://bazaar.example.com/discovery/resources?type=http',
        expect.any(Object)
      );
    });

    it('should add query params for network filter', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resources: [], pagination: {} }),
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
        fetch: mockFetch,
      });

      await client.discover({ network: 'starknet:sepolia' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://bazaar.example.com/discovery/resources?network=starknet%3Asepolia',
        expect.any(Object)
      );
    });

    it('should add pagination params', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resources: [], pagination: {} }),
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
        fetch: mockFetch,
      });

      await client.discover({ limit: 20, offset: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=10'),
        expect.any(Object)
      );
    });

    it('should add category and provider params', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resources: [], pagination: {} }),
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
        fetch: mockFetch,
      });

      await client.discover({ category: 'data', provider: 'MyService' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('category=data'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('provider=MyService'),
        expect.any(Object)
      );
    });

    it('should add query search param', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resources: [], pagination: {} }),
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
        fetch: mockFetch,
      });

      await client.discover({ query: 'weather api' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('query=weather+api'),
        expect.any(Object)
      );
    });
  });

  describe('register', () => {
    it('should call register endpoint with POST', async () => {
      const mockResponse: RegisterResourceResponse = {
        success: true,
        resourceId: 'res_123',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
        fetch: mockFetch,
      });

      const result = await client.register({
        resource: 'https://api.example.com/data',
        type: 'http',
        accepts: [mockPaymentRequirements],
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://bazaar.example.com/discovery/resources',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      );
    });
  });

  describe('unregister', () => {
    it('should call unregister endpoint with DELETE', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
        fetch: mockFetch,
      });

      const result = await client.unregister('res_123');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://bazaar.example.com/discovery/resources/res_123',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should encode resource ID in URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
        fetch: mockFetch,
      });

      await client.unregister('res/with/slashes');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://bazaar.example.com/discovery/resources/res%2Fwith%2Fslashes',
        expect.any(Object)
      );
    });
  });

  describe('update', () => {
    it('should call update endpoint with PATCH', async () => {
      const mockResponse: RegisterResourceResponse = {
        success: true,
        resourceId: 'res_123',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
        fetch: mockFetch,
      });

      const result = await client.update('res_123', {
        accepts: [mockPaymentRequirements],
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://bazaar.example.com/discovery/resources/res_123',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.any(String),
        })
      );
    });
  });

  describe('authentication', () => {
    it('should include Authorization header when apiKey is provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resources: [], pagination: {} }),
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
        apiKey: 'test-api-key',
        fetch: mockFetch,
      });

      await client.discover();

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
        json: () => Promise.resolve({ resources: [], pagination: {} }),
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
        fetch: mockFetch,
      });

      await client.discover();

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should throw error on non-ok response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Resource not found'),
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
        fetch: mockFetch,
      });

      await expect(client.discover()).rejects.toThrow(
        'Discovery request failed'
      );
    });

    it('should throw timeout error on abort', async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const client = new DiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
        timeout: 100,
        fetch: mockFetch,
      });

      await expect(client.discover()).rejects.toThrow();
    });
  });

  describe('createDiscoveryClient', () => {
    it('should create client instance', () => {
      const client = createDiscoveryClient({
        baseUrl: 'https://bazaar.example.com',
      });

      expect(client).toBeDefined();
      expect(typeof client.discover).toBe('function');
      expect(typeof client.register).toBe('function');
      expect(typeof client.unregister).toBe('function');
      expect(typeof client.update).toBe('function');
    });
  });
});
