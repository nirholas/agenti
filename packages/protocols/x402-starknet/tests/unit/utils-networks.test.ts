/**
 * Tests for network utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getNetworkConfig,
  getNetworkFromChainId,
  isTestnet,
  isMainnet,
  getSupportedNetworks,
  getTransactionUrl,
  getAddressUrl,
  validateNetworkConfig,
  CHAIN_IDS,
} from '../../src/networks/index.js';

describe('Network Utilities', () => {
  describe('getNetworkConfig', () => {
    it('should return config for starknet:mainnet', () => {
      const config = getNetworkConfig('starknet:mainnet');
      expect(config.network).toBe('starknet:mainnet');
      expect(config.chainId).toBe(CHAIN_IDS.MAINNET);
      expect(config.rpcUrl).toContain('mainnet');
    });

    it('should return config for starknet:sepolia', () => {
      const config = getNetworkConfig('starknet:sepolia');
      expect(config.network).toBe('starknet:sepolia');
      expect(config.chainId).toBe(CHAIN_IDS.SEPOLIA);
      expect(config.rpcUrl).toContain('sepolia');
    });

    it('should return config for starknet:devnet', () => {
      const config = getNetworkConfig('starknet:devnet');
      expect(config.network).toBe('starknet:devnet');
      expect(config.chainId).toBe(CHAIN_IDS.DEVNET);
      expect(config.rpcUrl).toContain('localhost');
    });
  });

  describe('getNetworkFromChainId', () => {
    it('should return starknet:mainnet for mainnet chain ID', () => {
      const network = getNetworkFromChainId(CHAIN_IDS.MAINNET);
      expect(network).toBe('starknet:mainnet');
    });

    it('should return starknet:sepolia for sepolia chain ID', () => {
      const network = getNetworkFromChainId(CHAIN_IDS.SEPOLIA);
      expect(network).toBe('starknet:sepolia');
    });

    it('should return starknet:devnet for devnet chain ID', () => {
      const network = getNetworkFromChainId(CHAIN_IDS.DEVNET);
      expect(network).toBe('starknet:devnet');
    });

    it('should handle lowercase chain IDs', () => {
      const network = getNetworkFromChainId(CHAIN_IDS.MAINNET.toLowerCase());
      expect(network).toBe('starknet:mainnet');
    });

    it('should handle uppercase chain IDs', () => {
      const network = getNetworkFromChainId(CHAIN_IDS.SEPOLIA.toUpperCase());
      expect(network).toBe('starknet:sepolia');
    });

    it('should throw error for unknown chain ID', () => {
      expect(() => getNetworkFromChainId('0xUNKNOWN')).toThrow(
        'Network with chain ID 0xUNKNOWN'
      );
    });
  });

  describe('isTestnet', () => {
    it('should return true for starknet:sepolia', () => {
      expect(isTestnet('starknet:sepolia')).toBe(true);
    });

    it('should return true for starknet:devnet', () => {
      expect(isTestnet('starknet:devnet')).toBe(true);
    });

    it('should return false for starknet:mainnet', () => {
      expect(isTestnet('starknet:mainnet')).toBe(false);
    });
  });

  describe('isMainnet', () => {
    it('should return true for starknet:mainnet', () => {
      expect(isMainnet('starknet:mainnet')).toBe(true);
    });

    it('should return false for starknet:sepolia', () => {
      expect(isMainnet('starknet:sepolia')).toBe(false);
    });

    it('should return false for starknet:devnet', () => {
      expect(isMainnet('starknet:devnet')).toBe(false);
    });
  });

  describe('getSupportedNetworks', () => {
    it('should return all supported networks', () => {
      const networks = getSupportedNetworks();
      expect(networks).toContain('starknet:mainnet');
      expect(networks).toContain('starknet:sepolia');
      expect(networks).toContain('starknet:devnet');
      expect(networks).toHaveLength(3);
    });
  });

  describe('getTransactionUrl', () => {
    const txHash =
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    it('should return mainnet transaction URL', () => {
      const url = getTransactionUrl('starknet:mainnet', txHash);
      expect(url).toBe(`https://starkscan.co/tx/${txHash}`);
    });

    it('should return sepolia transaction URL', () => {
      const url = getTransactionUrl('starknet:sepolia', txHash);
      expect(url).toBe(`https://sepolia.starkscan.co/tx/${txHash}`);
    });

    it('should return null for devnet (no explorer)', () => {
      const url = getTransactionUrl('starknet:devnet', txHash);
      expect(url).toBeNull();
    });
  });

  describe('getAddressUrl', () => {
    const address =
      '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';

    it('should return mainnet address URL', () => {
      const url = getAddressUrl('starknet:mainnet', address);
      expect(url).toBe(`https://starkscan.co/contract/${address}`);
    });

    it('should return sepolia address URL', () => {
      const url = getAddressUrl('starknet:sepolia', address);
      expect(url).toBe(`https://sepolia.starkscan.co/contract/${address}`);
    });

    it('should return null for devnet (no explorer)', () => {
      const url = getAddressUrl('starknet:devnet', address);
      expect(url).toBeNull();
    });
  });

  describe('validateNetworkConfig', () => {
    it('should validate mainnet config without throwing', () => {
      expect(() => validateNetworkConfig('starknet:mainnet')).not.toThrow();
    });

    it('should validate sepolia config without throwing', () => {
      expect(() => validateNetworkConfig('starknet:sepolia')).not.toThrow();
    });

    it('should validate devnet config without throwing', () => {
      expect(() => validateNetworkConfig('starknet:devnet')).not.toThrow();
    });
  });
});
