/**
 * OpenBare Metrics Module
 * 
 * Simple in-memory metrics collection for monitoring server performance.
 * Tracks requests, errors, bandwidth, and connection statistics.
 */

/**
 * Metrics store - all counters and gauges
 */
const metrics = {
  // Counters (always increasing)
  requests: {
    total: 0,
    successful: 0,
    failed: 0,
    byMethod: {
      GET: 0,
      POST: 0,
      PUT: 0,
      DELETE: 0,
      OPTIONS: 0,
      HEAD: 0,
      PATCH: 0,
      OTHER: 0
    },
    byStatus: {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0
    }
  },
  
  // Bandwidth
  bytes: {
    received: 0,
    sent: 0
  },
  
  // Errors
  errors: {
    total: 0,
    byType: {}
  },
  
  // Gauges (current values)
  connections: {
    active: 0,
    peak: 0
  },
  
  // Timing
  latency: {
    total: 0,
    count: 0,
    min: Infinity,
    max: 0
  },
  
  // Per-minute tracking (sliding window)
  perMinute: {
    requests: [],
    windowSize: 60 // Keep last 60 data points (1 per second for 1 minute)
  },
  
  // Server start time
  startedAt: Date.now()
};

/**
 * Increment request counter
 */
export function recordRequest(method = 'GET') {
  metrics.requests.total++;
  
  const upperMethod = method.toUpperCase();
  if (metrics.requests.byMethod.hasOwnProperty(upperMethod)) {
    metrics.requests.byMethod[upperMethod]++;
  } else {
    metrics.requests.byMethod.OTHER++;
  }
  
  // Add to per-second counter
  const now = Math.floor(Date.now() / 1000);
  const lastEntry = metrics.perMinute.requests[metrics.perMinute.requests.length - 1];
  
  if (lastEntry && lastEntry.timestamp === now) {
    lastEntry.count++;
  } else {
    metrics.perMinute.requests.push({ timestamp: now, count: 1 });
    // Keep only last windowSize entries
    if (metrics.perMinute.requests.length > metrics.perMinute.windowSize) {
      metrics.perMinute.requests.shift();
    }
  }
}

/**
 * Record response status
 */
export function recordResponse(statusCode, latencyMs = 0) {
  if (statusCode >= 200 && statusCode < 300) {
    metrics.requests.successful++;
    metrics.requests.byStatus['2xx']++;
  } else if (statusCode >= 300 && statusCode < 400) {
    metrics.requests.byStatus['3xx']++;
  } else if (statusCode >= 400 && statusCode < 500) {
    metrics.requests.byStatus['4xx']++;
    metrics.requests.failed++;
  } else if (statusCode >= 500) {
    metrics.requests.byStatus['5xx']++;
    metrics.requests.failed++;
  }
  
  // Record latency
  if (latencyMs > 0) {
    metrics.latency.total += latencyMs;
    metrics.latency.count++;
    metrics.latency.min = Math.min(metrics.latency.min, latencyMs);
    metrics.latency.max = Math.max(metrics.latency.max, latencyMs);
  }
}

/**
 * Record bytes transferred
 */
export function recordBytes(received = 0, sent = 0) {
  metrics.bytes.received += received;
  metrics.bytes.sent += sent;
}

/**
 * Record an error
 */
export function recordError(errorType = 'unknown') {
  metrics.errors.total++;
  metrics.errors.byType[errorType] = (metrics.errors.byType[errorType] || 0) + 1;
}

/**
 * Track active connections
 */
export function connectionOpened() {
  metrics.connections.active++;
  metrics.connections.peak = Math.max(metrics.connections.peak, metrics.connections.active);
}

export function connectionClosed() {
  metrics.connections.active = Math.max(0, metrics.connections.active - 1);
}

/**
 * Calculate requests per minute from sliding window
 */
function getRequestsPerMinute() {
  const now = Math.floor(Date.now() / 1000);
  const oneMinuteAgo = now - 60;
  
  return metrics.perMinute.requests
    .filter(entry => entry.timestamp >= oneMinuteAgo)
    .reduce((sum, entry) => sum + entry.count, 0);
}

/**
 * Get average latency
 */
function getAverageLatency() {
  if (metrics.latency.count === 0) {
    return 0;
  }
  return Math.round(metrics.latency.total / metrics.latency.count);
}

/**
 * Get uptime in seconds
 */
function getUptime() {
  return Math.floor((Date.now() - metrics.startedAt) / 1000);
}

/**
 * Get all metrics as a snapshot
 */
export function getMetrics() {
  return {
    uptime_seconds: getUptime(),
    requests: {
      total: metrics.requests.total,
      successful: metrics.requests.successful,
      failed: metrics.requests.failed,
      per_minute: getRequestsPerMinute(),
      by_method: { ...metrics.requests.byMethod },
      by_status: { ...metrics.requests.byStatus }
    },
    bytes: {
      received: metrics.bytes.received,
      sent: metrics.bytes.sent,
      total: metrics.bytes.received + metrics.bytes.sent
    },
    errors: {
      total: metrics.errors.total,
      by_type: { ...metrics.errors.byType }
    },
    connections: {
      active: metrics.connections.active,
      peak: metrics.connections.peak
    },
    latency: {
      average_ms: getAverageLatency(),
      min_ms: metrics.latency.min === Infinity ? 0 : metrics.latency.min,
      max_ms: metrics.latency.max
    }
  };
}

/**
 * Get summary metrics (for health checks)
 */
export function getSummary() {
  return {
    uptime_seconds: getUptime(),
    requests_total: metrics.requests.total,
    requests_per_minute: getRequestsPerMinute(),
    active_connections: metrics.connections.active,
    error_rate: metrics.requests.total > 0 
      ? (metrics.requests.failed / metrics.requests.total * 100).toFixed(2) + '%'
      : '0%'
  };
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics() {
  metrics.requests.total = 0;
  metrics.requests.successful = 0;
  metrics.requests.failed = 0;
  Object.keys(metrics.requests.byMethod).forEach(k => metrics.requests.byMethod[k] = 0);
  Object.keys(metrics.requests.byStatus).forEach(k => metrics.requests.byStatus[k] = 0);
  metrics.bytes.received = 0;
  metrics.bytes.sent = 0;
  metrics.errors.total = 0;
  metrics.errors.byType = {};
  metrics.connections.active = 0;
  metrics.connections.peak = 0;
  metrics.latency.total = 0;
  metrics.latency.count = 0;
  metrics.latency.min = Infinity;
  metrics.latency.max = 0;
  metrics.perMinute.requests = [];
  metrics.startedAt = Date.now();
}

export default {
  recordRequest,
  recordResponse,
  recordBytes,
  recordError,
  connectionOpened,
  connectionClosed,
  getMetrics,
  getSummary,
  resetMetrics
};
