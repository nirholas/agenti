/**
 * OpenBare Server
 * 
 * A decentralized, censorship-resistant web proxy server.
 * Part of the OpenBare network - enabling free access to the open web.
 * 
 * Features:
 * - TompHTTP Bare Server protocol for Ultraviolet compatibility
 * - Health monitoring and metrics
 * - Rate limiting
 * - Optional registry integration
 * - Production-ready logging
 */

import { createServer } from 'node:http';
import { createBareServer } from '@tomphttp/bare-server-node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';

import { config, validateConfig } from './config.js';
import { 
  recordRequest, 
  recordResponse, 
  recordError, 
  connectionOpened, 
  connectionClosed,
  getMetrics,
  getSummary 
} from './metrics.js';
import { 
  getHealthReport, 
  getHealthStatus, 
  isHealthy, 
  selfTest 
} from './health.js';
import { 
  initRegistry, 
  unregisterNode, 
  stopHeartbeat,
  getRegistrationState 
} from './register.js';

// ============================================================================
// LOGGER SETUP
// ============================================================================

const logger = pino({
  level: config.logging.level,
  ...(config.logging.pretty && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard'
      }
    }
  })
});

// ============================================================================
// BARE SERVER SETUP
// ============================================================================

const bareServer = createBareServer(config.bare.path, {
  maintainer: config.bare.maintainer,
  logErrors: config.isDev
});

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security headers (relaxed for proxy functionality)
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// CORS - allow all origins for proxy to work
app.use(cors({
  origin: config.cors.origin,
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  exposedHeaders: config.cors.exposedHeaders,
  credentials: config.cors.credentials
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: config.rateLimit.message,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Don't rate limit health checks
    return req.path === '/' || req.path === '/status' || req.path === '/health';
  }
});

app.use(limiter);

// Request logging and metrics middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  recordRequest(req.method);
  connectionOpened();
  
  res.on('finish', () => {
    const latency = Date.now() - startTime;
    recordResponse(res.statusCode, latency);
    connectionClosed();
    
    // Log request (skip health checks in production)
    if (config.isDev || (req.path !== '/' && req.path !== '/health')) {
      logger.info({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        latency: `${latency}ms`,
        ip: req.ip
      }, 'request');
    }
  });
  
  res.on('error', (err) => {
    recordError(err.code || 'response_error');
  });
  
  next();
});

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Root endpoint - Basic server info and health status
 * Used by clients to verify server is running and healthy
 */
app.get('/', async (req, res) => {
  const summary = getSummary();
  
  res.json({
    status: 'ok',
    name: 'OpenBare Server',
    version: config.version,
    node_id: config.nodeId,
    region: config.region,
    uptime_seconds: summary.uptime_seconds,
    requests_served: summary.requests_total,
    healthy: isHealthy(),
    bare_endpoint: config.bare.path,
    documentation: 'https://github.com/nirholas/openbare'
  });
});

/**
 * Health endpoint - Detailed health check
 * Used by load balancers and monitoring systems
 */
app.get('/health', async (req, res) => {
  const report = await getHealthReport(bareServer, logger, config);
  const statusCode = report.status === 'healthy' ? 200 : 
    report.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json(report);
});

/**
 * Status endpoint - Detailed metrics
 * Used for monitoring and debugging
 */
app.get('/status', (req, res) => {
  const metrics = getMetrics();
  const registration = getRegistrationState();
  
  res.json({
    node: {
      id: config.nodeId,
      region: config.region,
      version: config.version,
      url: config.nodeUrl || null
    },
    metrics: metrics,
    health: getHealthStatus(),
    registration: registration,
    config: {
      rate_limit: `${config.rateLimit.max} req/${config.rateLimit.windowMs/1000}s`,
      registry_url: config.registry.url || null
    }
  });
});

/**
 * Info endpoint - Node information
 * Used by registry and network discovery
 */
app.get('/info', (req, res) => {
  res.json({
    node_id: config.nodeId,
    region: config.region,
    owner: config.ownerContact || null,
    version: config.version,
    capabilities: ['bare-v3', 'websocket'],
    bare_path: config.bare.path,
    url: config.nodeUrl || null
  });
});

/**
 * Error handler
 */
app.use((err, req, res, _next) => {
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
  recordError('unhandled_error');
  
  res.status(500).json({
    error: 'Internal server error',
    message: config.isDev ? err.message : undefined
  });
});

// ============================================================================
// HTTP SERVER SETUP
// ============================================================================

const httpServer = createServer();

// Route requests to bare server or express
httpServer.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

// Handle WebSocket upgrades for bare server
httpServer.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown...');
  
  // Stop accepting new connections
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Unregister from registry
  await unregisterNode(config, logger);
  stopHeartbeat();
  
  // Close bare server
  bareServer.close();
  
  // Give ongoing requests time to complete
  setTimeout(() => {
    logger.info('Shutdown complete');
    process.exit(0);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================================================
// SERVER START
// ============================================================================

async function start() {
  // Validate configuration
  validateConfig(logger);
  
  // Run initial self-test
  await selfTest(bareServer, logger);
  
  // Start HTTP server
  httpServer.listen(config.port, config.host, async () => {
    logger.info({
      port: config.port,
      host: config.host,
      nodeId: config.nodeId,
      region: config.region,
      bareEndpoint: `http://${config.host}:${config.port}${config.bare.path}`
    }, '🚀 OpenBare server started');
    
    // Initialize registry (if configured)
    await initRegistry(config, logger);
    
    logger.info({
      endpoints: {
        info: `http://localhost:${config.port}/`,
        status: `http://localhost:${config.port}/status`,
        health: `http://localhost:${config.port}/health`,
        bare: `http://localhost:${config.port}${config.bare.path}`
      }
    }, 'Available endpoints');
  });
}

start().catch((error) => {
  logger.fatal({ error: error.message }, 'Failed to start server');
  process.exit(1);
});
