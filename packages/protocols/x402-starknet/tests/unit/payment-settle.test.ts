import { describe, it, expect, vi, beforeEach } from 'vitest';
import { settlePayment } from '../../src/payment/settle.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';
import type { RpcProvider } from 'starknet';

// Mock the paymaster module - provide minimal mocks
vi.mock('../../src/paymaster/index.js', () => ({
  createPaymasterClient: vi.fn((config) => ({
    buildTransaction: vi.fn().mockResolvedValue({
      type: 'invoke',
      typed_data: { domain: {}, types: {}, primaryType: 'Invoke', message: {} },
      calls: [],
    }),
    executeTransaction: vi.fn(),
    getSupportedTokens: vi.fn(),
    isAvailable: vi.fn(),
    getEndpoint: vi.fn(() => config.endpoint),
    getNetwork: vi.fn(() => config.network),
  })),
  buildTransaction: vi.fn().mockResolvedValue({
    type: 'invoke',
    typed_data: { domain: {}, types: {}, primaryType: 'Invoke', message: {} },
    calls: [],
  }),
  executeTransaction: vi.fn(),
  createTransferCall: vi.fn(() => ({
    contractAddress: '0xtoken',
    entrypoint: 'transfer',
    calldata: [],
  })),
  extractTypedData: vi.fn((resp) => resp.typed_data),
  DEFAULT_PAYMASTER_ENDPOINTS: {
    'starknet:mainnet': 'https://starknet.paymaster.avnu.fi',
    'starknet:sepolia': 'http://localhost:12777',
    'starknet:devnet': 'http://localhost:12777',
  },
}));

describe('Payment Settlement', () => {
  const mockPaymentRequirements: PaymentRequirements = {
    scheme: 'exact',
    network: 'starknet:sepolia',
    amount: '1000000',
    asset: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    payTo: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
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

  // Add paymaster endpoint and typed data to payload (as stored during creation)
  const payloadWithPaymaster = {
    ...mockPayload,
    paymasterEndpoint: 'https://sepolia.paymaster.avnu.fi',
    typedData: {
      domain: { name: 'Test' },
      types: {},
      primaryType: 'Invoke',
      message: {},
    },
  } as PaymentPayload & { paymasterEndpoint: string; typedData: any };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('settlePayment', () => {
    it('should settle valid payment successfully', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['2000000', '0']), // Sufficient balance
        waitForTransaction: vi.fn().mockResolvedValue({
          status: 'ACCEPTED_ON_L2',
          block_number: 12345,
          block_hash: '0xblockhash',
        }),
      } as unknown as RpcProvider;

      // Mock executeTransaction to return success
      const { executeTransaction } =
        await import('../../src/paymaster/index.js');
      (executeTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        transaction_hash: '0xtxhash123',
      });

      const result = await settlePayment(
        mockProvider,
        payloadWithPaymaster,
        mockPaymentRequirements
      );

      expect(result.success).toBe(true);
      expect(result.transaction).toBe('0xtxhash123');
      expect(result.network).toBe('starknet:sepolia');
      expect(result.payer).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      );
    });

    it('should fail if verification fails (insufficient balance)', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['500000', '0']), // Insufficient balance
      } as unknown as RpcProvider;

      const result = await settlePayment(
        mockProvider,
        payloadWithPaymaster,
        mockPaymentRequirements
      );

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe('insufficient_funds');
      expect(result.transaction).toBe('');
      expect(result.payer).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      );
    });

    it('should fail if paymaster endpoint is missing', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['2000000', '0']),
      } as unknown as RpcProvider;

      // Payload without paymaster endpoint
      const result = await settlePayment(
        mockProvider,
        mockPayload,
        mockPaymentRequirements
      );

      expect(result.success).toBe(false);
      expect(result.errorReason).toContain('Paymaster endpoint not provided');
    });

    it('should use paymaster endpoint from options if provided', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['2000000', '0']),
        waitForTransaction: vi.fn().mockResolvedValue({
          status: 'ACCEPTED_ON_L2',
          block_number: 12345,
          block_hash: '0xblockhash',
        }),
      } as unknown as RpcProvider;

      const { executeTransaction } =
        await import('../../src/paymaster/index.js');
      (executeTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        transaction_hash: '0xtxhash456',
      });

      // Add typed data to payload
      const payloadWithTypedData = {
        ...mockPayload,
        typedData: {
          domain: { name: 'Test' },
          types: {},
          primaryType: 'Invoke',
          message: {},
        },
      } as PaymentPayload & { typedData: any };

      const result = await settlePayment(
        mockProvider,
        payloadWithTypedData,
        mockPaymentRequirements,
        {
          paymasterConfig: {
            endpoint: 'https://custom-paymaster.example.com',
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.transaction).toBe('0xtxhash456');
    });

    it('should fail if paymaster execution fails', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['2000000', '0']),
      } as unknown as RpcProvider;

      const { executeTransaction } =
        await import('../../src/paymaster/index.js');
      (executeTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Paymaster rejected transaction')
      );

      const result = await settlePayment(
        mockProvider,
        payloadWithPaymaster,
        mockPaymentRequirements
      );

      expect(result.success).toBe(false);
      expect(result.errorReason).toContain('Paymaster rejected transaction');
      expect(result.transaction).toBe('');
    });

    it('should include block info when available', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['2000000', '0']),
        waitForTransaction: vi.fn().mockResolvedValue({
          status: 'ACCEPTED_ON_L2',
          block_number: 54321,
          block_hash: '0xblockhash789',
        }),
      } as unknown as RpcProvider;

      const { executeTransaction } =
        await import('../../src/paymaster/index.js');
      (executeTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        transaction_hash: '0xtxhash789',
      });

      const result = await settlePayment(
        mockProvider,
        payloadWithPaymaster,
        mockPaymentRequirements
      );

      expect(result.success).toBe(true);
      expect(result.blockNumber).toBe(54321);
      expect(result.blockHash).toBe('0xblockhash789');
    });

    it('should handle transaction wait timeout', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['2000000', '0']),
        waitForTransaction: vi
          .fn()
          .mockRejectedValue(new Error('Transaction timeout')),
      } as unknown as RpcProvider;

      const { executeTransaction } =
        await import('../../src/paymaster/index.js');
      (executeTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        transaction_hash: '0xtxtimeout',
      });

      const result = await settlePayment(
        mockProvider,
        payloadWithPaymaster,
        mockPaymentRequirements
      );

      expect(result.success).toBe(false);
      expect(result.errorReason).toContain('Transaction timeout');
    });

    it('should pass API key to paymaster if provided', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['2000000', '0']),
        waitForTransaction: vi.fn().mockResolvedValue({
          status: 'ACCEPTED_ON_L2',
        }),
      } as unknown as RpcProvider;

      const { executeTransaction, createPaymasterClient } =
        await import('../../src/paymaster/index.js');
      (executeTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        transaction_hash: '0xtxwithkey',
      });

      const createClientSpy = createPaymasterClient as ReturnType<typeof vi.fn>;

      // Add typed data to payload
      const payloadWithTypedData = {
        ...mockPayload,
        typedData: {
          domain: { name: 'Test' },
          types: {},
          primaryType: 'Invoke',
          message: {},
        },
      } as PaymentPayload & { typedData: any };

      await settlePayment(
        mockProvider,
        payloadWithTypedData,
        mockPaymentRequirements,
        {
          paymasterConfig: {
            endpoint: 'https://paymaster.example.com',
            apiKey: 'test-api-key-123',
          },
        }
      );

      // Verify createPaymasterClient was called with API key
      expect(createClientSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key-123',
        })
      );
    });
  });
});
