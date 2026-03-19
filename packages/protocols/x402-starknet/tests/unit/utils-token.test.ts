import { describe, it, expect, vi } from 'vitest';
import { getTokenBalance, getTokenMetadata } from '../../src/utils/token.js';
import type { RpcProvider } from 'starknet';

describe('Token Utilities', () => {
  describe('getTokenBalance', () => {
    it('should handle Uint256 balance response (low, high)', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['1000000', '0']),
      } as unknown as RpcProvider;

      const balance = await getTokenBalance(
        mockProvider,
        '0xtoken',
        '0xaccount'
      );

      expect(balance).toBe('1000000');
      expect(mockProvider.callContract).toHaveBeenCalledWith({
        contractAddress: '0xtoken',
        entrypoint: 'balanceOf',
        calldata: ['0xaccount'],
      });
    });

    it('should handle large Uint256 balance with high part', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue([
          '0xffffffffffffffffffffffffffffffff', // low
          '0x1', // high
        ]),
      } as unknown as RpcProvider;

      const balance = await getTokenBalance(
        mockProvider,
        '0xtoken',
        '0xaccount'
      );

      const expected = (
        BigInt('0xffffffffffffffffffffffffffffffff') +
        (BigInt('0x1') << 128n)
      ).toString();

      expect(balance).toBe(expected);
    });

    it('should handle single value response', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['500']),
      } as unknown as RpcProvider;

      const balance = await getTokenBalance(
        mockProvider,
        '0xtoken',
        '0xaccount'
      );

      expect(balance).toBe('500');
    });

    it('should handle empty response', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue([]),
      } as unknown as RpcProvider;

      const balance = await getTokenBalance(
        mockProvider,
        '0xtoken',
        '0xaccount'
      );

      expect(balance).toBe('0');
    });

    it('should handle zero balance', async () => {
      const mockProvider = {
        callContract: vi.fn().mockResolvedValue(['0', '0']),
      } as unknown as RpcProvider;

      const balance = await getTokenBalance(
        mockProvider,
        '0xtoken',
        '0xaccount'
      );

      expect(balance).toBe('0');
    });
  });

  describe('getTokenMetadata', () => {
    it('should fetch token metadata', async () => {
      const mockProvider = {
        callContract: vi
          .fn()
          .mockResolvedValueOnce(['123']) // name (as felt252)
          .mockResolvedValueOnce(['456']) // symbol (as felt252)
          .mockResolvedValueOnce(['18']), // decimals
      } as unknown as RpcProvider;

      const metadata = await getTokenMetadata(mockProvider, '0xtoken');

      expect(metadata.name).toBe('123');
      expect(metadata.symbol).toBe('456');
      expect(metadata.decimals).toBe(18);

      expect(mockProvider.callContract).toHaveBeenCalledTimes(3);
    });

    it('should handle missing metadata values', async () => {
      const mockProvider = {
        callContract: vi
          .fn()
          .mockResolvedValueOnce([]) // empty name
          .mockResolvedValueOnce([]) // empty symbol
          .mockResolvedValueOnce([]), // empty decimals
      } as unknown as RpcProvider;

      const metadata = await getTokenMetadata(mockProvider, '0xtoken');

      expect(metadata.name).toBe('Unknown');
      expect(metadata.symbol).toBe('UNK');
      expect(metadata.decimals).toBe(18); // default
    });

    it('should convert decimals to number', async () => {
      const mockProvider = {
        callContract: vi
          .fn()
          .mockResolvedValueOnce(['1'])
          .mockResolvedValueOnce(['2'])
          .mockResolvedValueOnce(['6']), // 6 decimals (like USDC)
      } as unknown as RpcProvider;

      const metadata = await getTokenMetadata(mockProvider, '0xtoken');

      expect(metadata.decimals).toBe(6);
      expect(typeof metadata.decimals).toBe('number');
    });
  });
});
