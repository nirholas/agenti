/**
 * OpenBare Registry Discovery
 * Auto-discover and populate servers from registry
 */

/**
 * @typedef {Object} RegistryNode
 * @property {string} url - Node URL
 * @property {string} [name] - Node name
 * @property {string} [region] - Geographic region
 * @property {string} [operator] - Node operator
 * @property {boolean} [verified] - Whether node is verified
 * @property {string[]} [features] - Supported features
 * @property {number} [uptime] - Uptime percentage
 */

/**
 * @typedef {Object} DiscoveryOptions
 * @property {string} [registryUrl] - Registry URL
 * @property {number} [refreshInterval=300000] - Refresh interval in ms (default 5 min)
 * @property {boolean} [autoRefresh=false] - Enable automatic refresh
 * @property {string} [region] - Filter by region
 * @property {boolean} [verifiedOnly=false] - Only include verified nodes
 */

/**
 * Registry discovery for OpenBare servers
 */
export class Discovery {
  /** @type {string} */
  #registryUrl;
  
  /** @type {RegistryNode[]} */
  #nodes = [];
  
  /** @type {number} */
  #lastFetch = 0;
  
  /** @type {NodeJS.Timeout|number|null} */
  #refreshTimer = null;
  
  /** @type {DiscoveryOptions} */
  #options;
  
  /** @type {Set<(nodes: RegistryNode[]) => void>} */
  #listeners = new Set();

  /**
   * Create discovery instance
   * @param {DiscoveryOptions} [options={}] - Discovery options
   */
  constructor(options = {}) {
    this.#options = {
      registryUrl: options.registryUrl || 'https://registry.openbare.org/api/v1/nodes',
      refreshInterval: options.refreshInterval || 300000,
      autoRefresh: options.autoRefresh || false,
      region: options.region || null,
      verifiedOnly: options.verifiedOnly || false
    };
    
    this.#registryUrl = this.#options.registryUrl;
    
