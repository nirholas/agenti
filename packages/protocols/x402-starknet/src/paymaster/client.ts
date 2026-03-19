/**
 * Paymaster RPC client
 */

import type {
  PaymasterConfig,
  BuildTransactionRequest,
  BuildTransactionResponse,
  ExecuteTransactionRequest,
  ExecuteTransactionResponse,
  SupportedTokensResponse,
  IsAvailableResponse,
  JsonRpcRequest,
  JsonRpcResponse,
} from '../types/paymaster.js';
import { err, wrapUnknown, isX402Error } from '../errors.js';

/**
 * Paymaster RPC client for interacting with AVNU Paymaster
 */
export class PaymasterClient {
  private requestId = 0;

  constructor(private config: PaymasterConfig) {}

  /**
   * Sleep for a given number of milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Make a JSON-RPC request to the paymaster with retry logic
   */
  private async rpcCall<T>(method: string, params: unknown): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: ++this.requestId,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if provided (for sponsored mode)
    if (this.config.apiKey) {
      headers['x-paymaster-api-key'] = this.config.apiKey;
    }

    const maxRetries = 10;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const requestBody = JSON.stringify(request);

        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers,
          body: requestBody,
          // Add timeout to prevent hanging forever
          signal: AbortSignal.timeout(30000), // 30 second timeout per request
        });

        if (!response.ok) {
          // 5xx errors might recover after paymaster failover, retry them
          const shouldRetry = response.status >= 500;

          const error = err.paymaster(
            `HTTP error: ${String(response.status)} ${response.statusText}`,
            undefined,
            { status: response.status, statusText: response.statusText }
          );

          if (!shouldRetry) {
            throw error; // Don't retry 4xx errors (client errors)
          }

          throw error; // Will be caught and retried
        }

        const jsonResponse = (await response.json()) as JsonRpcResponse<T>;

        if (jsonResponse.error) {
          throw err.paymaster(jsonResponse.error.message, undefined, {
            code: jsonResponse.error.code,
            data: jsonResponse.error.data,
          });
        }

        if (jsonResponse.result === undefined) {
          throw err.paymaster('No result in RPC response');
        }

        // Success - return result
        return jsonResponse.result;
      } catch (error) {
        lastError = error;

        // Don't retry on X402 errors (application-level errors like validation failures)
        if (isX402Error(error)) {
          throw error;
        }

        // If this was the last attempt, throw
        if (attempt === maxRetries) {
          throw wrapUnknown(
            error,
            'EPAYMASTER',
            `RPC call '${method}' failed after ${String(maxRetries + 1)} retries`
          );
        }

        // Optimized backoff strategy for paymaster with circuit breaker:
        // - Quick retries initially (1s, 2s, 4s) for transient network errors
        // - Longer delays after 3 failures (8s, 15s, 30s, 45s, 60s, 60s, 60s)
        //   to allow paymaster circuit breaker to trip and failover (10-60s)
        let backoffMs: number;
        if (attempt < 3) {
          // Fast retries for quick recovery from transient errors
          backoffMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
        } else if (attempt < 6) {
          // Medium delays to allow circuit breaker to trip
          backoffMs = 8000 + (attempt - 3) * 7000; // 8s, 15s, 22s
        } else {
          // Long delays to allow full failover and recovery
          backoffMs = 30000 + Math.min((attempt - 6) * 15000, 30000); // 30s, 45s, 60s, 60s
        }

        await this.sleep(backoffMs);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw wrapUnknown(lastError, 'EPAYMASTER', 'RPC call failed after retries');
  }

  /**
   * Build a transaction with paymaster
   *
   * @param request - Build transaction request
   * @returns Transaction with typed data for signing
   *
   * @example
   * ```typescript
   * const result = await client.buildTransaction({
   *   transaction: {
   *     type: 'invoke',
   *     invoke: {
   *       user_address: '0x1234...',
   *       calls: [{ to: '0x...', selector: 'transfer', calldata: [...] }]
   *     }
   *   },
   *   parameters: {
   *     version: '0x1',
   *     fee_mode: { mode: 'sponsored' }
   *   }
   * });
   * ```
   */
  async buildTransaction(
    request: BuildTransactionRequest
  ): Promise<BuildTransactionResponse> {
    return this.rpcCall<BuildTransactionResponse>(
      'paymaster_buildTransaction',
      request
    );
  }

  /**
   * Execute a transaction via paymaster
   *
   * @param request - Execute transaction request with signature
   * @returns Transaction hash
   *
   * @example
   * ```typescript
   * const result = await client.executeTransaction({
   *   transaction: { ... },
   *   parameters: { ... },
   *   signature: ['0x...', '0x...']
   * });
   * console.log('Transaction hash:', result.transaction_hash);
   * ```
   */
  async executeTransaction(
    request: ExecuteTransactionRequest
  ): Promise<ExecuteTransactionResponse> {
    return this.rpcCall<ExecuteTransactionResponse>(
      'paymaster_executeTransaction',
      request
    );
  }

  /**
   * Get list of supported gas tokens
   *
   * @returns Supported token addresses
   *
   * @example
   * ```typescript
   * const tokens = await client.getSupportedTokens();
   * console.log('Supported tokens:', tokens.tokens);
   * ```
   */
  async getSupportedTokens(): Promise<SupportedTokensResponse> {
    return this.rpcCall<SupportedTokensResponse>(
      'paymaster_getSupportedTokens',
      {}
    );
  }

  /**
   * Check if paymaster service is available
   *
   * @returns Availability status
   *
   * @example
   * ```typescript
   * const status = await client.isAvailable();
   * if (status.available) {
   *   console.log('Paymaster is ready');
   * }
   * ```
   */
  async isAvailable(): Promise<IsAvailableResponse> {
    return this.rpcCall<IsAvailableResponse>('paymaster_isAvailable', {});
  }

  /**
   * Get the endpoint URL
   */
  getEndpoint(): string {
    return this.config.endpoint;
  }

  /**
   * Get the network
   */
  getNetwork(): string {
    return this.config.network;
  }
}

/**
 * Create a paymaster client
 *
 * @param config - Paymaster configuration
 * @returns Configured paymaster client
 *
 * @example
 * ```typescript
 * const client = createPaymasterClient({
 *   endpoint: 'https://paymaster.avnu.fi',
 *   network: 'starknet-sepolia',
 *   apiKey: 'optional-api-key'
 * });
 * ```
 */
export function createPaymasterClient(
  config: PaymasterConfig
): PaymasterClient {
  return new PaymasterClient(config);
}
