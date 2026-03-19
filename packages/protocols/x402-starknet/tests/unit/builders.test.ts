/**
 * Tests for payment builder utilities
 */

import { describe, it, expect } from 'vitest';
import {
  buildPaymentRequirements,
  buildETHPayment,
  buildSTRKPayment,
  buildUSDCPayment,
  ETH_ADDRESSES,
  STRK_ADDRESSES,
  USDC_ADDRESSES,
} from '../../src/index.js';

describe('buildPaymentRequirements', () => {
  const testPayTo = '0x1234567890abcdef1234567890abcdef12345678';

  describe('with known token symbols', () => {
    it('should build ETH payment requirements on mainnet', () => {
      const result = buildPaymentRequirements({
        network: 'starknet:mainnet',
        amount: 0.001,
        asset: 'ETH',
        payTo: testPayTo,
      });

      expect(result.scheme).toBe('exact');
      expect(result.network).toBe('starknet:mainnet');
      expect(result.asset).toBe(ETH_ADDRESSES['starknet:mainnet']);
      expect(result.amount).toBe('1000000000000000'); // 0.001 * 10^18
      expect(result.payTo).toBe(testPayTo);
      expect(result.maxTimeoutSeconds).toBe(300); // default
      expect(result.extra?.name).toBe('Ether');
      expect(result.extra?.symbol).toBe('ETH');
      expect(result.extra?.decimals).toBe(18);
    });

    it('should build STRK payment requirements on sepolia', () => {
      const result = buildPaymentRequirements({
        network: 'starknet:sepolia',
        amount: 10,
        asset: 'STRK',
        payTo: testPayTo,
      });

      expect(result.scheme).toBe('exact');
      expect(result.network).toBe('starknet:sepolia');
      expect(result.asset).toBe(STRK_ADDRESSES['starknet:sepolia']);
      expect(result.amount).toBe('10000000000000000000'); // 10 * 10^18
      expect(result.extra?.name).toBe('Starknet Token');
      expect(result.extra?.symbol).toBe('STRK');
      expect(result.extra?.decimals).toBe(18);
    });

    it('should build USDC payment requirements on mainnet', () => {
      const result = buildPaymentRequirements({
        network: 'starknet:mainnet',
        amount: 1.5,
        asset: 'USDC',
        payTo: testPayTo,
      });

      expect(result.scheme).toBe('exact');
      expect(result.network).toBe('starknet:mainnet');
      expect(result.asset).toBe(USDC_ADDRESSES['starknet:mainnet']);
      expect(result.amount).toBe('1500000'); // 1.5 * 10^6
      expect(result.extra?.name).toBe('USD Coin');
      expect(result.extra?.symbol).toBe('USDC');
      expect(result.extra?.decimals).toBe(6);
    });

    it('should throw error for USDC on sepolia', () => {
      expect(() =>
        buildPaymentRequirements({
          network: 'starknet:sepolia',
          amount: 1.0,
          asset: 'USDC',
          payTo: testPayTo,
        })
      ).toThrow('Token USDC is not available on starknet:sepolia');
    });
  });

  describe('with custom token address', () => {
    it('should use address directly for custom tokens', () => {
      const customTokenAddress = '0xCustomTokenAddress123';
      const result = buildPaymentRequirements({
        network: 'starknet:mainnet',
        amount: 1000000,
        asset: customTokenAddress,
        payTo: testPayTo,
      });

      expect(result.asset).toBe(customTokenAddress);
      expect(result.amount).toBe('1000000'); // Used as-is for custom tokens
      expect(result.extra).toBeUndefined();
    });

    it('should include extra metadata for custom tokens when provided', () => {
      const customTokenAddress = '0xCustomTokenAddress123';
      const result = buildPaymentRequirements({
        network: 'starknet:mainnet',
        amount: 1000000,
        asset: customTokenAddress,
        payTo: testPayTo,
        extra: {
          name: 'My Token',
          symbol: 'MTK',
          decimals: 8,
        },
      });

      expect(result.extra?.name).toBe('My Token');
      expect(result.extra?.symbol).toBe('MTK');
      expect(result.extra?.decimals).toBe(8);
    });
  });

  describe('optional parameters', () => {
    it('should use custom maxTimeoutSeconds', () => {
      const result = buildPaymentRequirements({
        network: 'starknet:mainnet',
        amount: 0.001,
        asset: 'ETH',
        payTo: testPayTo,
        maxTimeoutSeconds: 600,
      });

      expect(result.maxTimeoutSeconds).toBe(600);
    });

    it('should allow overriding token metadata', () => {
      const result = buildPaymentRequirements({
        network: 'starknet:mainnet',
        amount: 0.001,
        asset: 'ETH',
        payTo: testPayTo,
        extra: {
          name: 'Custom Name',
          decimals: 12,
        },
      });

      expect(result.extra?.name).toBe('Custom Name');
      expect(result.extra?.symbol).toBe('ETH'); // Uses default
      expect(result.extra?.decimals).toBe(12);
    });

    it('should include paymentContract in extra when provided', () => {
      const paymentContract = '0xPaymentContract123';
      const result = buildPaymentRequirements({
        network: 'starknet:mainnet',
        amount: 0.001,
        asset: 'ETH',
        payTo: testPayTo,
        extra: {
          paymentContract,
        },
      });

      expect(result.extra?.paymentContract).toBe(paymentContract);
    });
  });
});

