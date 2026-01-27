/**
 * OpenBare Registry - Main Server
 * A directory service for community bare server nodes
 */

const express = require('express');
const cors = require('cors');
const db = require('./db');
const healthChecker = require('./health-checker');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Middleware
// ============================================

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Cache control for public endpoints
const cacheControl = (seconds) => (req, res, next) => {
  res.set('Cache-Control', `public, max-age=${seconds}`);
  next();
};

// Get client IP for rate limiting
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.ip ||
           'unknown';
};

// ============================================
// Validation Helpers
// ============================================

const VALID_REGIONS = [
  'us-east', 'us-west', 'us-central',
  'eu-west', 'eu-central', 'eu-east',
  'asia-east', 'asia-southeast', 'asia-south',
  'australia', 'south-america', 'africa',
  'other'
];

/**
 * Validate URL format and protocol
 */
function validateUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol' };
    }
    // Don't allow localhost or private IPs in production
    const hostname = parsed.hostname.toLowerCase();
    if (process.env.NODE_ENV === 'production') {
      if (hostname === 'localhost' || 
                hostname === '127.0.0.1' ||
                hostname.startsWith('192.168.') ||
                hostname.startsWith('10.') ||
                hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
        return { valid: false, error: 'Private/local URLs not allowed' };
      }
    }
    return { valid: true, url: parsed.origin };
  } catch (_e) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate registration data
 */
function validateRegistration(data) {
  const errors = [];
    
  if (!data.url) {
    errors.push('URL is required');
  } else {
    const urlValidation = validateUrl(data.url);
    if (!urlValidation.valid) {
      errors.push(urlValidation.error);
    }
  }
    
  if (!data.region) {
    errors.push('Region is required');
  } else if (!VALID_REGIONS.includes(data.region)) {
    errors.push(`Invalid region. Valid regions: ${VALID_REGIONS.join(', ')}`);
  }
    
  if (!data.owner) {
    errors.push('Owner name is required');
  } else if (data.owner.length < 2 || data.owner.length > 100) {
    errors.push('Owner name must be 2-100 characters');
  }
    
  if (data.contact && data.contact.length > 200) {
    errors.push('Contact must be under 200 characters');
  }
    
  return errors;
}

// ============================================
// API Routes
// ============================================

/**
 * GET / - API info
 */
app.get('/', (req, res) => {
  res.json({
    name: 'OpenBare Registry',
    version: '1.0.0',
    description: 'Directory of community bare server nodes',
    endpoints: {
      'GET /nodes': 'List healthy nodes (query: ?region=)',
      'GET /nodes/random': 'Get random healthy node (query: ?region=)',
      'GET /nodes/fastest': 'Get nodes sorted by latency (query: ?limit=)',
      'POST /nodes/register': 'Register a new node',
      'DELETE /nodes/:id': 'Unregister a node',
      'POST /nodes/:id/heartbeat': 'Send heartbeat',
      'GET /stats': 'Network statistics',
      'GET /regions': 'List valid regions'
    }
  });
});

/**
 * GET /regions - List valid regions
 */
app.get('/regions', cacheControl(3600), (req, res) => {
  res.json({ regions: VALID_REGIONS });
});

/**
 * POST /nodes/register - Register a new node
 */
