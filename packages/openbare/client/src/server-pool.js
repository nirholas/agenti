/**
 * OpenBare Server Pool Management
 * Handles server health tracking, failover, and load balancing
 */

import { testBareServer } from './bare-fetch.js';

/**
 * @typedef {Object} ServerInfo
 * @property {string} url - Server URL
 * @property {number} priority - Server priority (lower = higher priority)
 * @property {boolean} healthy - Whether server is healthy
 * @property {number} latency - Last measured latency in ms
 * @property {number} failCount - Consecutive failure count
 * @property {number} lastCheck - Timestamp of last health check
 * @property {number} successCount - Total successful requests
 * @property {number} totalRequests - Total requests made
 */

/**
 * @typedef {Object} PoolOptions
 * @property {'fastest'|'round-robin'|'priority'} [strategy='fastest'] - Selection strategy
 * @property {number} [healthCheckInterval=30000] - Health check interval in ms
 * @property {number} [maxFailures=3] - Max failures before marking unhealthy
 * @property {number} [recoveryTime=60000] - Time before retrying unhealthy server
 * @property {number} [timeout=5000] - Default request timeout
 */

/**
 * Server pool for managing multiple bare servers
 */
export class ServerPool {
  /** @type {Map<string, ServerInfo>} */
  #servers = new Map();
  
  /** @type {PoolOptions} */
  #options;
  
  /** @type {number} */
  #roundRobinIndex = 0;
  
  /** @type {NodeJS.Timeout|number|null} */
  #healthCheckTimer = null;

