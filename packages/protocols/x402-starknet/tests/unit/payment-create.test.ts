import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createPaymentPayload,
  selectPaymentRequirements,
  encodePaymentSignature,
  decodePaymentSignature,
  getDefaultPaymasterEndpoint,
} from '../../src/payment/create.js';
import type {
  PaymentRequirements,
  PaymentPayload,
  PaymasterConfig,
} from '../../src/types/index.js';
import { createMockFetch } from '../helpers/mock-fetch.js';

describe('Payment Creation', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('selectPaymentRequirements', () => {
    const mockRequirements: Array<PaymentRequirements> = [
      {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset: '0xeth',
        payTo: '0xrecipient',
        resource: '/api/data',
        maxTimeoutSeconds: 300,
      },
      {
        scheme: 'exact',
        network: 'starknet:mainnet',
        amount: '2000000',
        asset: '0xusdc',
        payTo: '0xrecipient2',
        resource: '/api/data',
        maxTimeoutSeconds: 600,
      },
    ];

    it('should select compatible requirement with sufficient balance', async () => {
      const mockAccount = {
        address: '0x1234',
      } as any;
      const mockProvider = {
        getChainId: vi.fn().mockResolvedValue('0x534e5f5345504f4c4941'), // SN_SEPOLIA
        callContract: vi.fn().mockResolvedValue(['2000000', '0']), // Sufficient balance
      } as any;

      const selected = await selectPaymentRequirements(
        mockRequirements,
        mockAccount,
        mockProvider
      );

      expect(selected.network).toBe('starknet:sepolia');
    });

    it('should throw if no compatible requirements', async () => {
      const mockAccount = {} as any;
      const mockProvider = {} as any;

      await expect(
        selectPaymentRequirements([], mockAccount, mockProvider)
      ).rejects.toThrow('No payment requirements provided');
    });
  });

  describe('createPaymentPayload', () => {
    it('should create a valid payment payload', async () => {
      const mockTypedData = {
        domain: { name: 'Test' },
        types: {},
        primaryType: 'Invoke',
        message: {},
      };

      // Mock paymaster buildTransaction response
      global.fetch = vi.fn().mockImplementation(
        createMockFetch({
          result: {
            type: 'invoke',
            typed_data: mockTypedData,
            calls: [],
          },
        })
      );

      const mockAccount = {
        address: '0x1234567890abcdef',
        signMessage: vi.fn().mockResolvedValue(['0x1234', '0x5678']),
      } as any;

      const paymentRequirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset:
          '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
        payTo: '0xrecipient',
        maxTimeoutSeconds: 3600,
      };

      const paymasterConfig: PaymasterConfig = {
        endpoint: 'https://sepolia.paymaster.avnu.fi',
        network: 'starknet:sepolia',
      };

      const payload = await createPaymentPayload(
        mockAccount,
        2,
        paymentRequirements,
        paymasterConfig
      );

      // Verify payload structure (v2 format)
      expect(payload.x402Version).toBe(2);
      expect(payload.accepted).toEqual(paymentRequirements);
      expect(payload.payload.signature).toEqual({
        r: '0x1234',
        s: '0x5678',
      });
      expect(payload.payload.authorization).toEqual({
        from: mockAccount.address,
        to: paymentRequirements.payTo,
        amount: paymentRequirements.amount,
        token: paymentRequirements.asset,
        nonce: '0x0',
        validUntil: '0',
      });

      // Verify account.signMessage was called with typed data
      expect(mockAccount.signMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryType: 'Invoke',
        })
      );
    });

    it('should include paymaster endpoint in payload', async () => {
      global.fetch = vi.fn().mockImplementation(
        createMockFetch({
          result: {
            type: 'invoke',
            typed_data: {
              domain: {},
              types: {},
              primaryType: 'Invoke',
              message: {},
            },
            calls: [],
          },
        })
      );

      const mockAccount = {
        address: '0x1234',
        signMessage: vi.fn().mockResolvedValue(['0x1234', '0x5678']),
      } as any;

      const paymentRequirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'starknet:sepolia',
        amount: '1000000',
        asset:
          '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
        payTo:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        resource: '/api/data',
      };

      const paymasterConfig: PaymasterConfig = {
        endpoint: 'https://sepolia.paymaster.avnu.fi',
        network: 'starknet:sepolia',
      };

      const payload = await createPaymentPayload(
        mockAccount,
        1,
        paymentRequirements,
        paymasterConfig
      );

      // Verify paymaster endpoint is stored for later use
      expect((payload as any).paymasterEndpoint).toBe(
        'https://sepolia.paymaster.avnu.fi'
      );
    });
  });

  describe('encodePaymentSignature', () => {
    it('should encode payment payload to base64', () => {
      const payload: PaymentPayload = {
        x402Version: 2,
        scheme: 'exact',
        network: 'starknet:sepolia',
        payload: {
          signature: {
            r: '0xsig_r',
            s: '0xsig_s',
          },
          authorization: {
            from: '0xfrom',
            to: '0xto',
            amount: '1000',
            token: '0xtoken',
            nonce: '0',
            validUntil: '0',
          },
        },
      };

      const encoded = encodePaymentSignature(payload);
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);

      // Verify it's valid base64
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      expect(() => JSON.parse(decoded)).not.toThrow();
    });
  });

  describe('decodePaymentSignature', () => {
    it('should decode base64 payment header', () => {
      const payload: PaymentPayload = {
        x402Version: 2,
        scheme: 'exact',
        network: 'starknet:sepolia',
        payload: {
          signature: {
            r: '0xsig_r',
            s: '0xsig_s',
          },
          authorization: {
            from: '0xfrom',
            to: '0xto',
            amount: '1000',
            token: '0xtoken',
            nonce: '0',
            validUntil: '0',
          },
        },
      };

      const encoded = encodePaymentSignature(payload);
      const decoded = decodePaymentSignature(encoded);

      expect(decoded).toEqual(payload);
    });

    it('should handle encode/decode round trip', () => {
      const original: PaymentPayload = {
        x402Version: 2,
        scheme: 'exact',
        network: 'starknet:mainnet',
        payload: {
          signature: {
            r: '0x123',
            s: '0x456',
          },
          authorization: {
            from: '0xuser',
            to: '0xmerchant',
            amount: '5000000',
            token: '0xusdc',
            nonce: '42',
            validUntil: '1234567890',
          },
        },
      };

      const roundTrip = decodePaymentSignature(
        encodePaymentSignature(original)
      );
      expect(roundTrip).toEqual(original);
    });
  });

  describe('getDefaultPaymasterEndpoint', () => {
    it('should return mainnet endpoint', () => {
      const endpoint = getDefaultPaymasterEndpoint('starknet:mainnet');
      expect(endpoint).toBe('https://starknet.paymaster.avnu.fi');
    });

    it('should return sepolia endpoint', () => {
      const endpoint = getDefaultPaymasterEndpoint('starknet:sepolia');
      expect(endpoint).toBe('http://localhost:12777');
    });

    it('should return devnet endpoint', () => {
      const endpoint = getDefaultPaymasterEndpoint('starknet:devnet');
      expect(endpoint).toBe('http://localhost:12777');
    });
  });
});
