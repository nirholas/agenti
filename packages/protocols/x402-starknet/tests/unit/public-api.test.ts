/**
 * Test that verifies the public API surface
 * This ensures we only export what we intend to export
 */

import { describe, it, expect } from 'vitest';
import * as publicApi from '../../src/index.js';

describe('Public API Surface', () => {
  it('should export only intended symbols', () => {
    const allExports = Object.keys(publicApi).filter(
      (key) => key !== 'default'
    );

    const expectedExports = [
      // Payment operations
      'createPaymentPayload',
      'verifyPayment',
      'settlePayment',
      // Encoding (v2 header names)
      'encodePaymentSignature',
      'decodePaymentSignature',
      'encodePaymentRequired',
      'decodePaymentRequired',
      'encodePaymentResponse',
      'decodePaymentResponse',
      // HTTP header constants
      'HTTP_HEADERS',
      // Network utilities
      'getNetworkConfig',
      'getTransactionUrl',
      'getAddressUrl',
      'isTestnet',
      'isMainnet',
      'getSupportedNetworks',
      // Network utilities (IMPROVEMENT_SPEC section 2)
      'isStarknetNetwork',
      'parseStarknetNetwork',
      'buildStarknetCAIP2',
      'getNetworkReference',
      'validateNetwork',
      // Network constants
      'STARKNET_NETWORKS',
      'NETWORK_REFERENCES',
      'NETWORK_NAMES',
      'DEFAULT_RPC_URLS',
      // Token constants (IMPROVEMENT_SPEC section 3)
      'ETH_ADDRESSES',
      'STRK_ADDRESSES',
      'USDC_ADDRESSES',
      'TOKEN_ADDRESSES',
      'TOKEN_DECIMALS',
      // Token utilities
      'getTokenAddress',
      'getTokenDecimals',
      'getTokenSymbol',
      'toAtomicUnits',
      'fromAtomicUnits',
      'isTokenAvailable',
      'getAvailableTokens',
      // Provider factory (IMPROVEMENT_SPEC section 4)
      'createProvider',
      'getChainId',
      // Payment builder utilities (IMPROVEMENT_SPEC section 6)
      'buildPaymentRequirements',
      'buildETHPayment',
      'buildSTRKPayment',
      'buildUSDCPayment',
      // Facilitator client
      'FacilitatorClient',
      'createFacilitatorClient',
      // Discovery client (Bazaar API)
      'DiscoveryClient',
      'createDiscoveryClient',
      // Extensions system
      'ExtensionRegistry',
      'createExtensionRegistry',
      'globalRegistry',
      'createExtensionData',
      'getExtensionInfo',
      'hasExtension',
      'getExtensionNames',
      'mergeExtensions',
      'filterRegisteredExtensions',
      'validateExtensions',
      'defineExtension',
      // Zod validation schemas - Network
      'STARKNET_NETWORK_ID_SCHEMA',
      'STARKNET_NETWORK_SCHEMA',
      // Zod validation schemas - Common
      'PAYMENT_SCHEME_SCHEMA',
      'SIGNATURE_SCHEMA',
      'PAYMENT_AUTHORIZATION_SCHEMA',
      // Zod validation schemas - Payment
      'RESOURCE_INFO_SCHEMA',
      'EXTENSION_DATA_SCHEMA',
      'PAYMENT_REQUIREMENTS_SCHEMA',
      'PAYMENT_REQUIREMENTS_V2_SCHEMA',
      'EXACT_STARKNET_PAYLOAD_SCHEMA',
      'PAYMENT_PAYLOAD_SCHEMA',
      'PAYMENT_PAYLOAD_V2_SCHEMA',
      'PAYMENT_REQUIRED_SCHEMA',
      // Zod validation schemas - Settlement
      'INVALID_PAYMENT_REASON_SCHEMA',
      'VERIFY_RESPONSE_SCHEMA',
      'VERIFY_RESPONSE_V2_SCHEMA',
      'SETTLE_RESPONSE_SCHEMA',
      'SETTLE_RESPONSE_V2_SCHEMA',
      'SUPPORTED_KIND_SCHEMA',
      'SUPPORTED_RESPONSE_SCHEMA',
      // Zod validation schemas - Config
      'NETWORK_CONFIG_SCHEMA',
      'ACCOUNT_CONFIG_SCHEMA',
      'PROVIDER_OPTIONS_SCHEMA',
      // Zod validation schemas - Discovery
      'RESOURCE_TYPE_SCHEMA',
      'RESOURCE_METADATA_SCHEMA',
      'DISCOVERED_RESOURCE_SCHEMA',
      'DISCOVERY_PAGINATION_SCHEMA',
      'DISCOVERY_RESPONSE_SCHEMA',
      'DISCOVERY_PARAMS_SCHEMA',
      'REGISTER_RESOURCE_REQUEST_SCHEMA',
      'REGISTER_RESOURCE_RESPONSE_SCHEMA',
      // Constants
      'VERSION',
      'X402_VERSION',
      'DEFAULT_PAYMASTER_ENDPOINTS',
      'NETWORK_CONFIGS',
      // Paymaster configuration utilities (IMPROVEMENT_SPEC section 5)
      'createPaymasterConfig',
      'createSettlementOptions',
      'hasPublicPaymaster',
      // Error classes (classes are also functions in JS)
      'X402Error',
      'PaymentError',
      'NetworkError',
      'ERROR_CODES',
    ];

    expect(allExports.sort()).toEqual(expectedExports.sort());
  });

  it('should export correct number of symbols', () => {
    const allExports = Object.keys(publicApi).filter(
      (key) => key !== 'default'
    );
    // 3 payment ops + 6 encoding + 1 HTTP_HEADERS + 15 network utils/constants + 12 token utils/constants + 2 provider factory + 4 payment builders + 3 paymaster config + 2 facilitator + 2 discovery + 11 extensions + 31 schemas + 4 constants + 3 error classes + 1 ERROR_CODES = 100
    expect(allExports).toHaveLength(100);
  });

  it('should export VERSION constant', () => {
    expect(publicApi.VERSION).toBe('1.0.0');
  });

  it('should export X402_VERSION constant', () => {
    expect(publicApi.X402_VERSION).toBe(2);
  });

  it('should export DEFAULT_PAYMASTER_ENDPOINTS', () => {
    expect(publicApi.DEFAULT_PAYMASTER_ENDPOINTS).toEqual({
      'starknet:mainnet': 'https://starknet.paymaster.avnu.fi',
      'starknet:sepolia': 'http://localhost:12777',
      'starknet:devnet': 'http://localhost:12777',
    });
  });

  it('should export NETWORK_CONFIGS', () => {
    expect(publicApi.NETWORK_CONFIGS).toBeDefined();
    expect(publicApi.NETWORK_CONFIGS['starknet:sepolia']).toBeDefined();
    expect(publicApi.NETWORK_CONFIGS['starknet:mainnet']).toBeDefined();
  });

  it('should export error classes', () => {
    expect(publicApi.X402Error).toBeDefined();
    expect(publicApi.PaymentError).toBeDefined();
    expect(publicApi.NetworkError).toBeDefined();
  });

  it('should export ERROR_CODES', () => {
    expect(publicApi.ERROR_CODES).toEqual({
      EINVALID_INPUT: 'EINVALID_INPUT',
      ENOT_FOUND: 'ENOT_FOUND',
      ETIMEOUT: 'ETIMEOUT',
      ECONFLICT: 'ECONFLICT',
      ECANCELLED: 'ECANCELLED',
      EINTERNAL: 'EINTERNAL',
      ENETWORK: 'ENETWORK',
      EPAYMASTER: 'EPAYMASTER',
    });
  });

  it('error classes should work correctly', () => {
    const paymentError = new publicApi.PaymentError('test', 'EINVALID_INPUT');
    expect(paymentError).toBeInstanceOf(Error);
    expect(paymentError).toBeInstanceOf(publicApi.X402Error);
    expect(paymentError.code).toBe('EINVALID_INPUT');
    expect(paymentError.message).toBe('test');

    const networkError = new publicApi.NetworkError('network test', 'ENETWORK');
    expect(networkError).toBeInstanceOf(Error);
    expect(networkError).toBeInstanceOf(publicApi.X402Error);
    expect(networkError.code).toBe('ENETWORK');
  });

  it('should have stable error factories', () => {
    // Test spec-compliant method name (spec §9)
    const insufficientFunds = publicApi.PaymentError.insufficientFunds(
      '100',
      '50'
    );
    expect(insufficientFunds.code).toBe('ECONFLICT');
    expect(insufficientFunds.message).toContain('Insufficient funds');
    expect(insufficientFunds.message).toContain('required 100');
    expect(insufficientFunds.message).toContain('available 50');

    const invalidPayload =
      publicApi.PaymentError.invalidPayload('missing field');
    expect(invalidPayload.code).toBe('EINVALID_INPUT');
    expect(invalidPayload.message).toContain('missing field');

    const unsupportedNetwork =
      publicApi.NetworkError.unsupportedNetwork('starknet:foo');
    expect(unsupportedNetwork.code).toBe('EINVALID_INPUT');
    expect(unsupportedNetwork.message).toContain('starknet:foo');

    const networkMismatch = publicApi.NetworkError.networkMismatch(
      'sepolia',
      'mainnet'
    );
    expect(networkMismatch.code).toBe('ECONFLICT');
    expect(networkMismatch.message).toContain('sepolia');
    expect(networkMismatch.message).toContain('mainnet');
  });
});