  /**
   * Create a new server pool
   * @param {PoolOptions} [options={}] - Pool options
   */
  constructor(options = {}) {
    this.#options = {
      strategy: options.strategy || 'fastest',
      healthCheckInterval: options.healthCheckInterval || 30000,
      maxFailures: options.maxFailures || 3,
      recoveryTime: options.recoveryTime || 60000,
      timeout: options.timeout || 5000
    };
  }

  /**
   * Add a server to the pool
   * @param {string} url - Server URL
   * @param {number} [priority=10] - Server priority
   * @returns {ServerInfo} Added server info
   */
  addServer(url, priority = 10) {
    const normalizedUrl = this.#normalizeUrl(url);
    
    if (this.#servers.has(normalizedUrl)) {
      const existing = this.#servers.get(normalizedUrl);
      existing.priority = priority;
      return existing;
    }

    /** @type {ServerInfo} */
    const serverInfo = {
      url: normalizedUrl,
      priority,
      healthy: true, // Assume healthy until proven otherwise
      latency: Infinity,
      failCount: 0,
      lastCheck: 0,
      successCount: 0,
      totalRequests: 0
    };

    this.#servers.set(normalizedUrl, serverInfo);
    return serverInfo;
  }

  /**
   * Remove a server from the pool
   * @param {string} url - Server URL
   * @returns {boolean} Whether server was removed
   */
  removeServer(url) {
    const normalizedUrl = this.#normalizeUrl(url);
    return this.#servers.delete(normalizedUrl);
  }

  /**
   * Get all servers in the pool
   * @returns {ServerInfo[]} All servers
   */
  getAllServers() {
    return Array.from(this.#servers.values());
  }

  /**
   * Get only healthy servers
   * @returns {ServerInfo[]} Healthy servers
   */
  getHealthyServers() {
    const now = Date.now();
    
    return Array.from(this.#servers.values()).filter(server => {
      // Consider server healthy if:
      // 1. It's marked healthy, OR
      // 2. Enough time has passed since last failure (recovery time)
      if (server.healthy) {
        return true;
      }
      
      if (now - server.lastCheck > this.#options.recoveryTime) {
        // Give it another chance
        server.healthy = true;
        server.failCount = 0;
        return true;
      }
      
      return false;
    });
  }

  /**
   * Select the best server based on strategy
   * @returns {ServerInfo|null} Selected server or null if none available
   */
  selectServer() {
    const healthy = this.getHealthyServers();
    
    if (healthy.length === 0) {
      return null;
    }

    switch (this.#options.strategy) {
      case 'fastest':
        return this.#selectFastest(healthy);
      case 'round-robin':
        return this.#selectRoundRobin(healthy);
      case 'priority':
        return this.#selectByPriority(healthy);
      default:
        return this.#selectFastest(healthy);
    }
  }

  /**
   * Get next server for failover (excludes provided server)
   * @param {string} excludeUrl - URL to exclude
   * @returns {ServerInfo|null} Next server or null
   */
  getNextServer(excludeUrl) {
    const normalizedExclude = this.#normalizeUrl(excludeUrl);
    const healthy = this.getHealthyServers().filter(s => s.url !== normalizedExclude);
    
    if (healthy.length === 0) {
      return null;
    }

    return this.#selectFastest(healthy);
  }

  /**
   * Report a successful request
   * @param {string} url - Server URL
   * @param {number} [latency] - Request latency in ms
   */
  reportSuccess(url, latency) {
    const normalizedUrl = this.#normalizeUrl(url);
    const server = this.#servers.get(normalizedUrl);
    
    if (server) {
      server.healthy = true;
      server.failCount = 0;
      server.successCount++;
      server.totalRequests++;
      server.lastCheck = Date.now();
      
      if (typeof latency === 'number' && latency > 0) {
        // Exponential moving average for latency
        if (server.latency === Infinity) {
          server.latency = latency;
        } else {
          server.latency = Math.round(server.latency * 0.7 + latency * 0.3);
        }
      }
    }
  }

  /**
   * Report a failed request
   * @param {string} url - Server URL
   */
  reportFailure(url) {
    const normalizedUrl = this.#normalizeUrl(url);
    const server = this.#servers.get(normalizedUrl);
    
    if (server) {
      server.failCount++;
      server.totalRequests++;
      server.lastCheck = Date.now();
      
      if (server.failCount >= this.#options.maxFailures) {
        server.healthy = false;
      }
    }
  }

  /**
   * Test a specific server
   * @param {string} url - Server URL
   * @returns {Promise<{ok: boolean, latency: number}>} Test result
   */
  async testServer(url) {
    const normalizedUrl = this.#normalizeUrl(url);
    const result = await testBareServer(normalizedUrl, this.#options.timeout);
    
    if (result.ok) {
      this.reportSuccess(normalizedUrl, result.latency);
    } else {
      this.reportFailure(normalizedUrl);
    }
    
    return result;
  }

  /**
   * Test all servers in the pool
   * @returns {Promise<Map<string, {ok: boolean, latency: number}>>} Test results
   */
  async testAllServers() {
    const results = new Map();
    const tests = [];

    for (const [url] of this.#servers) {
      tests.push(
        this.testServer(url).then(result => {
          results.set(url, result);
        })
      );
    }

    await Promise.all(tests);
    return results;
  }

  /**
   * Set the fallback order (priority) for servers
   * @param {string[]} urls - URLs in priority order
   */
  setFallbackOrder(urls) {
    urls.forEach((url, index) => {
      const normalizedUrl = this.#normalizeUrl(url);
      const server = this.#servers.get(normalizedUrl);
      if (server) {
        server.priority = index + 1;
      }
    });
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks() {
    if (this.#healthCheckTimer) {
      return;
    }

    const check = async () => {
      await this.testAllServers();
    };

    this.#healthCheckTimer = setInterval(check, this.#options.healthCheckInterval);
    check(); // Run immediately
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks() {
    if (this.#healthCheckTimer) {
      clearInterval(this.#healthCheckTimer);
      this.#healthCheckTimer = null;
    }
  }

  /**
   * Get pool statistics
   * @returns {Object} Pool stats
   */
  getStats() {
    const servers = this.getAllServers();
    const healthy = this.getHealthyServers();
    
    return {
      total: servers.length,
      healthy: healthy.length,
      unhealthy: servers.length - healthy.length,
      avgLatency: healthy.length > 0
        ? Math.round(healthy.reduce((sum, s) => sum + (s.latency === Infinity ? 0 : s.latency), 0) / healthy.length)
        : 0,
      strategy: this.#options.strategy
    };
  }

  /**
   * Select fastest server
   * @param {ServerInfo[]} servers - Servers to select from
   * @returns {ServerInfo} Fastest server
   */
  #selectFastest(servers) {
    return servers.reduce((best, server) => {
      if (server.latency < best.latency) {
        return server;
      }
      if (server.latency === best.latency && server.priority < best.priority) {
        return server;
      }
      return best;
    });
  }

  /**
   * Select server using round-robin
   * @param {ServerInfo[]} servers - Servers to select from
   * @returns {ServerInfo} Next server in rotation
   */
  #selectRoundRobin(servers) {
    const index = this.#roundRobinIndex % servers.length;
    this.#roundRobinIndex++;
    return servers[index];
  }

  /**
   * Select server by priority
   * @param {ServerInfo[]} servers - Servers to select from
   * @returns {ServerInfo} Highest priority server
   */
  #selectByPriority(servers) {
    return servers.reduce((best, server) => 
      server.priority < best.priority ? server : best
    );
  }

  /**
   * Normalize server URL
   * @param {string} url - URL to normalize
   * @returns {string} Normalized URL
   */
  #normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      // Remove trailing slash for consistency
      return parsed.origin + parsed.pathname.replace(/\/+$/, '');
    } catch {
      return url.replace(/\/+$/, '');
    }
  }
}

export default ServerPool;
