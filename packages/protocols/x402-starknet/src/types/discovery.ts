/**
 * Discovery API type definitions for x402
 * Spec compliance: x402 v2 - Section 8 Discovery API
 */

import type { PaymentRequirements } from './payment.js';

/**
 * Resource type identifier
 * Currently only "http" is supported
 */
export type ResourceType = 'http' | 'mcp' | 'a2a';

/**
 * Resource metadata for discovery
 */
export interface ResourceMetadata {
  /** Resource category (e.g., "finance", "ai", "data") */
  category?: string;
  /** Provider name or organization */
  provider?: string;
  /** Resource tags for search */
  tags?: Array<string>;
  /** Additional custom metadata */
  [key: string]: unknown;
}

/**
 * Discovered resource item
 * Spec compliance: x402 v2 - Section 8.2
 */
export interface DiscoveredResource {
  /** The resource URL or identifier being monetized */
  resource: string;
  /** Resource type (e.g., "http") */
  type: ResourceType;
  /** Protocol version supported by the resource */
  x402Version: number;
  /** Array of PaymentRequirements objects specifying payment methods */
  accepts: Array<PaymentRequirements>;
  /** Unix timestamp of when the resource was last updated */
  lastUpdated: number;
  /** Additional metadata (category, provider, etc.) */
  metadata?: ResourceMetadata;
}

/**
 * Pagination information for discovery responses
 */
export interface DiscoveryPagination {
  /** Maximum results per page */
  limit: number;
  /** Number of results skipped */
  offset: number;
  /** Total number of matching resources */
  total: number;
}

/**
 * Discovery API response
 * Spec compliance: x402 v2 - Section 8.1
 */
export interface DiscoveryResponse {
  /** Protocol version */
  x402Version: 2;
  /** Array of discovered resources */
  items: Array<DiscoveredResource>;
  /** Pagination information */
  pagination: DiscoveryPagination;
}

/**
 * Discovery API request parameters
 * Spec compliance: x402 v2 - Section 8.1
 */
export interface DiscoveryParams {
  /** Filter by resource type (e.g., "http") */
  type?: ResourceType;
  /** Maximum number of results to return (1-100, default: 20) */
  limit?: number;
  /** Number of results to skip for pagination (default: 0) */
  offset?: number;
  /** Filter by network (e.g., "starknet:sepolia") */
  network?: string;
  /** Filter by category */
  category?: string;
  /** Filter by provider */
  provider?: string;
  /** Search query for resource URLs or descriptions */
  query?: string;
}

/**
 * Resource registration request (for bazaar operators)
 */
export interface RegisterResourceRequest {
  /** The resource URL or identifier */
  resource: string;
  /** Resource type */
  type: ResourceType;
  /** Payment requirements for the resource */
  accepts: Array<PaymentRequirements>;
  /** Resource metadata */
  metadata?: ResourceMetadata;
}

/**
 * Resource registration response
 */
export interface RegisterResourceResponse {
  /** Whether registration was successful */
  success: boolean;
  /** Resource identifier if successful */
  resourceId?: string;
  /** Error message if failed */
  error?: string;
}