describe('buildETHPayment', () => {
  const testPayTo = '0x1234567890abcdef1234567890abcdef12345678';

  it('should build ETH payment on mainnet', () => {
    const result = buildETHPayment({
      network: 'starknet:mainnet',
      amount: 0.1,
      payTo: testPayTo,
    });

    expect(result.asset).toBe(ETH_ADDRESSES['starknet:mainnet']);
    expect(result.amount).toBe('100000000000000000'); // 0.1 * 10^18
    expect(result.extra?.symbol).toBe('ETH');
  });

  it('should build ETH payment on sepolia', () => {
    const result = buildETHPayment({
      network: 'starknet:sepolia',
      amount: 0.5,
      payTo: testPayTo,
    });

    expect(result.network).toBe('starknet:sepolia');
    expect(result.asset).toBe(ETH_ADDRESSES['starknet:sepolia']);
  });

  it('should use custom maxTimeoutSeconds', () => {
    const result = buildETHPayment({
      network: 'starknet:mainnet',
      amount: 0.1,
      payTo: testPayTo,
      maxTimeoutSeconds: 120,
    });

    expect(result.maxTimeoutSeconds).toBe(120);
  });
});

describe('buildSTRKPayment', () => {
  const testPayTo = '0x1234567890abcdef1234567890abcdef12345678';

  it('should build STRK payment on mainnet', () => {
    const result = buildSTRKPayment({
      network: 'starknet:mainnet',
      amount: 100,
      payTo: testPayTo,
    });

    expect(result.asset).toBe(STRK_ADDRESSES['starknet:mainnet']);
    expect(result.amount).toBe('100000000000000000000'); // 100 * 10^18
    expect(result.extra?.symbol).toBe('STRK');
  });

  it('should build STRK payment on sepolia', () => {
    const result = buildSTRKPayment({
      network: 'starknet:sepolia',
      amount: 50,
      payTo: testPayTo,
    });

    expect(result.network).toBe('starknet:sepolia');
    expect(result.asset).toBe(STRK_ADDRESSES['starknet:sepolia']);
  });

  it('should use custom maxTimeoutSeconds', () => {
    const result = buildSTRKPayment({
      network: 'starknet:mainnet',
      amount: 10,
      payTo: testPayTo,
      maxTimeoutSeconds: 60,
    });

    expect(result.maxTimeoutSeconds).toBe(60);
  });
});

describe('buildUSDCPayment', () => {
  const testPayTo = '0x1234567890abcdef1234567890abcdef12345678';

  it('should build USDC payment on mainnet', () => {
    const result = buildUSDCPayment({
      network: 'starknet:mainnet',
      amount: 25.99,
      payTo: testPayTo,
    });

    expect(result.asset).toBe(USDC_ADDRESSES['starknet:mainnet']);
    expect(result.amount).toBe('25990000'); // 25.99 * 10^6
    expect(result.extra?.symbol).toBe('USDC');
    expect(result.extra?.decimals).toBe(6);
  });

  it('should throw error for USDC on sepolia', () => {
    expect(() =>
      buildUSDCPayment({
        network: 'starknet:sepolia',
        amount: 10,
        payTo: testPayTo,
      })
    ).toThrow('Token USDC is not available on starknet:sepolia');
  });

  it('should use custom maxTimeoutSeconds', () => {
    const result = buildUSDCPayment({
      network: 'starknet:mainnet',
      amount: 1.0,
      payTo: testPayTo,
      maxTimeoutSeconds: 180,
    });

    expect(result.maxTimeoutSeconds).toBe(180);
  });

  it('should handle fractional amounts correctly', () => {
    const result = buildUSDCPayment({
      network: 'starknet:mainnet',
      amount: 0.01,
      payTo: testPayTo,
    });

    expect(result.amount).toBe('10000'); // 0.01 * 10^6
  });
});
