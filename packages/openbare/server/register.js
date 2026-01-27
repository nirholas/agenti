/**
 * OpenBare Registry Client
 * 
 * Handles registration with the OpenBare registry service.
 * Sends heartbeats to maintain active status in the network.
 */

import { getSummary } from './metrics.js';
import { isHealthy } from './health.js';

/**
 * Registry client state
 */
const state = {
  registered: false,
  registrationId: null,
  heartbeatInterval: null,
  lastHeartbeat: null,
  lastHeartbeatSuccess: false,
  failures: 0
};

/**
 * Register this node with the registry
 */
export async function registerNode(config, logger) {
  if (!config.registry.url) {
    logger.debug('No registry URL configured, skipping registration');
    return false;
  }
  
  if (!config.nodeUrl) {
    logger.warn('NODE_URL not set, cannot register with registry');
    return false;
  }
  
  const registryUrl = config.registry.url.replace(/\/$/, '');
  
  try {
    logger.info({ registry: registryUrl }, 'Registering with OpenBare registry...');
    
    const response = await fetch(`${registryUrl}/nodes/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: config.nodeUrl,
        nodeId: config.nodeId,
        region: config.region,
        owner: config.ownerContact,
        version: config.version,
        capabilities: ['bare-v3', 'websocket']
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Registry returned ${response.status}: ${error}`);
    }
    
    const data = await response.json();
    
    state.registered = true;
    state.registrationId = data.id || config.nodeId;
    state.failures = 0;
    
    logger.info({ 
      registrationId: state.registrationId,
      registry: registryUrl 
    }, 'Successfully registered with registry');
    
    return true;
  } catch (error) {
    state.failures++;
    logger.error({ 
      error: error.message,
      registry: registryUrl,
      failures: state.failures
    }, 'Failed to register with registry');
    
    return false;
  }
}

/**
 * Send heartbeat to registry
 */
export async function sendHeartbeat(config, logger) {
  if (!config.registry.url || !state.registered) {
    return false;
  }
  
  const registryUrl = config.registry.url.replace(/\/$/, '');
  const nodeId = state.registrationId || config.nodeId;
  
  try {
    const metrics = getSummary();
    const healthy = isHealthy();
    
    const response = await fetch(`${registryUrl}/nodes/${nodeId}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: healthy ? 'healthy' : 'unhealthy',
        metrics: metrics,
        timestamp: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      throw new Error(`Registry returned ${response.status}`);
    }
    
    state.lastHeartbeat = Date.now();
    state.lastHeartbeatSuccess = true;
    state.failures = 0;
    
    logger.debug({ nodeId }, 'Heartbeat sent successfully');
    
    return true;
  } catch (error) {
    state.failures++;
    state.lastHeartbeatSuccess = false;
    
    logger.warn({ 
      error: error.message,
      failures: state.failures
    }, 'Failed to send heartbeat');
    
    // If too many failures, try to re-register
    if (state.failures >= 5) {
      logger.info('Too many heartbeat failures, attempting re-registration');
      state.registered = false;
      await registerNode(config, logger);
    }
    
    return false;
  }
}

/**
 * Unregister from registry (on shutdown)
 */
export async function unregisterNode(config, logger) {
  if (!config.registry.url || !state.registered) {
    return false;
  }
  
  const registryUrl = config.registry.url.replace(/\/$/, '');
  const nodeId = state.registrationId || config.nodeId;
  
  try {
    logger.info({ nodeId }, 'Unregistering from registry...');
    
    const response = await fetch(`${registryUrl}/nodes/${nodeId}`, {
      method: 'DELETE'
    });
    
    state.registered = false;
    state.registrationId = null;
    
    if (response.ok) {
      logger.info('Successfully unregistered from registry');
      return true;
    }
    
    return false;
  } catch (error) {
    logger.warn({ error: error.message }, 'Failed to unregister from registry');
    return false;
  }
}

/**
 * Start heartbeat interval
 */
export function startHeartbeat(config, logger) {
  if (state.heartbeatInterval) {
    return; // Already running
  }
  
  const interval = config.registry.heartbeatInterval || 30000;
  
  state.heartbeatInterval = setInterval(async () => {
    await sendHeartbeat(config, logger);
  }, interval);
  
  logger.info({ intervalMs: interval }, 'Heartbeat interval started');
}

/**
 * Stop heartbeat interval
 */
export function stopHeartbeat() {
  if (state.heartbeatInterval) {
    clearInterval(state.heartbeatInterval);
    state.heartbeatInterval = null;
  }
}

/**
 * Get registration state
 */
export function getRegistrationState() {
  return {
    registered: state.registered,
    registrationId: state.registrationId,
    lastHeartbeat: state.lastHeartbeat,
    lastHeartbeatSuccess: state.lastHeartbeatSuccess,
    failures: state.failures
  };
}

/**
 * Initialize registry client
 */
export async function initRegistry(config, logger) {
  if (!config.registry.url) {
    logger.info('Registry URL not configured, running in standalone mode');
    return false;
  }
  
  // Register with retry
  let registered = await registerNode(config, logger);
  
  if (!registered) {
    // Retry after 5 seconds
    logger.info('Will retry registration in 5 seconds...');
    setTimeout(async () => {
      registered = await registerNode(config, logger);
      if (registered) {
        startHeartbeat(config, logger);
      }
    }, 5000);
  } else {
    startHeartbeat(config, logger);
  }
  
  return registered;
}

export default {
  registerNode,
  sendHeartbeat,
  unregisterNode,
  startHeartbeat,
  stopHeartbeat,
  getRegistrationState,
  initRegistry
};
