/**
 * OpenBare Client
 * Multi-server proxy client with automatic failover
 */

import { ServerPool } from './server-pool.js';
import { bareFetch, BareError } from './bare-fetch.js';
import { Discovery } from './discovery.js';
// import * as codec from './codec.js'; // Available for URL encoding utilities

/**
 * @typedef {Object} OpenBareClientOptions
 * @property {string[]} [servers=[]] - Initial server URLs
 * @property {number} [timeout=30000] - Request timeout in ms
 * @property {number} [retries=3] - Max retries on failure
 * @property {'fastest'|'round-robin'|'priority'} [strategy='fastest'] - Server selection strategy
 * @property {boolean} [autoHealthCheck=true] - Enable automatic health checks
 * @property {number} [healthCheckInterval=30000] - Health check interval in ms
 * @property {string} [registryUrl] - Registry URL for auto-discovery
 * @property {boolean} [autoDiscover=false] - Enable auto-discovery
 */

/**
 * @typedef {Object} FetchOptions
 * @property {string} [method='GET'] - HTTP method
 * @property {Record<string, string>} [headers] - Request headers
 * @property {string|ReadableStream|Blob|ArrayBuffer|null} [body] - Request body
 * @property {number} [timeout] - Request timeout (overrides default)
 * @property {number} [retries] - Max retries (overrides default)
 * @property {AbortSignal} [signal] - Abort signal
 */

/**
 * OpenBare multi-server proxy client
 */
export class OpenBareClient {
  /** @type {ServerPool} */
  #pool;
  
  /** @type {Discovery|null} */
  #discovery = null;
  
  /** @type {OpenBareClientOptions} */
  #options;

  /**
   * Create a new OpenBare client
   * @param {OpenBareClientOptions} [options={}] - Client options
   */
  constructor(options = {}) {
    this.#options = {
      servers: options.servers || [],
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      strategy: options.strategy || 'fastest',
      autoHealthCheck: options.autoHealthCheck !== false,
      healthCheckInterval: options.healthCheckInterval || 30000,
      registryUrl: options.registryUrl || null,
      autoDiscover: options.autoDiscover || false
    };

