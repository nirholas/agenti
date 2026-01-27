/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Spreading good vibes through good code 🌻
 */

import { describe, it, expect } from 'vitest';
import { truncateAddress, formatBalance, formatNumber, cn } from '../src/utils/helpers';

describe('Helper Functions', () => {
  describe('truncateAddress', () => {
    it('should truncate a long address correctly', () => {
      const address = '0x1234567890123456789012345678901234567890';
      const result = truncateAddress(address);
      expect(result).toBe('0x1234...7890');
    });

    it('should return the original address if too short', () => {
      const address = '0x1234';
      const result = truncateAddress(address);
      expect(result).toBe('0x1234');
    });

    it('should handle empty string', () => {
      const result = truncateAddress('');
      expect(result).toBe('');
    });

    it('should use custom start and end chars', () => {
      const address = '0x1234567890123456789012345678901234567890';
      const result = truncateAddress(address, 4, 4);
      expect(result).toBe('0x12...7890');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('should handle decimals', () => {
      expect(formatNumber(1234.5678, 2)).toBe('1,234.57');
    });

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('should handle string input', () => {
      expect(formatNumber('1234.56', 2)).toBe('1,234.56');
    });

    it('should handle invalid input', () => {
      expect(formatNumber('invalid')).toBe('0');
    });
  });

  describe('formatBalance', () => {
    it('should format balance with correct decimals', () => {
      expect(formatBalance(1.234567)).toBe('1.2346');
    });

    it('should handle zero balance', () => {
      expect(formatBalance(0)).toBe('0');
    });

    it('should handle very small balances', () => {
      expect(formatBalance(0.00001)).toBe('< 0.0001');
    });

    it('should handle string input', () => {
      expect(formatBalance('1.5')).toBe('1.5000');
    });

    it('should use custom decimals', () => {
      expect(formatBalance(1.23456789, 6)).toBe('1.234568');
    });
  });

  describe('cn', () => {
    it('should merge class names', () => {
      const result = cn('class1', 'class2');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const result = cn('base', isActive && 'active');
      expect(result).toContain('base');
      expect(result).toContain('active');
    });

    it('should handle undefined and null', () => {
      const result = cn('class1', undefined, null, 'class2');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });
  });
});
