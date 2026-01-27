/**
 * OpenBare Registry - Health Checker Module
 * Background job that monitors node health and latency
 */

const cron = require('node-cron');
const db = require('./db');

// Configuration
const CHECK_INTERVAL_SECONDS = 30;
const HEARTBEAT_TIMEOUT_MINUTES = 2;
const STALE_NODE_TIMEOUT_MINUTES = 5;
const HEALTH_CHECK_TIMEOUT_MS = 10000;
// const CLEANUP_INTERVAL_HOURS = 1; // Reserved for future use

let healthCheckTask = null;
let cleanupTask = null;
let isRunning = false;

/**
 * Check if a single node is healthy
 * @param {Object} node - Node object with id and url
 * @returns {Object} - { healthy: boolean, latency: number|null, error: string|null }
 */
async function checkNodeHealth(node) {
  const startTime = Date.now();
    
  try {
    // Validate URL format
    const url = new URL(node.url);
        
    // Make request to node's root or health endpoint
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
        
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'OpenBare-Registry-HealthChecker/1.0'
      }
    });
        
    clearTimeout(timeout);
        
    const latency = Date.now() - startTime;
        
    // Consider 2xx and 3xx as healthy
    // Bare servers typically return 200 or specific bare server responses
    if (response.ok || response.status < 400) {
      return {
        healthy: true,
        latency,
        error: null
      };
    }
        
    return {
      healthy: false,
      latency,
      error: `HTTP ${response.status}: ${response.statusText}`
    };
        
  } catch (error) {
    const latency = Date.now() - startTime;
        
    let errorMessage = 'Unknown error';
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'DNS lookup failed';
    } else if (error.message) {
      errorMessage = error.message;
    }
        
    return {
      healthy: false,
      latency: latency < HEALTH_CHECK_TIMEOUT_MS ? latency : null,
      error: errorMessage
    };
  }
}

/**
 * Run health check on all nodes
 */
async function runHealthChecks() {
  if (isRunning) {
    console.log('[HealthChecker] Previous check still running, skipping...');
    return;
  }
    
  isRunning = true;
  const startTime = Date.now();
    
  try {
    const nodes = db.getNodesForHealthCheck();
    console.log(`[HealthChecker] Checking ${nodes.length} nodes...`);
        
    let healthy = 0;
    let unhealthy = 0;
        
    // Check nodes in parallel with concurrency limit
    const CONCURRENCY = 10;
    const results = [];
        
    for (let i = 0; i < nodes.length; i += CONCURRENCY) {
      const batch = nodes.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (node) => {
          const result = await checkNodeHealth(node);
          return { node, result };
        })
      );
      results.push(...batchResults);
    }
        
    // Update database with results
    for (const { node, result } of results) {
      const status = result.healthy ? 'healthy' : 'unhealthy';
            
      db.updateNodeHealth(node.id, status, result.latency);
      db.recordHealthCheck(
        node.id,
        result.healthy,
        result.latency,
        result.error
      );
            
      if (result.healthy) {
        healthy++;
      } else {
        unhealthy++;
        console.log(`[HealthChecker] Node ${node.id} (${node.url}) unhealthy: ${result.error}`);
      }
    }
        
    const duration = Date.now() - startTime;
    console.log(`[HealthChecker] Check complete: ${healthy} healthy, ${unhealthy} unhealthy (${duration}ms)`);
        
  } catch (error) {
    console.error('[HealthChecker] Error during health check:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Mark nodes without recent heartbeat as unhealthy
 */
function checkHeartbeats() {
  try {
    const marked = db.markUnhealthyNodes(HEARTBEAT_TIMEOUT_MINUTES);
    if (marked > 0) {
      console.log(`[HealthChecker] Marked ${marked} nodes as unhealthy (heartbeat timeout)`);
    }
  } catch (error) {
    console.error('[HealthChecker] Error checking heartbeats:', error);
  }
}

/**
 * Remove nodes that haven't sent heartbeat in too long
 */
function removeStaleNodes() {
  try {
    const removed = db.removeStaleNodes(STALE_NODE_TIMEOUT_MINUTES);
    if (removed > 0) {
      console.log(`[HealthChecker] Removed ${removed} stale nodes`);
    }
  } catch (error) {
    console.error('[HealthChecker] Error removing stale nodes:', error);
  }
}

/**
 * Clean up old health check records
 */
function cleanupOldRecords() {
  try {
    const cleaned = db.cleanOldHealthChecks(7); // Keep 7 days
    if (cleaned > 0) {
      console.log(`[HealthChecker] Cleaned ${cleaned} old health check records`);
    }
  } catch (error) {
    console.error('[HealthChecker] Error cleaning old records:', error);
  }
}

/**
 * Start the health checker background jobs
 */
function start() {
  console.log('[HealthChecker] Starting health checker...');
    
  // Run initial health check
  runHealthChecks();
    
  // Schedule regular health checks (every 30 seconds)
  healthCheckTask = cron.schedule(`*/${CHECK_INTERVAL_SECONDS} * * * * *`, () => {
    checkHeartbeats();
    removeStaleNodes();
    runHealthChecks();
  });
    
  // Schedule cleanup (every hour)
  cleanupTask = cron.schedule('0 * * * *', () => {
    cleanupOldRecords();
  });
    
  console.log(`[HealthChecker] Health checks scheduled every ${CHECK_INTERVAL_SECONDS} seconds`);
}

/**
 * Stop the health checker
 */
function stop() {
  console.log('[HealthChecker] Stopping health checker...');
    
  if (healthCheckTask) {
    healthCheckTask.stop();
    healthCheckTask = null;
  }
    
  if (cleanupTask) {
    cleanupTask.stop();
    cleanupTask = null;
  }
}

/**
 * Run a single health check (for testing/manual use)
 */
async function runOnce() {
  await runHealthChecks();
}

module.exports = {
  start,
  stop,
  runOnce,
  checkNodeHealth
};