    // Initialize server pool
    this.#pool = new ServerPool({
      strategy: this.#options.strategy,
      healthCheckInterval: this.#options.healthCheckInterval,
      timeout: this.#options.timeout
    });

    // Add initial servers
    for (const server of this.#options.servers) {
      this.#pool.addServer(server);
    }

    // Start health checks if enabled
    if (this.#options.autoHealthCheck && this.#options.servers.length > 0) {
      this.#pool.startHealthChecks();
    }

    // Set up auto-discovery if enabled
    if (this.#options.autoDiscover && this.#options.registryUrl) {
      this.#setupDiscovery();
    }
  }

  /**
   * Add a server to the pool
   * @param {string} url - Server URL
   * @param {number} [priority] - Server priority (lower = higher priority)
   * @returns {this} Client instance for chaining
   */
  addServer(url, priority) {
    this.#pool.addServer(url, priority);
    
    // Start health checks if this is the first server
    if (this.#options.autoHealthCheck && this.#pool.getAllServers().length === 1) {
      this.#pool.startHealthChecks();
    }
    
    return this;
  }

  /**
   * Remove a server from the pool
   * @param {string} url - Server URL
   * @returns {boolean} Whether server was removed
   */
  removeServer(url) {
    return this.#pool.removeServer(url);
  }

  /**
   * Perform a proxied fetch with automatic failover
   * @param {string} url - Target URL to fetch
   * @param {FetchOptions} [options={}] - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  async fetch(url, options = {}) {
    const timeout = options.timeout || this.#options.timeout;
    const maxRetries = options.retries || this.#options.retries;
    
    let lastError = null;
    let attemptedServers = new Set();
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Select a server that hasn't been tried yet
      let server = this.#pool.selectServer();
      
      // If selected server was already tried, get next one
      while (server && attemptedServers.has(server.url)) {
        server = this.#pool.getNextServer(server.url);
      }
      
      if (!server) {
        // No more servers to try
        break;
      }
      
      attemptedServers.add(server.url);
      const startTime = performance.now();
      
      try {
        const response = await bareFetch(server.url, url, {
          method: options.method,
          headers: options.headers,
          body: options.body,
          timeout,
          signal: options.signal
        });
        
        // Report success with latency
        const latency = performance.now() - startTime;
        this.#pool.reportSuccess(server.url, latency);
        
        return response;
      } catch (error) {
        lastError = error;
        this.#pool.reportFailure(server.url);
        
        // If aborted, don't retry
        if (error.code === 'ABORT' || options.signal?.aborted) {
          throw error;
        }
        
        // Continue to next server
        continue;
      }
    }
    
    // All retries exhausted
    throw new BareError(
      `All servers failed after ${attemptedServers.size} attempts: ${lastError?.message || 'Unknown error'}`,
      'ALL_SERVERS_FAILED',
      { cause: lastError }
    );
  }

  /**
   * Test a specific server's latency
   * @param {string} url - Server URL to test
   * @returns {Promise<{ok: boolean, latency: number}>} Test result
   */
  async testServer(url) {
    return this.#pool.testServer(url);
  }

  /**
   * Test all servers and sort by latency
   * @returns {Promise<Array<{url: string, ok: boolean, latency: number}>>} Sorted test results
   */
  async testAllServers() {
    const results = await this.#pool.testAllServers();
    
    return Array.from(results.entries())
      .map(([url, result]) => ({ url, ...result }))
      .sort((a, b) => {
        // Put failures at the end
        if (!a.ok && b.ok) {
          return 1;
        }
        if (a.ok && !b.ok) {
          return -1;
        }
        // Sort by latency
        return a.latency - b.latency;
      });
  }

  /**
   * Get all healthy servers
   * @returns {Array<{url: string, latency: number, priority: number}>} Healthy servers
   */
  getHealthyServers() {
    return this.#pool.getHealthyServers().map(server => ({
      url: server.url,
      latency: server.latency,
      priority: server.priority
    }));
  }

  /**
   * Set the fallback order for servers
   * @param {string[]} urls - URLs in priority order
   * @returns {this} Client instance for chaining
   */
  setFallbackOrder(urls) {
    this.#pool.setFallbackOrder(urls);
    return this;
  }

  /**
   * Set server selection strategy
   * @param {'fastest'|'round-robin'|'priority'} strategy - Selection strategy
   * @returns {this} Client instance for chaining
   */
  setStrategy(strategy) {
    this.#options.strategy = strategy;
    // Pool doesn't support dynamic strategy change, so recreate
    // For now, just update options for future reference
    return this;
  }

  /**
   * Get pool statistics
   * @returns {Object} Pool statistics
   */
  getStats() {
    return this.#pool.getStats();
  }

  /**
   * Discover servers from registry
   * @param {string} [registryUrl] - Registry URL (uses default if not provided)
   * @returns {Promise<string[]>} Discovered server URLs
   */
  async discover(registryUrl) {
    if (!this.#discovery) {
      this.#discovery = new Discovery({
        registryUrl: registryUrl || this.#options.registryUrl
      });
    } else if (registryUrl) {
      this.#discovery.setRegistryUrl(registryUrl);
    }

    const nodes = await this.#discovery.fetchNodes();
    
    for (const node of nodes) {
      this.addServer(node.url);
    }
    
    return nodes.map(n => n.url);
  }

  /**
   * Stop all background tasks
   */
  destroy() {
    this.#pool.stopHealthChecks();
    if (this.#discovery) {
      this.#discovery.stopAutoRefresh();
    }
  }

  /**
   * Set up auto-discovery
   */
  #setupDiscovery() {
    this.#discovery = new Discovery({
      registryUrl: this.#options.registryUrl,
      autoRefresh: true
    });

    this.#discovery.onUpdate((nodes) => {
      for (const node of nodes) {
        this.addServer(node.url);
      }
    });

    // Initial discovery
    this.discover().catch(err => {
      console.warn('Initial discovery failed:', err.message);
    });
  }
}

// Re-export utilities
export { ServerPool } from './server-pool.js';
export { bareFetch, BareError, testBareServer } from './bare-fetch.js';
export { Discovery, DiscoveryError, KNOWN_REGISTRIES } from './discovery.js';
export { 
  xor, 
  encodeUrl, 
  decodeUrl, 
  encodeHeaders, 
  decodeHeaders 
} from './codec.js';

// Default export
export default OpenBareClient;
