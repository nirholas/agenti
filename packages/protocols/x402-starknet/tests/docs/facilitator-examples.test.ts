/**
 * Documentation Tests - Facilitator Examples
 *
 * These tests verify that the facilitator examples in the documentation
 * compile and work correctly with the library's exports.
 */

import { describe, it, expect } from 'vitest';
import {
  // Facilitator functions
  verifyPayment,
  settlePayment,
  createProvider,
  createPaymasterConfig,
  createFacilitatorClient,
  // Schemas
  PAYMENT_PAYLOAD_SCHEMA,
  PAYMENT_REQUIREMENTS_SCHEMA,
  // Network utilities
  getSupportedNetworks,
  getAvailableTokens,
  getTokenAddress,
  // Types
  type VerifyResponse,
  type SettleResponse,
  type SupportedResponse,
  type SupportedKind,
  type StarknetNetworkId,
  type FacilitatorClientConfig,
} from '../../src/index.js';

describe('Facilitator Examples - Exports', () => {
  it('should export all required facilitator functions', () => {
    expect(typeof verifyPayment).toBe('function');
    expect(typeof settlePayment).toBe('function');
    expect(typeof createProvider).toBe('function');
    expect(typeof createPaymasterConfig).toBe('function');
    expect(typeof createFacilitatorClient).toBe('function');
  });

  it('should export network utilities', () => {
    expect(typeof getSupportedNetworks).toBe('function');
    expect(typeof getAvailableTokens).toBe('function');
    expect(typeof getTokenAddress).toBe('function');
  });

  it('should export validation schemas', () => {
    expect(PAYMENT_PAYLOAD_SCHEMA).toBeDefined();
    expect(PAYMENT_REQUIREMENTS_SCHEMA).toBeDefined();
  });
});

describe('Facilitator Examples - Supported Kinds', () => {
  it('should build supported kinds list', () => {
    const networks = getSupportedNetworks();
    expect(networks).toContain('starknet:mainnet');
    expect(networks).toContain('starknet:sepolia');
  });

  it('should get available tokens for network', () => {
    const mainnetTokens = getAvailableTokens('starknet:mainnet');
    expect(mainnetTokens).toContain('ETH');
    expect(mainnetTokens).toContain('STRK');

    const sepoliaTokens = getAvailableTokens('starknet:sepolia');
    expect(sepoliaTokens).toContain('ETH');
    expect(sepoliaTokens).toContain('STRK');
  });

  it('should get token addresses', () => {
    const ethAddress = getTokenAddress('ETH', 'starknet:mainnet');
    expect(ethAddress).toBeDefined();
    expect(ethAddress).toMatch(/^0x/);

    const strkAddress = getTokenAddress('STRK', 'starknet:mainnet');
    expect(strkAddress).toBeDefined();
    expect(strkAddress).toMatch(/^0x/);
  });

  it('should build SupportedResponse structure', () => {
    const networks = getSupportedNetworks();
    const kinds: SupportedKind[] = [];

    for (const network of networks) {
      const tokens = getAvailableTokens(network as StarknetNetworkId);
      for (const token of tokens) {
        const asset = getTokenAddress(token, network as StarknetNetworkId);
        if (asset) {
          kinds.push({
            x402Version: 2,
            scheme: 'exact',
            network: network as StarknetNetworkId,
            extra: { asset },
          });
        }
      }
    }

    const response: SupportedResponse = {
      kinds,
      extensions: [],
      signers: {
        starknet: ['SNIP-6'],
      },
    };

    expect(response.kinds.length).toBeGreaterThan(0);
    expect(response.kinds[0]?.x402Version).toBe(2);
    expect(response.kinds[0]?.scheme).toBe('exact');
    expect(response.signers.starknet).toContain('SNIP-6');
  });
});

describe('Facilitator Examples - Client', () => {
  it('should create facilitator client', () => {
    const config: FacilitatorClientConfig = {
      baseUrl: 'https://facilitator.example.com',
      apiKey: 'test-api-key',
      timeout: 30000,
    };

    const client = createFacilitatorClient(config);
    expect(client).toBeDefined();
    expect(typeof client.verify).toBe('function');
    expect(typeof client.settle).toBe('function');
    expect(typeof client.supported).toBe('function');
  });

  it('should create facilitator client with minimal config', () => {
    const client = createFacilitatorClient({
      baseUrl: 'https://facilitator.example.com',
    });

    expect(client).toBeDefined();
  });
});

describe('Facilitator Examples - Response Types', () => {
  it('should match VerifyResponse structure', () => {
    const verifyResponse: VerifyResponse = {
      isValid: true,
      payer: '0x1234567890abcdef',
    };

    expect(verifyResponse.isValid).toBe(true);
    expect(verifyResponse.payer).toBeDefined();
  });

  it('should match invalid VerifyResponse structure', () => {
    const verifyResponse: VerifyResponse = {
      isValid: false,
      invalidReason: 'insufficient_funds',
      payer: '0x1234567890abcdef',
      details: {
        balance: '0',
        error: 'Insufficient balance',
      },
    };

    expect(verifyResponse.isValid).toBe(false);
    expect(verifyResponse.invalidReason).toBe('insufficient_funds');
  });

  it('should match SettleResponse structure', () => {
    const settleResponse: SettleResponse = {
      success: true,
      transaction: '0xabcdef123456',
      network: 'starknet:sepolia',
      payer: '0x1234567890abcdef',
    };

    expect(settleResponse.success).toBe(true);
    expect(settleResponse.transaction).toBeDefined();
    expect(settleResponse.network).toBe('starknet:sepolia');
  });

  it('should match failed SettleResponse structure', () => {
    const settleResponse: SettleResponse = {
      success: false,
      errorReason: 'insufficient_funds',
      transaction: '',
      network: 'starknet:sepolia',
    };

    expect(settleResponse.success).toBe(false);
    expect(settleResponse.errorReason).toBeDefined();
  });
});