    if (this.#options.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  /**
   * Fetch nodes from registry
   * @param {Object} [filters={}] - Additional filters
   * @returns {Promise<RegistryNode[]>} List of nodes
   */
  async fetchNodes(filters = {}) {
    try {
      const url = new URL(this.#registryUrl);
      
      // Apply filters as query params
      if (this.#options.region || filters.region) {
        url.searchParams.set('region', filters.region || this.#options.region);
      }
      if (this.#options.verifiedOnly || filters.verifiedOnly) {
        url.searchParams.set('verified', 'true');
      }
      if (filters.features) {
        url.searchParams.set('features', filters.features.join(','));
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Registry returned ${response.status}`);
      }

      const data = await response.json();
      
      // Handle different response formats
      let nodes = Array.isArray(data) ? data : (data.nodes || data.servers || []);
      
      // Validate and normalize nodes
      this.#nodes = nodes
        .filter(node => this.#isValidNode(node))
        .map(node => this.#normalizeNode(node));
      
      this.#lastFetch = Date.now();
      this.#notifyListeners();
      
      return this.#nodes;
    } catch (error) {
      console.error('Failed to fetch nodes from registry:', error);
      throw new DiscoveryError(`Failed to fetch nodes: ${error.message}`, 'FETCH_ERROR');
    }
  }

  /**
   * Get cached nodes (fetches if cache is empty)
   * @returns {Promise<RegistryNode[]>} List of nodes
   */
  async getNodes() {
    if (this.#nodes.length === 0) {
      await this.fetchNodes();
    }
    return [...this.#nodes];
  }

  /**
   * Get nodes filtered by region
   * @param {string} region - Region to filter by
   * @returns {RegistryNode[]} Filtered nodes
   */
  getNodesByRegion(region) {
    return this.#nodes.filter(node => 
      node.region && node.region.toLowerCase() === region.toLowerCase()
    );
  }

  /**
   * Get only verified nodes
   * @returns {RegistryNode[]} Verified nodes
   */
  getVerifiedNodes() {
    return this.#nodes.filter(node => node.verified);
  }

  /**
   * Get nodes with specific features
   * @param {string[]} features - Required features
   * @returns {RegistryNode[]} Nodes with features
   */
  getNodesWithFeatures(features) {
    return this.#nodes.filter(node => {
      if (!node.features) {
        return false;
      }
      return features.every(f => node.features.includes(f));
    });
  }

  /**
   * Get server URLs only
   * @returns {string[]} Server URLs
   */
  getServerUrls() {
    return this.#nodes.map(node => node.url);
  }

  /**
   * Start automatic refresh
   */
  startAutoRefresh() {
    if (this.#refreshTimer) {
      return;
    }

    const refresh = async () => {
      try {
        await this.fetchNodes();
      } catch (error) {
        // Silently fail, keep using cached nodes
        console.warn('Auto-refresh failed:', error.message);
      }
    };

    this.#refreshTimer = setInterval(refresh, this.#options.refreshInterval);
  }

  /**
   * Stop automatic refresh
   */
  stopAutoRefresh() {
    if (this.#refreshTimer) {
      clearInterval(this.#refreshTimer);
      this.#refreshTimer = null;
    }
  }

  /**
   * Add listener for node updates
   * @param {(nodes: RegistryNode[]) => void} callback - Callback function
   * @returns {() => void} Unsubscribe function
   */
  onUpdate(callback) {
    this.#listeners.add(callback);
    return () => this.#listeners.delete(callback);
  }

  /**
   * Get time since last fetch
   * @returns {number} Milliseconds since last fetch
   */
  getTimeSinceLastFetch() {
    if (this.#lastFetch === 0) {
      return Infinity;
    }
    return Date.now() - this.#lastFetch;
  }

  /**
   * Check if cache is stale
   * @param {number} [maxAge] - Max age in ms (default: refreshInterval)
   * @returns {boolean} Whether cache is stale
   */
  isCacheStale(maxAge) {
    const threshold = maxAge || this.#options.refreshInterval;
    return this.getTimeSinceLastFetch() > threshold;
  }

  /**
   * Clear cached nodes
   */
  clearCache() {
    this.#nodes = [];
    this.#lastFetch = 0;
  }

  /**
   * Set registry URL
   * @param {string} url - New registry URL
   */
  setRegistryUrl(url) {
    this.#registryUrl = url;
    this.clearCache();
  }

  /**
   * Validate node object
   * @param {any} node - Node to validate
   * @returns {boolean} Whether node is valid
   */
  #isValidNode(node) {
    if (!node || typeof node !== 'object') {
      return false;
    }
    if (!node.url || typeof node.url !== 'string') {
      return false;
    }
    
    try {
      new URL(node.url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize node object
   * @param {any} node - Node to normalize
   * @returns {RegistryNode} Normalized node
   */
  #normalizeNode(node) {
    return {
      url: node.url,
      name: node.name || null,
      region: node.region || null,
      operator: node.operator || null,
      verified: Boolean(node.verified),
      features: Array.isArray(node.features) ? node.features : [],
      uptime: typeof node.uptime === 'number' ? node.uptime : null
    };
  }

  /**
   * Notify all listeners of node update
   */
  #notifyListeners() {
    const nodes = [...this.#nodes];
    for (const listener of this.#listeners) {
      try {
        listener(nodes);
      } catch (error) {
        console.error('Listener error:', error);
      }
    }
  }
}

/**
 * Discovery error class
 */
export class DiscoveryError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code
   */
  constructor(message, code) {
    super(message);
    this.name = 'DiscoveryError';
    this.code = code;
  }
}

/**
 * Create a discovery instance with common registries
 * @param {Object} [options={}] - Options
 * @returns {Discovery} Discovery instance
 */
export function createDiscovery(options = {}) {
  return new Discovery(options);
}

/**
 * Known public registries
 */
export const KNOWN_REGISTRIES = {
  default: 'https://registry.openbare.org/api/v1/nodes',
  community: 'https://community.openbare.org/nodes.json',
  backup: 'https://backup.openbare.org/api/nodes'
};

export default Discovery;
