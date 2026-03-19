/**
 * Tests for selectPaymentRequirements function
 */

import { describe, it, expect, vi } from 'vitest';
import { selectPaymentRequirements } from '../../src/payment/create.js';
import type { PaymentRequirements } from '../../src/types/index.js';
import type { Account, RpcProvider } from 'starknet';

describe('selectPaymentRequirements', () => {
  const mockAccount = {
    address:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  } as Account;

  describe('Network Compatibility', () => {
    it('should select requirement matching account network', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'starknet:mainnet',
          amount: '1000000',
          asset:
            '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '500000',
          asset:
            '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockProvider = {
        getChainId: vi.fn().mockResolvedValue('0x534e5f5345504f4c4941'), // SN_SEPOLIA
        callContract: vi.fn().mockResolvedValue(['1000000', '0']), // Sufficient balance
      } as unknown as RpcProvider;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockProvider
      );

      expect(selected.network).toBe('starknet:sepolia');
      expect(selected.amount).toBe('500000');
    });

    it('should throw when no compatible network found', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'starknet:mainnet',
          amount: '1000000',
          asset:
            '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockProvider = {
        getChainId: vi.fn().mockResolvedValue('0x534e5f5345504f4c4941'), // SN_SEPOLIA
      } as unknown as RpcProvider;

      await expect(
        selectPaymentRequirements(requirements, mockAccount, mockProvider)
      ).rejects.toThrow('Network mismatch');
    });

    it('should recognize mainnet chain ID', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'starknet:mainnet',
          amount: '1000000',
          asset:
            '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockProvider = {
        getChainId: vi.fn().mockResolvedValue('0x534e5f4d41494e'), // SN_MAIN
        callContract: vi.fn().mockResolvedValue(['2000000', '0']),
      } as unknown as RpcProvider;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockProvider
      );

      expect(selected.network).toBe('starknet:mainnet');
    });

    it('should default to devnet for unknown chain IDs', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'starknet:devnet',
          amount: '1000000',
          asset:
            '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockProvider = {
        getChainId: vi.fn().mockResolvedValue('0xUNKNOWN'), // Unknown chain
        callContract: vi.fn().mockResolvedValue(['2000000', '0']),
      } as unknown as RpcProvider;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockProvider
      );

      expect(selected.network).toBe('starknet:devnet');
    });

    it('should default to sepolia when getChainId fails', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset:
            '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockProvider = {
        getChainId: vi.fn().mockRejectedValue(new Error('Network error')),
        callContract: vi.fn().mockResolvedValue(['2000000', '0']),
      } as unknown as RpcProvider;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockProvider
      );

      expect(selected.network).toBe('starknet:sepolia');
    });
  });

  describe('Balance Checking', () => {
    it('should select requirement with sufficient balance', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: '0xtoken1',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '500000',
          asset: '0xtoken2',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockProvider = {
        getChainId: vi.fn().mockResolvedValue('0x534e5f5345504f4c4941'),
        callContract: vi.fn().mockImplementation((params: any) => {
          // First token has insufficient balance, second has sufficient
          if (params.contractAddress === '0xtoken1') {
            return Promise.resolve(['100000', '0']); // Insufficient
          }
          return Promise.resolve(['600000', '0']); // Sufficient
        }),
      } as unknown as RpcProvider;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockProvider
      );

      // Should select token2 since token1 has insufficient balance
      expect(selected.asset).toBe('0xtoken2');
    });

    it('should throw when no requirement has sufficient balance', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: '0xtoken',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockProvider = {
        getChainId: vi.fn().mockResolvedValue('0x534e5f5345504f4c4941'),
        callContract: vi.fn().mockResolvedValue(['100000', '0']), // Insufficient balance
      } as unknown as RpcProvider;

      await expect(
        selectPaymentRequirements(requirements, mockAccount, mockProvider)
      ).rejects.toThrow('Insufficient funds');
    });

    it('should handle balance check errors gracefully', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: '0xtoken1',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '500000',
          asset: '0xtoken2',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockProvider = {
        getChainId: vi.fn().mockResolvedValue('0x534e5f5345504f4c4941'),
        callContract: vi.fn().mockImplementation((params: any) => {
          // First token throws error, second succeeds
          if (params.contractAddress === '0xtoken1') {
            return Promise.reject(new Error('Contract error'));
          }
          return Promise.resolve(['600000', '0']);
        }),
      } as unknown as RpcProvider;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockProvider
      );

      // Should select token2 since token1 failed balance check
      expect(selected.asset).toBe('0xtoken2');
    });
  });

  describe('Cost Optimization', () => {
    it('should prefer lower cost when multiple options available', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '2000000',
          asset: '0xtoken',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '500000', // Lower cost
          asset: '0xtoken',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: '0xtoken',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockProvider = {
        getChainId: vi.fn().mockResolvedValue('0x534e5f5345504f4c4941'),
        callContract: vi.fn().mockResolvedValue(['3000000', '0']), // Sufficient for all
      } as unknown as RpcProvider;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockProvider
      );

      expect(selected.amount).toBe('500000');
    });

    it('should prefer shorter timeout when costs are equal', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: '0xtoken',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 600, // Longer timeout
        },
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: '0xtoken',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300, // Shorter timeout
        },
      ];

      const mockProvider = {
        getChainId: vi.fn().mockResolvedValue('0x534e5f5345504f4c4941'),
        callContract: vi.fn().mockResolvedValue(['2000000', '0']),
      } as unknown as RpcProvider;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockProvider
      );

      expect(selected.maxTimeoutSeconds).toBe(300);
    });
  });

  describe('Edge Cases', () => {
    it('should throw when requirements array is empty', async () => {
      const mockProvider = {
        getChainId: vi.fn().mockResolvedValue('0x534e5f5345504f4c4941'),
      } as unknown as RpcProvider;

      await expect(
        selectPaymentRequirements([], mockAccount, mockProvider)
      ).rejects.toThrow('No payment requirements provided');
    });

    it('should handle single requirement', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000',
          asset: '0xtoken',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockProvider = {
        getChainId: vi.fn().mockResolvedValue('0x534e5f5345504f4c4941'),
        callContract: vi.fn().mockResolvedValue(['2000000', '0']),
      } as unknown as RpcProvider;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockProvider
      );

      expect(selected).toEqual(requirements[0]);
    });

    it('should handle very large amounts', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '999999999999999999999999999999', // Very large
          asset: '0xtoken',
          payTo:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockProvider = {
        getChainId: vi.fn().mockResolvedValue('0x534e5f5345504f4c4941'),
        callContract: vi
          .fn()
          .mockResolvedValue(['9999999999999999999999999999999', '0']), // Sufficient
      } as unknown as RpcProvider;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockProvider
      );

      expect(selected.amount).toBe('999999999999999999999999999999');
    });
  });

  describe('Complex Scenarios', () => {
    it('should select cheapest among multiple networks and tokens', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'starknet:mainnet',
          amount: '3000000',
          asset: '0xtoken1',
          payTo: '0xrecipient',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '1000000', // Cheapest on correct network
          asset: '0xtoken2',
          payTo: '0xrecipient',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
        {
          scheme: 'exact',
          network: 'starknet:sepolia',
          amount: '2000000',
          asset: '0xtoken3',
          payTo: '0xrecipient',
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockProvider = {
        getChainId: vi.fn().mockResolvedValue('0x534e5f5345504f4c4941'), // Sepolia
        callContract: vi.fn().mockResolvedValue(['5000000', '0']), // Sufficient for all
      } as unknown as RpcProvider;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockProvider
      );

      expect(selected.network).toBe('starknet:sepolia');
      expect(selected.amount).toBe('1000000');
      expect(selected.asset).toBe('0xtoken2');
    });
  });
});
