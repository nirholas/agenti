import { describe, it, expect, vi } from 'vitest';
import { createProvider, retryRpcCall } from '../../src/utils/provider.js';

describe('Provider Utilities', () => {
  describe('createProvider', () => {
    it('should create provider for mainnet', () => {
      const provider = createProvider('starknet:mainnet');
      expect(provider).toBeDefined();
    });

    it('should create provider for sepolia', () => {
      const provider = createProvider('starknet:sepolia');
      expect(provider).toBeDefined();
    });

    it('should create provider for devnet', () => {
      const provider = createProvider('starknet:devnet');
      expect(provider).toBeDefined();
    });
  });

  describe('retryRpcCall', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retryRpcCall(fn, 3, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');

      const result = await retryRpcCall(fn, 3, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw wrapped error after max retries', async () => {
      const error = new Error('persistent failure');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(retryRpcCall(fn, 3, 10)).rejects.toThrow(
        'RPC call failed after all retries'
      );
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();
      const result = await retryRpcCall(fn, 3, 10);
      const elapsed = Date.now() - startTime;

      // With base delay of 10ms and exponential backoff:
      // First attempt: immediate
      // Second attempt: after 10ms (10 * 2^0)
      // Third attempt: after 20ms (10 * 2^1)
      // Total minimum delay: 30ms
      expect(elapsed).toBeGreaterThanOrEqual(25); // Allow some margin
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not delay after last retry', async () => {
      const error = new Error('fail');
      const fn = vi.fn().mockRejectedValue(error);

      const startTime = Date.now();
      await expect(retryRpcCall(fn, 2, 10)).rejects.toThrow('fail');
      const elapsed = Date.now() - startTime;

      // Should only wait once (10ms), not twice
      expect(elapsed).toBeLessThan(30); // Should be around 10ms, not 30ms
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should work with custom retry count', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockRejectedValueOnce(new Error('fail 3'))
        .mockRejectedValueOnce(new Error('fail 4'))
        .mockResolvedValueOnce('success');

      const result = await retryRpcCall(fn, 5, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should work with custom base delay', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();
      const result = await retryRpcCall(fn, 3, 20);
      const elapsed = Date.now() - startTime;

      // Should wait 20ms for first retry
      expect(elapsed).toBeGreaterThanOrEqual(15); // Allow some margin
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
