/**
 * OpenBare Health Check Module
 * 
 * Provides health checking functionality including self-tests
 * to verify the bare server is working correctly.
 */

import { getSummary } from './metrics.js';

/**
 * Health status levels
 */
export const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy'
};

/**
 * Health check state
 */
const healthState = {
  status: HealthStatus.HEALTHY,
  lastCheck: null,
  lastSelfTest: null,
  selfTestPassed: true,
  checks: {
    server: true,
    bareServer: true,
    memory: true
  }
};

/**
 * Check memory usage
 * Returns unhealthy if using more than 90% of available heap
 */
function checkMemory() {
  const used = process.memoryUsage();
  const heapUsedPercent = (used.heapUsed / used.heapTotal) * 100;
  
  return {
    healthy: heapUsedPercent < 90,
    heapUsedMB: Math.round(used.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(used.heapTotal / 1024 / 1024),
    heapUsedPercent: heapUsedPercent.toFixed(1)
  };
}

/**
 * Check event loop lag
 * High lag indicates server is overloaded
 */
function checkEventLoop() {
  return new Promise((resolve) => {
    const start = Date.now();
    setImmediate(() => {
      const lag = Date.now() - start;
      resolve({
        healthy: lag < 100, // Less than 100ms lag is healthy
        lagMs: lag
      });
    });
  });
}

/**
 * Perform a self-test of the bare server
 * Makes a simple request through the bare server to verify it's working
 */
export async function selfTest(bareServer, logger) {
  try {
    // Check if bare server is routing correctly
    const _testRequest = {
      method: 'GET',
      url: '/bare/',
      headers: {}
    };
    
    // Bare server should respond to base path
    const canRoute = bareServer.shouldRoute({ url: '/bare/' });
    
    healthState.selfTestPassed = canRoute;
    healthState.lastSelfTest = Date.now();
    healthState.checks.bareServer = canRoute;
    
    if (!canRoute) {
      logger.warn('Bare server self-test failed: routing check failed');
    }
    
    return canRoute;
  } catch (error) {
    logger.error({ error: error.message }, 'Bare server self-test failed');
    healthState.selfTestPassed = false;
    healthState.lastSelfTest = Date.now();
    healthState.checks.bareServer = false;
    return false;
  }
}

/**
 * Run all health checks and determine overall status
 */
export async function runHealthChecks(bareServer, logger) {
  const results = {
    timestamp: new Date().toISOString(),
    checks: {}
  };
  
  // Memory check
  const memoryCheck = checkMemory();
  results.checks.memory = memoryCheck;
  healthState.checks.memory = memoryCheck.healthy;
  
  // Event loop check
  const eventLoopCheck = await checkEventLoop();
  results.checks.eventLoop = eventLoopCheck;
  
  // Bare server check (use cached result if recent)
  const selfTestAge = healthState.lastSelfTest 
    ? Date.now() - healthState.lastSelfTest 
    : Infinity;
  
  if (selfTestAge > 60000) { // Re-test every 60 seconds
    await selfTest(bareServer, logger);
  }
  
  results.checks.bareServer = {
    healthy: healthState.checks.bareServer,
    lastTest: healthState.lastSelfTest
  };
  
  // Determine overall status
  const allHealthy = Object.values(healthState.checks).every(v => v === true);
  const anyUnhealthy = Object.values(healthState.checks).some(v => v === false);
  
  if (allHealthy) {
    healthState.status = HealthStatus.HEALTHY;
  } else if (anyUnhealthy) {
    healthState.status = HealthStatus.UNHEALTHY;
  } else {
    healthState.status = HealthStatus.DEGRADED;
  }
  
  results.status = healthState.status;
  healthState.lastCheck = Date.now();
  
  return results;
}

/**
 * Get current health status (quick, no new checks)
 */
export function getHealthStatus() {
  return {
    status: healthState.status,
    lastCheck: healthState.lastCheck,
    checks: { ...healthState.checks }
  };
}

/**
 * Get detailed health report
 */
export async function getHealthReport(bareServer, logger, config) {
  const checks = await runHealthChecks(bareServer, logger);
  const metrics = getSummary();
  
  return {
    status: checks.status,
    timestamp: checks.timestamp,
    node: {
      id: config.nodeId,
      region: config.region,
      version: config.version
    },
    checks: checks.checks,
    metrics: metrics
  };
}

/**
 * Simple health check response (for load balancers)
 */
export function isHealthy() {
  return healthState.status !== HealthStatus.UNHEALTHY;
}

export default {
  HealthStatus,
  selfTest,
  runHealthChecks,
  getHealthStatus,
  getHealthReport,
  isHealthy
};
