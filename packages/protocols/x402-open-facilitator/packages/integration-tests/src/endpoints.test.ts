import { describe, it, expect, beforeAll } from 'vitest';
import { OpenFacilitator } from '@openfacilitator/sdk';
import { TEST_CONFIG, validateEndpoint } from './setup';

// Test the free endpoint (pay.openfacilitator.io)
describe('free endpoint', () => {
  let facilitator: OpenFacilitator;

  beforeAll(async () => {
    facilitator = new OpenFacilitator({
      url: TEST_CONFIG.FREE_ENDPOINT,
    });
  });

  describe('health', () => {
    it('should be reachable', async () => {
      const isHealthy = await facilitator.health();
      expect(isHealthy).toBe(true);
    });
  });

  describe('supported', () => {
    it('should return supported networks and schemes', async () => {
      const supported = await facilitator.supported();
      
      expect(supported).toBeDefined();
      expect(supported.kinds).toBeDefined();
      expect(Array.isArray(supported.kinds)).toBe(true);
      expect(supported.kinds.length).toBeGreaterThan(0);
      
      // Check that we have at least one payment kind
      const firstKind = supported.kinds[0];
      expect(firstKind.x402Version).toBeDefined();
      expect(firstKind.scheme).toBeDefined();
      expect(firstKind.network).toBeDefined();
    });

    it('should include Solana support', async () => {
      const supported = await facilitator.supported();
      
      const solanaKind = supported.kinds.find(
        (k) => k.network === 'solana' || k.network === 'solana:mainnet'
      );
      expect(solanaKind).toBeDefined();
    });

    it('should include EVM support', async () => {
      const supported = await facilitator.supported();
      
      const evmKind = supported.kinds.find(
        (k) => k.network.includes('eip155') || k.network === 'base'
      );
      expect(evmKind).toBeDefined();
    });
  });

  describe('verify', () => {
    it('should reject invalid payment payload', async () => {
      const invalidPayment = {
        x402Version: 1 as const,
        scheme: 'exact',
        network: 'solana',
        payload: {
          signature: 'invalid_signature',
          authorization: {
            from: 'invalid_address',
            to: 'invalid_address',
            amount: '1000000',
            asset: 'USDC',
          },
        },
      };

      const requirements = {
        scheme: 'exact',
        network: 'solana',
        maxAmountRequired: '1000000',
        asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
      };

      const result = await facilitator.verify(invalidPayment, requirements);
      
      expect(result.isValid).toBe(false);
      // Error message is optional - may or may not be present
    });

    it('should reject mismatched network', async () => {
      const payment = {
        x402Version: 1 as const,
        scheme: 'exact',
        network: 'solana',
        payload: {
          signature: 'test_signature',
          authorization: {
            from: 'test_from',
            to: 'test_to',
            amount: '1000000',
            asset: 'USDC',
          },
        },
      };

      const requirements = {
        scheme: 'exact',
        network: 'base', // Different network
        maxAmountRequired: '1000000',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
      };

      const result = await facilitator.verify(payment, requirements);
      
      expect(result.isValid).toBe(false);
    });
  });

  describe('settle', () => {
    it('should reject invalid payment for settlement', async () => {
      const invalidPayment = {
        x402Version: 1 as const,
        scheme: 'exact',
        network: 'solana',
        payload: {
          signature: 'invalid_signature',
          authorization: {
            from: 'invalid_address',
            to: 'invalid_address',
            amount: '1000000',
            asset: 'USDC',
          },
        },
      };

      const requirements = {
        scheme: 'exact',
        network: 'solana',
        maxAmountRequired: '1000000',
        asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      };

      const result = await facilitator.settle(invalidPayment, requirements);
      
      expect(result.success).toBe(false);
      // Error message is optional - may or may not be present
    });
  });
});

// Test the custom domain endpoint (pay.x402.jobs)
describe('custom domain', () => {
  let facilitator: OpenFacilitator;
  let isAvailable = false;

  beforeAll(async () => {
    // Check if custom domain is available
    isAvailable = await validateEndpoint(TEST_CONFIG.CUSTOM_DOMAIN);
    
    if (isAvailable) {
      facilitator = new OpenFacilitator({
        url: TEST_CONFIG.CUSTOM_DOMAIN,
      });
    }
  });

  describe('health', () => {
    it('should be reachable', async () => {
      if (!isAvailable) {
        console.log(`Skipping: ${TEST_CONFIG.CUSTOM_DOMAIN} not available`);
        return;
      }
      
      const isHealthy = await facilitator.health();
      expect(isHealthy).toBe(true);
    });
  });

  describe('supported', () => {
    it('should return supported networks', async () => {
      if (!isAvailable) {
        console.log(`Skipping: ${TEST_CONFIG.CUSTOM_DOMAIN} not available`);
        return;
      }
      
      const supported = await facilitator.supported();
      
      expect(supported).toBeDefined();
      expect(supported.kinds).toBeDefined();
      expect(Array.isArray(supported.kinds)).toBe(true);
    });
  });

  describe('verify', () => {
    it('should handle verify requests', async () => {
      if (!isAvailable) {
        console.log(`Skipping: ${TEST_CONFIG.CUSTOM_DOMAIN} not available`);
        return;
      }

      const invalidPayment = {
        x402Version: 1 as const,
        scheme: 'exact',
        network: 'solana',
        payload: {
          signature: 'test',
          authorization: {
            from: 'test',
            to: 'test',
            amount: '1000000',
            asset: 'USDC',
          },
        },
      };

      const requirements = {
        scheme: 'exact',
        network: 'solana',
        maxAmountRequired: '1000000',
        asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      };

      const result = await facilitator.verify(invalidPayment, requirements);
      
      // Should return a response (valid or invalid) without throwing
      expect(result).toBeDefined();
      expect(typeof result.isValid).toBe('boolean');
    });
  });
});

// Test default facilitator (no URL provided)
describe('default facilitator', () => {
  it('should use pay.openfacilitator.io by default', async () => {
    const facilitator = new OpenFacilitator();
    expect(facilitator.url).toBe('https://pay.openfacilitator.io');
  });

  it('should be reachable with default URL', async () => {
    const facilitator = new OpenFacilitator();
    const isHealthy = await facilitator.health();
    expect(isHealthy).toBe(true);
  });
});

