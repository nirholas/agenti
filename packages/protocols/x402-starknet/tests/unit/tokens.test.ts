/**
 * Tests for token constants and utilities
 */

import { describe, it, expect } from 'vitest';
import {
  ETH_ADDRESSES,
  STRK_ADDRESSES,
  USDC_ADDRESSES,
  TOKEN_ADDRESSES,
  TOKEN_DECIMALS,
  getTokenAddress,
  getTokenDecimals,
  getTokenSymbol,
  toAtomicUnits,
  fromAtomicUnits,
  isTokenAvailable,
  getAvailableTokens,
} from '../../src/index.js';

describe('Token Constants', () => {
  describe('ETH_ADDRESSES', () => {
    it('should have address for mainnet', () => {
      expect(ETH_ADDRESSES['starknet:mainnet']).toBeDefined();
      expect(ETH_ADDRESSES['starknet:mainnet']).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it('should have address for sepolia', () => {
      expect(ETH_ADDRESSES['starknet:sepolia']).toBeDefined();
      expect(ETH_ADDRESSES['starknet:sepolia']).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it('should have same address on mainnet and sepolia', () => {
      expect(ETH_ADDRESSES['starknet:mainnet']).toBe(
        ETH_ADDRESSES['starknet:sepolia']
      );
    });
  });

  describe('STRK_ADDRESSES', () => {
    it('should have address for mainnet', () => {
      expect(STRK_ADDRESSES['starknet:mainnet']).toBeDefined();
    });

    it('should have address for sepolia', () => {
      expect(STRK_ADDRESSES['starknet:sepolia']).toBeDefined();
    });
  });

  describe('USDC_ADDRESSES', () => {
    it('should have address for mainnet only', () => {
      expect(USDC_ADDRESSES['starknet:mainnet']).toBeDefined();
      expect(USDC_ADDRESSES['starknet:sepolia']).toBeUndefined();
    });
  });

  describe('TOKEN_DECIMALS', () => {
    it('should have correct decimals for ETH', () => {
      expect(TOKEN_DECIMALS.ETH).toBe(18);
    });

    it('should have correct decimals for STRK', () => {
      expect(TOKEN_DECIMALS.STRK).toBe(18);
    });

    it('should have correct decimals for USDC', () => {
      expect(TOKEN_DECIMALS.USDC).toBe(6);
    });
  });

  describe('TOKEN_ADDRESSES', () => {
    it('should index all token addresses by symbol', () => {
      expect(TOKEN_ADDRESSES.ETH).toBe(ETH_ADDRESSES);
      expect(TOKEN_ADDRESSES.STRK).toBe(STRK_ADDRESSES);
      expect(TOKEN_ADDRESSES.USDC).toBe(USDC_ADDRESSES);
    });
  });
});

describe('Token Utilities', () => {
  describe('getTokenAddress', () => {
    it('should return ETH address for mainnet', () => {
      const address = getTokenAddress('ETH', 'starknet:mainnet');
      expect(address).toBe(ETH_ADDRESSES['starknet:mainnet']);
    });

    it('should return STRK address for sepolia', () => {
      const address = getTokenAddress('STRK', 'starknet:sepolia');
      expect(address).toBe(STRK_ADDRESSES['starknet:sepolia']);
    });

    it('should return undefined for USDC on sepolia', () => {
      const address = getTokenAddress('USDC', 'starknet:sepolia');
      expect(address).toBeUndefined();
    });

    it('should return USDC address for mainnet', () => {
      const address = getTokenAddress('USDC', 'starknet:mainnet');
      expect(address).toBe(USDC_ADDRESSES['starknet:mainnet']);
    });
  });

  describe('getTokenDecimals', () => {
    it('should return 18 for ETH', () => {
      expect(getTokenDecimals('ETH')).toBe(18);
    });

    it('should return 18 for STRK', () => {
      expect(getTokenDecimals('STRK')).toBe(18);
    });

    it('should return 6 for USDC', () => {
      expect(getTokenDecimals('USDC')).toBe(6);
    });
  });

  describe('toAtomicUnits', () => {
    it('should convert ETH to wei', () => {
      expect(toAtomicUnits(1, 'ETH')).toBe('1000000000000000000');
      expect(toAtomicUnits(0.001, 'ETH')).toBe('1000000000000000');
      expect(toAtomicUnits(0.5, 'ETH')).toBe('500000000000000000');
    });

    it('should convert STRK to atomic units', () => {
      expect(toAtomicUnits(10, 'STRK')).toBe('10000000000000000000');
      expect(toAtomicUnits(0.1, 'STRK')).toBe('100000000000000000');
    });

    it('should convert USDC to atomic units (6 decimals)', () => {
      expect(toAtomicUnits(1, 'USDC')).toBe('1000000');
      expect(toAtomicUnits(1.5, 'USDC')).toBe('1500000');
      expect(toAtomicUnits(0.01, 'USDC')).toBe('10000');
      expect(toAtomicUnits(0.000001, 'USDC')).toBe('1');
    });

    it('should handle zero', () => {
      expect(toAtomicUnits(0, 'ETH')).toBe('0');
      expect(toAtomicUnits(0, 'USDC')).toBe('0');
    });

    it('should handle large numbers', () => {
      expect(toAtomicUnits(1000000, 'USDC')).toBe('1000000000000');
    });
  });

  describe('fromAtomicUnits', () => {
    it('should convert wei to ETH', () => {
      expect(fromAtomicUnits('1000000000000000000', 'ETH')).toBe(1);
      expect(fromAtomicUnits('1000000000000000', 'ETH')).toBe(0.001);
      expect(fromAtomicUnits('500000000000000000', 'ETH')).toBe(0.5);
    });

    it('should convert atomic STRK to STRK', () => {
      expect(fromAtomicUnits('10000000000000000000', 'STRK')).toBe(10);
      expect(fromAtomicUnits('100000000000000000', 'STRK')).toBe(0.1);
    });

    it('should convert atomic USDC to USDC', () => {
      expect(fromAtomicUnits('1000000', 'USDC')).toBe(1);
      expect(fromAtomicUnits('1500000', 'USDC')).toBe(1.5);
      expect(fromAtomicUnits('10000', 'USDC')).toBe(0.01);
      expect(fromAtomicUnits('1', 'USDC')).toBe(0.000001);
    });

    it('should handle zero', () => {
      expect(fromAtomicUnits('0', 'ETH')).toBe(0);
      expect(fromAtomicUnits('0', 'USDC')).toBe(0);
    });
  });

  describe('getTokenSymbol', () => {
    it('should identify ETH from address', () => {
      const ethAddress = ETH_ADDRESSES['starknet:mainnet']!;
      expect(getTokenSymbol(ethAddress, 'starknet:mainnet')).toBe('ETH');
    });

    it('should identify STRK from address', () => {
      const strkAddress = STRK_ADDRESSES['starknet:sepolia']!;
      expect(getTokenSymbol(strkAddress, 'starknet:sepolia')).toBe('STRK');
    });

    it('should identify USDC from address', () => {
      const usdcAddress = USDC_ADDRESSES['starknet:mainnet']!;
      expect(getTokenSymbol(usdcAddress, 'starknet:mainnet')).toBe('USDC');
    });

    it('should return undefined for unknown address', () => {
      expect(getTokenSymbol('0x123456', 'starknet:mainnet')).toBeUndefined();
    });

    it('should be case-insensitive', () => {
      const ethAddress = ETH_ADDRESSES['starknet:mainnet']!;
      expect(getTokenSymbol(ethAddress.toLowerCase(), 'starknet:mainnet')).toBe(
        'ETH'
      );
      expect(getTokenSymbol(ethAddress.toUpperCase(), 'starknet:mainnet')).toBe(
        'ETH'
      );
    });
  });

  describe('isTokenAvailable', () => {
    it('should return true for ETH on mainnet', () => {
      expect(isTokenAvailable('ETH', 'starknet:mainnet')).toBe(true);
    });

    it('should return true for ETH on sepolia', () => {
      expect(isTokenAvailable('ETH', 'starknet:sepolia')).toBe(true);
    });

    it('should return true for STRK on mainnet', () => {
      expect(isTokenAvailable('STRK', 'starknet:mainnet')).toBe(true);
    });

    it('should return true for STRK on sepolia', () => {
      expect(isTokenAvailable('STRK', 'starknet:sepolia')).toBe(true);
    });

    it('should return true for USDC on mainnet', () => {
      expect(isTokenAvailable('USDC', 'starknet:mainnet')).toBe(true);
    });

    it('should return false for USDC on sepolia', () => {
      expect(isTokenAvailable('USDC', 'starknet:sepolia')).toBe(false);
    });
  });

  describe('getAvailableTokens', () => {
    it('should return all tokens for mainnet', () => {
      const tokens = getAvailableTokens('starknet:mainnet');
      expect(tokens).toContain('ETH');
      expect(tokens).toContain('STRK');
      expect(tokens).toContain('USDC');
      expect(tokens).toHaveLength(3);
    });

    it('should return only ETH and STRK for sepolia', () => {
      const tokens = getAvailableTokens('starknet:sepolia');
      expect(tokens).toContain('ETH');
      expect(tokens).toContain('STRK');
      expect(tokens).not.toContain('USDC');
      expect(tokens).toHaveLength(2);
    });

    it('should return tokens in order', () => {
      const tokens = getAvailableTokens('starknet:mainnet');
      expect(tokens[0]).toBe('ETH');
      expect(tokens[1]).toBe('STRK');
      expect(tokens[2]).toBe('USDC');
    });
  });
});
