/**
 * OpenBare Client TypeScript Definitions
 */

// ============================================================================
// Codec Types
// ============================================================================

/**
 * XOR encode/decode a string
 */
export function xor(str: string, key?: number): string;

/**
 * Encode a URL for transmission
 */
export function encodeUrl(url: string): string;

/**
 * Decode an encoded URL
 */
export function decodeUrl(encoded: string): string;

/**
 * Encode headers for bare protocol
 */
export function encodeHeaders(headers: Record<string, string>): string;

/**
 * Decode headers from bare response
 */
export function decodeHeaders(headerString: string): Record<string, string>;

// ============================================================================
// Bare Fetch Types
// ============================================================================

export interface BareResponse {
  status: number;
  statusText: string;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
  ok: boolean;
  url: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
  blob(): Promise<Blob>;
}

export interface BareFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | ReadableStream | Blob | ArrayBuffer | null;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Perform a fetch through a single bare server
 */
export function bareFetch(
  bareServer: string,
  targetUrl: string,
  options?: BareFetchOptions
): Promise<BareResponse>;

/**
 * Test if a bare server is reachable
 */
export function testBareServer(
  bareServer: string,
  timeout?: number
): Promise<{ ok: boolean; latency: number; error?: string }>;

/**
 * Bare operation error
 */
export class BareError extends Error {
  code: string;
  constructor(message: string, code: string, options?: { cause?: Error });
}

// ============================================================================
// Server Pool Types
// ============================================================================

export interface ServerInfo {
  url: string;
  priority: number;
  healthy: boolean;
  latency: number;
  failCount: number;
  lastCheck: number;
  successCount: number;
  totalRequests: number;
}

export interface PoolOptions {
  strategy?: 'fastest' | 'round-robin' | 'priority';
  healthCheckInterval?: number;
  maxFailures?: number;
  recoveryTime?: number;
  timeout?: number;
}

export interface PoolStats {
  total: number;
  healthy: number;
  unhealthy: number;
  avgLatency: number;
  strategy: string;
}

/**
 * Server pool for managing multiple bare servers
 */
export class ServerPool {
  constructor(options?: PoolOptions);
  
  addServer(url: string, priority?: number): ServerInfo;
  removeServer(url: string): boolean;
  getAllServers(): ServerInfo[];
  getHealthyServers(): ServerInfo[];
  selectServer(): ServerInfo | null;
  getNextServer(excludeUrl: string): ServerInfo | null;
  reportSuccess(url: string, latency?: number): void;
  reportFailure(url: string): void;
  testServer(url: string): Promise<{ ok: boolean; latency: number }>;
  testAllServers(): Promise<Map<string, { ok: boolean; latency: number }>>;
  setFallbackOrder(urls: string[]): void;
  startHealthChecks(): void;
  stopHealthChecks(): void;
  getStats(): PoolStats;
}

// ============================================================================
// Discovery Types
// ============================================================================

export interface RegistryNode {
  url: string;
  name?: string | null;
  region?: string | null;
  operator?: string | null;
  verified?: boolean;
  features?: string[];
  uptime?: number | null;
}

export interface DiscoveryOptions {
  registryUrl?: string;
  refreshInterval?: number;
  autoRefresh?: boolean;
  region?: string;
  verifiedOnly?: boolean;
}

export interface DiscoveryFilters {
  region?: string;
  verifiedOnly?: boolean;
  features?: string[];
}

/**
 * Registry discovery for OpenBare servers
 */
export class Discovery {
  constructor(options?: DiscoveryOptions);
  
  fetchNodes(filters?: DiscoveryFilters): Promise<RegistryNode[]>;
  getNodes(): Promise<RegistryNode[]>;
  getNodesByRegion(region: string): RegistryNode[];
  getVerifiedNodes(): RegistryNode[];
  getNodesWithFeatures(features: string[]): RegistryNode[];
  getServerUrls(): string[];
  startAutoRefresh(): void;
  stopAutoRefresh(): void;
  onUpdate(callback: (nodes: RegistryNode[]) => void): () => void;
  getTimeSinceLastFetch(): number;
  isCacheStale(maxAge?: number): boolean;
  clearCache(): void;
  setRegistryUrl(url: string): void;
}

/**
 * Discovery error
 */
export class DiscoveryError extends Error {
  code: string;
  constructor(message: string, code: string);
}

/**
 * Create a discovery instance
 */
export function createDiscovery(options?: DiscoveryOptions): Discovery;

/**
 * Known public registries
 */
export const KNOWN_REGISTRIES: {
  default: string;
  community: string;
  backup: string;
};

// ============================================================================
// Main Client Types
// ============================================================================

export interface OpenBareClientOptions {
  servers?: string[];
  timeout?: number;
  retries?: number;
  strategy?: 'fastest' | 'round-robin' | 'priority';
  autoHealthCheck?: boolean;
  healthCheckInterval?: number;
  registryUrl?: string;
  autoDiscover?: boolean;
}

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | ReadableStream | Blob | ArrayBuffer | null;
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

export interface HealthyServer {
  url: string;
  latency: number;
  priority: number;
}

export interface TestResult {
  url: string;
  ok: boolean;
  latency: number;
  error?: string;
}

/**
 * OpenBare multi-server proxy client
 */
export class OpenBareClient {
  constructor(options?: OpenBareClientOptions);
  
  /**
   * Add a server to the pool
   */
  addServer(url: string, priority?: number): this;
  
  /**
   * Remove a server from the pool
   */
  removeServer(url: string): boolean;
  
  /**
   * Perform a proxied fetch with automatic failover
   */
  fetch(url: string, options?: FetchOptions): Promise<BareResponse>;
  
  /**
   * Test a specific server's latency
   */
  testServer(url: string): Promise<{ ok: boolean; latency: number }>;
  
  /**
   * Test all servers and sort by latency
   */
  testAllServers(): Promise<TestResult[]>;
  
  /**
   * Get all healthy servers
   */
  getHealthyServers(): HealthyServer[];
  
  /**
   * Set the fallback order for servers
   */
  setFallbackOrder(urls: string[]): this;
  
  /**
   * Set server selection strategy
   */
  setStrategy(strategy: 'fastest' | 'round-robin' | 'priority'): this;
  
  /**
   * Get pool statistics
   */
  getStats(): PoolStats;
  
  /**
   * Discover servers from registry
   */
  discover(registryUrl?: string): Promise<string[]>;
  
  /**
   * Stop all background tasks
   */
  destroy(): void;
}

export default OpenBareClient;
