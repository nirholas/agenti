/**
 * Discovery API client for x402 Bazaar
 * Spec compliance: x402 v2 - Section 8 Discovery API
 */

import type {
  DiscoveryResponse,
  DiscoveryParams,
  RegisterResourceRequest,
  RegisterResourceResponse,
} from '../types/index.js';
import { err } from '../errors.js';

/**
 * Configuration for the discovery client
 */
export interface DiscoveryClientConfig {
  /** Base URL of the discovery/bazaar service */
  baseUrl: string;
  /** Optional API key for authentication */
  apiKey?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom fetch implementation (for testing) */
  fetch?: typeof fetch;
}

/**
 * Discovery client interface
 * Spec compliance: x402 v2 - Discovery API
 */
export interface IDiscoveryClient {
  /**
   * Discover x402-enabled resources
   * @param params - Discovery parameters (filters, pagination)
   * @returns Discovery response with resources
   */
  discover(params?: DiscoveryParams): Promise<DiscoveryResponse>;

  /**
   * Register a resource in the bazaar (for providers)
   * @param request - Resource registration request
   * @returns Registration response
   */
  register(request: RegisterResourceRequest): Promise<RegisterResourceResponse>;

  /**
   * Unregister a resource from the bazaar
   * @param resourceId - Resource identifier to remove
   * @returns Success status
   */
  unregister(resourceId: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Refresh/update a resource's payment requirements
   * @param resourceId - Resource identifier
   * @param request - Updated resource information
   * @returns Update response
   */
  update(
    resourceId: string,
    request: Partial<RegisterResourceRequest>
  ): Promise<RegisterResourceResponse>;
}

/**
 * HTTP client for communicating with x402 discovery/bazaar services
 *
 * The Discovery API allows clients to find x402-enabled resources and
 * providers to register their monetized services.
 *
 * @example
 * ```typescript
 * const client = new DiscoveryClient({
 *   baseUrl: 'https://bazaar.example.com',
 * });
 *
 * // Discover resources
 * const resources = await client.discover({
 *   type: 'http',
 *   network: 'starknet:sepolia',
 *   limit: 10,
 * });
 *
 * // Register a resource (for providers)
 * const result = await client.register({
 *   resource: 'https://api.myservice.com/data',
 *   type: 'http',
 *   accepts: [paymentRequirements],
 *   metadata: { category: 'data', provider: 'MyService' },
 * });
 * ```
 */
export class DiscoveryClient implements IDiscoveryClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeout: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: DiscoveryClientConfig) {
    // Normalize base URL (remove trailing slash)
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30000;
    this.fetchFn = config.fetch ?? fetch;
  }

  /**
   * Discover x402-enabled resources
   * Spec compliance: x402 v2 - Section 8.1 GET /discovery/resources
   */
  async discover(params?: DiscoveryParams): Promise<DiscoveryResponse> {
    const queryParams = new URLSearchParams();

    if (params?.type) {
      queryParams.set('type', params.type);
    }
    if (params?.limit !== undefined) {
      queryParams.set('limit', String(params.limit));
    }
    if (params?.offset !== undefined) {
      queryParams.set('offset', String(params.offset));
    }
    if (params?.network) {
      queryParams.set('network', params.network);
    }
    if (params?.category) {
      queryParams.set('category', params.category);
    }
    if (params?.provider) {
      queryParams.set('provider', params.provider);
    }
    if (params?.query) {
      queryParams.set('query', params.query);
    }

    const queryString = queryParams.toString();
    const path = queryString
      ? `/discovery/resources?${queryString}`
      : '/discovery/resources';

    return this.request<DiscoveryResponse>(path, { method: 'GET' });
  }

  /**
   * Register a resource in the bazaar
   */
  async register(
    request: RegisterResourceRequest
  ): Promise<RegisterResourceResponse> {
    return this.request<RegisterResourceResponse>('/discovery/resources', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Unregister a resource from the bazaar
   */
  async unregister(
    resourceId: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.request<{ success: boolean; error?: string }>(
      `/discovery/resources/${encodeURIComponent(resourceId)}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Update a resource's information
   */
  async update(
    resourceId: string,
    request: Partial<RegisterResourceRequest>
  ): Promise<RegisterResourceResponse> {
    return this.request<RegisterResourceResponse>(
      `/discovery/resources/${encodeURIComponent(resourceId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * Make an HTTP request to the discovery service
   */
  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const response = await this.fetchFn(url, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers as Record<string, string>),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw err.network(
          `Discovery request failed: ${String(response.status)} ${response.statusText}`,
          undefined,
          {
            status: response.status,
            statusText: response.statusText,
            body: errorBody,
            url,
          }
        );
      }

      const data: unknown = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw err.timeout(this.timeout);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Create a discovery client instance
 *
 * @param config - Client configuration
 * @returns Configured discovery client
 *
 * @example
 * ```typescript
 * const client = createDiscoveryClient({
 *   baseUrl: 'https://bazaar.example.com',
 * });
 *
 * const resources = await client.discover({ type: 'http' });
 * ```
 */
export function createDiscoveryClient(
  config: DiscoveryClientConfig
): IDiscoveryClient {
  return new DiscoveryClient(config);
}
