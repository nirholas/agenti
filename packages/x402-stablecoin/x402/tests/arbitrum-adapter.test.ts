/**
 * Arbitrum X402 Adapter Tests
 * 
 * Unit and integration tests for Arbitrum payment adapter
 * with Sperax USD and EIP-3009 support
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createArbitrumAdapter, ArbitrumX402Adapter, SPERAX_USD_ADDRESS } from '../arbitrum-adapter';
import { Address } from 'viem';

describe('ArbitrumX402Adapter', () => {
  let adapter: ArbitrumX402Adapter;
  const testPrivateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
  const testRecipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address;

  describe('Initialization', () => {
    it('should create adapter for mainnet', () => {
      adapter = createArbitrumAdapter({
        network: 'mainnet',
        privateKey: testPrivateKey,
      });

      const networkInfo = adapter.getNetworkInfo();
      expect(networkInfo.chain).toBe('arbitrum');
      expect(networkInfo.chainId).toBe(42161);
    });

    it('should create adapter for sepolia testnet', () => {
      adapter = createArbitrumAdapter({
        network: 'sepolia',
        privateKey: testPrivateKey,
      });

      const networkInfo = adapter.getNetworkInfo();
      expect(networkInfo.chain).toBe('arbitrum-sepolia');
      expect(networkInfo.chainId).toBe(421614);
    });

    it('should use default RPC URL if not provided', () => {
      adapter = createArbitrumAdapter({
        network: 'mainnet',
        privateKey: testPrivateKey,
      });

      const networkInfo = adapter.getNetworkInfo();
      expect(networkInfo.rpcUrl).toBeDefined();
      expect(networkInfo.rpcUrl).toContain('arbitrum');
    });

    it('should accept custom RPC URL', () => {
      const customRpcUrl = 'https://custom.arbitrum.rpc';
      adapter = createArbitrumAdapter({
        network: 'mainnet',
        rpcUrl: customRpcUrl,
        privateKey: testPrivateKey,
      });

      const networkInfo = adapter.getNetworkInfo();
      expect(networkInfo.rpcUrl).toBe(customRpcUrl);
    });
  });

  describe('Payment Request Creation', () => {
    beforeEach(() => {
      adapter = createArbitrumAdapter({
        network: 'sepolia',
        privateKey: testPrivateKey,
      });
    });

    it('should create payment request with default token (USDs)', () => {
      const request = adapter.createPaymentRequest({
        price: '0.0001',
        recipient: testRecipient,
      });

      expect(request.token).toBe('USDs');
      expect(request.chain).toBe('arbitrum-sepolia');
      expect(request.price).toBe('0.0001');
      expect(request.recipient).toBe(testRecipient);
      expect(request.deadline).toBeDefined();
    });

    it('should create payment request with custom token', () => {
      const request = adapter.createPaymentRequest({
        price: '0.0001',
        recipient: testRecipient,
        token: 'USDC',
      });

      expect(request.token).toBe('USDC');
    });

    it('should include deadline 5 minutes in future', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      
      const request = adapter.createPaymentRequest({
        price: '0.0001',
        recipient: testRecipient,
      });

      const afterTime = Math.floor(Date.now() / 1000);
      
      // Deadline should be ~5 minutes (300 seconds) from now
      expect(request.deadline).toBeGreaterThan(beforeTime + 290);
      expect(request.deadline).toBeLessThan(afterTime + 310);
    });
  });

  describe('EIP-3009 Authorization', () => {
    beforeEach(() => {
      adapter = createArbitrumAdapter({
        network: 'sepolia',
        privateKey: testPrivateKey,
      });
    });

    it('should create valid payment authorization', async () => {
      const paymentRequest = adapter.createPaymentRequest({
        price: '0.0001',
        recipient: testRecipient,
        token: 'USDs',
      });

      const userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
      
      const authorization = await adapter.createPaymentAuthorization(
        paymentRequest,
        userAddress,
        testPrivateKey,
      });

      expect(authorization.from).toBe(userAddress);
      expect(authorization.to).toBe(testRecipient);
      expect(authorization.value).toBeDefined();
      expect(authorization.nonce).toBeDefined();
      expect(authorization.v).toBeDefined();
      expect(authorization.r).toBeDefined();
      expect(authorization.s).toBeDefined();
    });

    it('should create different nonces for different authorizations', async () => {
      const paymentRequest = adapter.createPaymentRequest({
        price: '0.0001',
        recipient: testRecipient,
      });

      const userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
      
      const auth1 = await adapter.createPaymentAuthorization(
        paymentRequest,
        userAddress,
        testPrivateKey,
      );

      const auth2 = await adapter.createPaymentAuthorization(
        paymentRequest,
        userAddress,
        testPrivateKey,
      );

      expect(auth1.nonce).not.toBe(auth2.nonce);
    });

    it('should set validity window correctly', async () => {
      const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes
      
      const paymentRequest = adapter.createPaymentRequest({
        price: '0.0001',
        recipient: testRecipient,
        token: 'USDs',
      });
      paymentRequest.deadline = deadline;

      const userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
      
      const authorization = await adapter.createPaymentAuthorization(
        paymentRequest,
        userAddress,
        testPrivateKey,
      );

      expect(Number(authorization.validBefore)).toBe(deadline);
      expect(Number(authorization.validAfter)).toBeLessThan(Number(authorization.validBefore));
    });
  });

  describe('Token Configuration', () => {
    beforeEach(() => {
      adapter = createArbitrumAdapter({
        network: 'mainnet',
      });
    });

    it('should have correct USDs token address', () => {
      const request = adapter.createPaymentRequest({
        price: '0.0001',
        recipient: testRecipient,
        token: 'USDs',
      });

      expect(SPERAX_USD_ADDRESS).toBe('0xd74f5255d557944cf7dd0e45ff521520002d5748');
    });

    it('should support multiple tokens', () => {
      const tokens = ['USDs', 'USDC', 'USDT', 'DAI'];
      
      tokens.forEach(token => {
        const request = adapter.createPaymentRequest({
          price: '0.0001',
          recipient: testRecipient,
          token: token as any,
        });

        expect(request.token).toBe(token);
      });
    });
  });

  describe('Network Information', () => {
    it('should provide correct mainnet info', () => {
      adapter = createArbitrumAdapter({
        network: 'mainnet',
      });

      const info = adapter.getNetworkInfo();
      
      expect(info.chain).toBe('arbitrum');
      expect(info.chainId).toBe(42161);
      expect(info.explorerUrl).toBe('https://arbiscan.io');
    });

    it('should provide correct sepolia info', () => {
      adapter = createArbitrumAdapter({
        network: 'sepolia',
      });

      const info = adapter.getNetworkInfo();
      
      expect(info.chain).toBe('arbitrum-sepolia');
      expect(info.chainId).toBe(421614);
      expect(info.explorerUrl).toBe('https://sepolia.arbiscan.io');
    });
  });
});

describe('Helper Functions', () => {
  describe('supportsEIP3009', () => {
    it('should return true for USDC', () => {
      const { supportsEIP3009 } = require('../arbitrum-adapter');
      expect(supportsEIP3009('USDC')).toBe(true);
    });

    it('should return true for USDs', () => {
      const { supportsEIP3009 } = require('../arbitrum-adapter');
      expect(supportsEIP3009('USDs')).toBe(true);
    });

    it('should return false for USDT', () => {
      const { supportsEIP3009 } = require('../arbitrum-adapter');
      expect(supportsEIP3009('USDT')).toBe(false);
    });

    it('should return false for DAI', () => {
      const { supportsEIP3009 } = require('../arbitrum-adapter');
      expect(supportsEIP3009('DAI')).toBe(false);
    });
  });

  describe('getArbitrumTokenInfo', () => {
    it('should return token info for USDs', () => {
      const { getArbitrumTokenInfo } = require('../arbitrum-adapter');
      const info = getArbitrumTokenInfo('USDs');
      
      expect(info).toBeDefined();
      expect(info?.decimals).toBe(18);
      expect(info?.name).toBe('Sperax USD');
      expect(info?.address).toBe(SPERAX_USD_ADDRESS);
    });

    it('should return token info for USDC', () => {
      const { getArbitrumTokenInfo } = require('../arbitrum-adapter');
      const info = getArbitrumTokenInfo('USDC');
      
      expect(info).toBeDefined();
      expect(info?.decimals).toBe(6);
      expect(info?.name).toBe('USD Coin');
    });

    it('should return null for unsupported token', () => {
      const { getArbitrumTokenInfo } = require('../arbitrum-adapter');
      const info = getArbitrumTokenInfo('INVALID' as any);
      
      expect(info).toBeNull();
    });
  });
});

describe('Error Handling', () => {
  it('should throw error if wallet client not initialized for standard payment', async () => {
    const adapter = createArbitrumAdapter({
      network: 'sepolia',
      // No private key provided
    });

    const paymentRequest = adapter.createPaymentRequest({
      price: '0.0001',
      recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address,
    });

    await expect(
      adapter.executeStandardPayment(paymentRequest)
    ).rejects.toThrow('Wallet client not initialized');
  });
});
