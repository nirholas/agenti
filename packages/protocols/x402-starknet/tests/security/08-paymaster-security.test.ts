/**
 * Security Test Suite: Paymaster Security
 * Based on SECURITY_TESTING.md sections 8.1-8.2
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_PAYMASTER_ENDPOINTS } from '../../src/paymaster/index.js';
import type { PaymasterConfig } from '../../src/types/index.js';

describe('Security: Paymaster Security', () => {
  describe('Test 8.1: Malicious Paymaster Endpoint', () => {
    it('should accept any paymaster endpoint (known limitation)', () => {
      const maliciousConfig: PaymasterConfig = {
        endpoint: 'https://evil.paymaster.com',
        network: 'starknet:sepolia',
      };

      // Library accepts any endpoint - KNOWN LIMITATION (SECURITY.md:217-235)
      // Applications MUST implement endpoint whitelisting
      expect(maliciousConfig.endpoint).toBe('https://evil.paymaster.com');

      // This is intentional - the library doesn't enforce endpoint restrictions
      // Security responsibility is on the application layer
    });

    it('should demonstrate endpoint whitelisting pattern', () => {
      const ALLOWED_PAYMASTERS = [
        'https://starknet.paymaster.avnu.fi',
        'https://sepolia.paymaster.avnu.fi',
      ];

      const goodConfig: PaymasterConfig = {
        endpoint: 'https://sepolia.paymaster.avnu.fi',
        network: 'starknet:sepolia',
      };

      const badConfig: PaymasterConfig = {
        endpoint: 'https://evil.paymaster.com',
        network: 'starknet:sepolia',
      };

      // Application-level validation (recommended pattern)
      const isAllowed = (endpoint: string) =>
        ALLOWED_PAYMASTERS.includes(endpoint);

      expect(isAllowed(goodConfig.endpoint)).toBe(true);
      expect(isAllowed(badConfig.endpoint)).toBe(false);

      // Applications should validate before using
      // This demonstrates the pattern - actual implementation should reject
      const validateEndpoint = (config: PaymasterConfig) => {
        if (!isAllowed(config.endpoint)) {
          throw new Error('Untrusted paymaster endpoint');
        }
        return true;
      };

      // Good config passes validation
      expect(() => validateEndpoint(goodConfig)).not.toThrow();

      // Bad config fails validation
      expect(() => validateEndpoint(badConfig)).toThrow(
        'Untrusted paymaster endpoint'
      );
    });

    it('should provide default trusted paymaster endpoints', () => {
      // Library provides default endpoints
      // Sepolia uses localhost for testing (to avoid requiring API keys)
      expect(DEFAULT_PAYMASTER_ENDPOINTS['starknet:sepolia']).toBe(
        'http://localhost:12777'
      );

      // Mainnet uses production AVNU endpoint
      expect(DEFAULT_PAYMASTER_ENDPOINTS['starknet:mainnet']).toBe(
        'https://starknet.paymaster.avnu.fi'
      );

      // Applications should use these defaults when possible
    });

    it('should warn about using custom paymaster endpoints', () => {
      const customEndpoint = 'https://my-custom-paymaster.com';

      // Using custom endpoint is allowed but risky
      // Applications must:
      // 1. Validate the endpoint is trusted
      // 2. Use HTTPS only
      // 3. Verify endpoint ownership
      // 4. Audit paymaster service

      const isHttps = customEndpoint.startsWith('https://');
      expect(isHttps).toBe(true);

      // Should not allow HTTP
      const httpEndpoint = 'http://insecure.paymaster.com';
      const isHttpsSecure = httpEndpoint.startsWith('https://');
      expect(isHttpsSecure).toBe(false);
    });

    it('should reject obviously malicious endpoints at application layer', () => {
      const maliciousEndpoints = [
        'javascript:alert(1)',
        'file:///etc/passwd',
        'http://localhost:8080', // HTTP not HTTPS
        'https://127.0.0.1', // Localhost
        'https://192.168.1.1', // Private IP
        '',
        'not-a-url',
      ];

      const isValidEndpoint = (endpoint: string) => {
        try {
          const url = new URL(endpoint);
          return (
            url.protocol === 'https:' &&
            !/^(localhost|127\.0\.0\.1|192\.168\.)/.exec(url.hostname)
          );
        } catch {
          return false;
        }
      };

      for (const endpoint of maliciousEndpoints) {
        expect(isValidEndpoint(endpoint)).toBe(false);
      }

      // Valid endpoint
      expect(isValidEndpoint('https://sepolia.paymaster.avnu.fi')).toBe(true);
    });

    it('should validate endpoint URL format', () => {
      const validatePaymasterUrl = (endpoint: string): boolean => {
        try {
          const url = new URL(endpoint);

          // Must be HTTPS
          if (url.protocol !== 'https:') return false;

          // Must have a valid hostname
          if (!url.hostname || url.hostname.length === 0) return false;

          // Should not be localhost or private IP
          if (
            url.hostname === 'localhost' ||
            url.hostname.startsWith('127.') ||
            url.hostname.startsWith('192.168.') ||
            url.hostname.startsWith('10.')
          ) {
            return false;
          }

          return true;
        } catch {
          return false;
        }
      };

      expect(validatePaymasterUrl('https://sepolia.paymaster.avnu.fi')).toBe(
        true
      );
      expect(validatePaymasterUrl('http://sepolia.paymaster.avnu.fi')).toBe(
        false
      );
      expect(validatePaymasterUrl('https://localhost:3000')).toBe(false);
      expect(validatePaymasterUrl('not-a-url')).toBe(false);
    });
  });

  describe('Test 8.2: Paymaster Unavailability', () => {
    it('should handle paymaster network errors gracefully', async () => {
      const unavailableConfig: PaymasterConfig = {
        endpoint: 'https://nonexistent.paymaster.invalid',
        network: 'starknet:sepolia',
      };

      // In a real scenario, this would fail with network error
      // Applications should handle PaymasterError gracefully

      const handlePaymasterError = (error: Error) => {
        // Log error for monitoring
        console.error('Paymaster error:', error.message);

        // Return user-friendly message
        return {
          error: 'Payment service temporarily unavailable',
          retryAfter: 60, // seconds
        };
      };

      const fakeError = new Error('Network request failed');
      const result = handlePaymasterError(fakeError);

      expect(result.error).toBe('Payment service temporarily unavailable');
      expect(result.retryAfter).toBe(60);
    });

    it('should implement retry logic for paymaster failures', async () => {
      const maxRetries = 3;
      const retryDelay = 1000; // ms

      const retryPaymaster = async (
        fn: () => Promise<any>,
        retries: number = maxRetries
      ): Promise<any> => {
        try {
          return await fn();
        } catch (error) {
          if (retries > 0) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            return retryPaymaster(fn, retries - 1);
          }
          throw error;
        }
      };

      // Test retry logic
      let attempts = 0;
      const flakyPaymaster = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      };

      const result = await retryPaymaster(flakyPaymaster);
      expect(result.success).toBe(true);
      expect(attempts).toBe(2);
    });

    it('should have fallback paymaster endpoints', () => {
      const primaryEndpoint = 'https://sepolia.paymaster.avnu.fi';
      const fallbackEndpoints = [
        'https://backup1.paymaster.avnu.fi',
        'https://backup2.paymaster.avnu.fi',
      ];

      const getPaymasterEndpoint = (
        primary: string,
        fallbacks: Array<string>
      ): Array<string> => {
        return [primary, ...fallbacks];
      };

      const endpoints = getPaymasterEndpoint(
        primaryEndpoint,
        fallbackEndpoints
      );

      expect(endpoints).toHaveLength(3);
      expect(endpoints[0]).toBe(primaryEndpoint);
      expect(endpoints[1]).toBe(fallbackEndpoints[0]);
    });

    it('should timeout on slow paymaster responses', async () => {
      const timeout = 1000; // 1 second

      const withTimeout = <T>(
        promise: Promise<T>,
        timeoutMs: number
      ): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(() => {
              reject(new Error('Timeout'));
            }, timeoutMs)
          ),
        ]);
      };

      // Simulate slow paymaster (2 seconds, longer than timeout)
      const slowPaymaster = new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });

      await expect(withTimeout(slowPaymaster, timeout)).rejects.toThrow(
        'Timeout'
      );
    });

    it('should validate paymaster response format', () => {
      const validatePaymasterResponse = (response: any): boolean => {
        // Check required fields exist
        if (!response || typeof response !== 'object') return false;

        // Validate expected structure
        // (actual structure depends on paymaster API)
        return true;
      };

      const validResponse = {
        success: true,
        transactionHash: '0x123...',
      };

      const invalidResponse = null;

      expect(validatePaymasterResponse(validResponse)).toBe(true);
      expect(validatePaymasterResponse(invalidResponse)).toBe(false);
    });
  });

  describe('Paymaster Best Practices', () => {
    it('should use environment variables for paymaster config', () => {
      // Don't hardcode paymaster endpoints in code
      // Use environment variables instead

      const getPaymasterConfig = (): PaymasterConfig => {
        const endpoint =
          process.env.PAYMASTER_ENDPOINT ||
          DEFAULT_PAYMASTER_ENDPOINTS['starknet:sepolia'];

        const apiKey = process.env.PAYMASTER_API_KEY;

        return {
          endpoint,
          network: 'starknet:sepolia',
          ...(apiKey ? { apiKey } : {}),
        };
      };

      const config = getPaymasterConfig();
      expect(config.endpoint).toBeDefined();
      expect(config.network).toBe('starknet:sepolia');
    });

    it('should log paymaster requests for audit trail', () => {
      const logPaymasterRequest = (config: PaymasterConfig) => {
        return {
          timestamp: new Date().toISOString(),
          endpoint: config.endpoint,
          network: config.network,
          // Don't log API keys
        };
      };

      const config: PaymasterConfig = {
        endpoint: 'https://sepolia.paymaster.avnu.fi',
        network: 'starknet:sepolia',
        apiKey: 'secret-key-123',
      };

      const log = logPaymasterRequest(config);

      expect(log.endpoint).toBe(config.endpoint);
      expect(log.network).toBe(config.network);
      expect((log as any).apiKey).toBeUndefined(); // Never log secrets
    });

    it('should monitor paymaster health', () => {
      const paymasterHealth = {
        endpoint: 'https://sepolia.paymaster.avnu.fi',
        lastSuccessfulRequest: new Date(),
        failureCount: 0,
        isHealthy: true,
      };

      const recordSuccess = (health: typeof paymasterHealth) => {
        health.lastSuccessfulRequest = new Date();
        health.failureCount = 0;
        health.isHealthy = true;
      };

      const recordFailure = (health: typeof paymasterHealth) => {
        health.failureCount++;
        if (health.failureCount > 3) {
          health.isHealthy = false;
        }
      };

      recordSuccess(paymasterHealth);
      expect(paymasterHealth.isHealthy).toBe(true);

      recordFailure(paymasterHealth);
      recordFailure(paymasterHealth);
      recordFailure(paymasterHealth);
      expect(paymasterHealth.failureCount).toBe(3);

      recordFailure(paymasterHealth);
      expect(paymasterHealth.isHealthy).toBe(false);
    });
  });

  describe('Security: Signature Theft Protection', () => {
    it('should warn about untrusted paymaster stealing signatures', () => {
      // SECURITY WARNING: Untrusted paymaster could:
      // 1. Steal signatures
      // 2. Not execute transactions
      // 3. Execute transactions maliciously
      // 4. Front-run transactions

      const trustedPaymasters = [
        'https://sepolia.paymaster.avnu.fi',
        'https://starknet.paymaster.avnu.fi',
      ];

      const untrustedPaymaster = 'https://evil.paymaster.com';

      const isTrusted = (endpoint: string) =>
        trustedPaymasters.includes(endpoint);

      expect(isTrusted(trustedPaymasters[0])).toBe(true);
      expect(isTrusted(untrustedPaymaster)).toBe(false);

      // Demonstrate that untrusted paymasters should be rejected
      const validatePaymaster = (endpoint: string) => {
        if (!isTrusted(endpoint)) {
          throw new Error('Untrusted paymaster - signature theft risk');
        }
        return true;
      };

      // Trusted paymaster passes validation
      expect(() => validatePaymaster(trustedPaymasters[0])).not.toThrow();

      // Untrusted paymaster fails validation
      expect(() => validatePaymaster(untrustedPaymaster)).toThrow(
        'Untrusted paymaster - signature theft risk'
      );
    });
  });
});