app.post('/nodes/register', (req, res) => {
  try {
    const clientIp = getClientIp(req);
        
    // Rate limiting: 5 registrations per hour per IP
    if (!db.checkRateLimit(clientIp, 5, 60)) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many registration attempts. Please try again later.'
      });
    }
        
    // Validate input
    const errors = validateRegistration(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
        
    // Normalize URL
    const urlValidation = validateUrl(req.body.url);
    const normalizedUrl = urlValidation.url;
        
    // Check for duplicate
    const existing = db.getNodeByUrl(normalizedUrl);
    if (existing) {
      return res.status(409).json({
        error: 'Duplicate URL',
        message: 'This URL is already registered',
        nodeId: existing.id
      });
    }
        
    // Register node
    const nodeId = db.registerNode({
      url: normalizedUrl,
      region: req.body.region,
      owner: req.body.owner.trim(),
      contact: req.body.contact?.trim()
    });
        
    console.log(`[Registry] New node registered: ${normalizedUrl} (ID: ${nodeId})`);
        
    res.status(201).json({
      success: true,
      message: 'Node registered successfully',
      nodeId,
      status: 'pending',
      note: 'Your node will be marked as healthy after passing health checks. Send heartbeats to stay active.'
    });
        
  } catch (error) {
    console.error('[Registry] Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /nodes/:id - Unregister a node
 */
app.delete('/nodes/:id', (req, res) => {
  try {
    const nodeId = parseInt(req.params.id, 10);
        
    if (isNaN(nodeId)) {
      return res.status(400).json({ error: 'Invalid node ID' });
    }
        
    const node = db.getNodeById(nodeId);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
        
    const deleted = db.deleteNode(nodeId);
        
    if (deleted) {
      console.log(`[Registry] Node unregistered: ${node.url} (ID: ${nodeId})`);
      res.json({ success: true, message: 'Node unregistered successfully' });
    } else {
      res.status(500).json({ error: 'Failed to unregister node' });
    }
        
  } catch (error) {
    console.error('[Registry] Unregister error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /nodes - List all healthy nodes
 */
app.get('/nodes', cacheControl(10), (req, res) => {
  try {
    const region = req.query.region;
        
    if (region && !VALID_REGIONS.includes(region)) {
      return res.status(400).json({
        error: 'Invalid region',
        validRegions: VALID_REGIONS
      });
    }
        
    const nodes = db.getHealthyNodes(region);
        
    res.json({
      count: nodes.length,
      region: region || 'all',
      nodes
    });
        
  } catch (error) {
    console.error('[Registry] List nodes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /nodes/random - Get a random healthy node
 */
app.get('/nodes/random', cacheControl(5), (req, res) => {
  try {
    const region = req.query.region;
        
    if (region && !VALID_REGIONS.includes(region)) {
      return res.status(400).json({
        error: 'Invalid region',
        validRegions: VALID_REGIONS
      });
    }
        
    const node = db.getRandomHealthyNode(region);
        
    if (!node) {
      return res.status(404).json({
        error: 'No healthy nodes available',
        region: region || 'all'
      });
    }
        
    res.json(node);
        
  } catch (error) {
    console.error('[Registry] Random node error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /nodes/fastest - Get nodes sorted by latency
 */
app.get('/nodes/fastest', cacheControl(10), (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const nodes = db.getNodesByLatency(limit);
        
    res.json({
      count: nodes.length,
      nodes
    });
        
  } catch (error) {
    console.error('[Registry] Fastest nodes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /nodes/:id/heartbeat - Node heartbeat
 */
app.post('/nodes/:id/heartbeat', (req, res) => {
  try {
    const nodeId = parseInt(req.params.id, 10);
        
    if (isNaN(nodeId)) {
      return res.status(400).json({ error: 'Invalid node ID' });
    }
        
    const node = db.getNodeById(nodeId);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
        
    const updated = db.updateHeartbeat(nodeId);
        
    if (updated) {
      res.json({
        success: true,
        message: 'Heartbeat received',
        status: node.status
      });
    } else {
      res.status(500).json({ error: 'Failed to update heartbeat' });
    }
        
  } catch (error) {
    console.error('[Registry] Heartbeat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /stats - Network statistics
 */
app.get('/stats', cacheControl(30), (req, res) => {
  try {
    const stats = db.getNetworkStats();
        
    res.json({
      timestamp: new Date().toISOString(),
      ...stats
    });
        
  } catch (error) {
    console.error('[Registry] Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Health check endpoint for the registry itself
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// Error Handling
// ============================================

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, _next) => {
  console.error('[Registry] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// Server Startup
// ============================================

function start() {
  // Initialize database
  db.initialize();
    
  // Start health checker background job
  healthChecker.start();
    
  // Start HTTP server
  const server = app.listen(PORT, () => {
    console.log(`[Registry] OpenBare Registry running on port ${PORT}`);
    console.log(`[Registry] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
    
  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Registry] Shutting down...');
    healthChecker.stop();
    db.close();
    server.close(() => {
      console.log('[Registry] Goodbye!');
      process.exit(0);
    });
  };
    
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
    
  return server;
}

// Start server if run directly
if (require.main === module) {
  start();
}

module.exports = { app, start };
