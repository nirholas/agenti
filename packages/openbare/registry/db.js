/**
 * OpenBare Registry - Database Module
 * SQLite database management using better-sqlite3
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'registry.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db = null;

/**
 * Get database instance (singleton)
 */
function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * Initialize database with schema
 */
function initialize() {
  const database = getDb();
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  database.exec(schema);
  console.log('Database initialized successfully');
  return database;
}

/**
 * Close database connection
 */
function close() {
  if (db) {
    db.close();
    db = null;
  }
}

// ============================================
// Node Operations
// ============================================

/**
 * Register a new node
 */
function registerNode({ url, region, owner, contact }) {
  const stmt = getDb().prepare(`
        INSERT INTO nodes (url, region, owner, contact)
        VALUES (?, ?, ?, ?)
    `);
  const result = stmt.run(url, region, owner, contact || null);
  return result.lastInsertRowid;
}

/**
 * Get node by ID
 */
function getNodeById(id) {
  const stmt = getDb().prepare('SELECT * FROM nodes WHERE id = ?');
  return stmt.get(id);
}

/**
 * Get node by URL
 */
function getNodeByUrl(url) {
  const stmt = getDb().prepare('SELECT * FROM nodes WHERE url = ?');
  return stmt.get(url);
}

/**
 * Delete a node
 */
function deleteNode(id) {
  const stmt = getDb().prepare('DELETE FROM nodes WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Get all healthy nodes, optionally filtered by region
 */
function getHealthyNodes(region = null) {
  if (region) {
    const stmt = getDb().prepare(`
            SELECT id, url, region, owner, avg_latency, last_heartbeat
            FROM nodes 
            WHERE status = 'healthy' AND region = ?
            ORDER BY avg_latency ASC NULLS LAST
        `);
    return stmt.all(region);
  }
    
  const stmt = getDb().prepare(`
        SELECT id, url, region, owner, avg_latency, last_heartbeat
        FROM nodes 
        WHERE status = 'healthy'
        ORDER BY avg_latency ASC NULLS LAST
    `);
  return stmt.all();
}

/**
 * Get all nodes (including unhealthy)
 */
function getAllNodes() {
  const stmt = getDb().prepare(`
        SELECT id, url, region, owner, status, avg_latency, last_heartbeat, registered_at
        FROM nodes
        ORDER BY registered_at DESC
    `);
  return stmt.all();
}

/**
 * Get random healthy node
 */
function getRandomHealthyNode(region = null) {
  if (region) {
    const stmt = getDb().prepare(`
            SELECT id, url, region, owner, avg_latency
            FROM nodes 
            WHERE status = 'healthy' AND region = ?
            ORDER BY RANDOM()
            LIMIT 1
        `);
    return stmt.get(region);
  }
    
  const stmt = getDb().prepare(`
        SELECT id, url, region, owner, avg_latency
        FROM nodes 
        WHERE status = 'healthy'
        ORDER BY RANDOM()
        LIMIT 1
    `);
  return stmt.get();
}

/**
 * Get nodes sorted by latency (fastest first)
 */
function getNodesByLatency(limit = 10) {
  const stmt = getDb().prepare(`
        SELECT id, url, region, owner, avg_latency, last_heartbeat
        FROM nodes 
        WHERE status = 'healthy' AND avg_latency IS NOT NULL
        ORDER BY avg_latency ASC
        LIMIT ?
    `);
  return stmt.all(limit);
}

/**
 * Update node heartbeat
 */
function updateHeartbeat(id) {
  const stmt = getDb().prepare(`
        UPDATE nodes 
        SET last_heartbeat = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Update node status and latency
 */
function updateNodeHealth(id, status, latency = null) {
  const stmt = getDb().prepare(`
        UPDATE nodes 
        SET status = ?, 
            avg_latency = CASE 
                WHEN avg_latency IS NULL THEN ?
                WHEN ? IS NOT NULL THEN (avg_latency * 0.7 + ? * 0.3)
                ELSE avg_latency
            END,
            total_checks = total_checks + 1,
            successful_checks = successful_checks + CASE WHEN ? = 'healthy' THEN 1 ELSE 0 END
        WHERE id = ?
    `);
  return stmt.run(status, latency, latency, latency, status, id);
}

/**
 * Get nodes that need health check
 */
function getNodesForHealthCheck() {
  const stmt = getDb().prepare(`
        SELECT id, url, region, status
        FROM nodes
    `);
  return stmt.all();
}

/**
 * Remove stale nodes (no heartbeat for specified minutes)
 */
function removeStaleNodes(minutes = 5) {
  const stmt = getDb().prepare(`
        DELETE FROM nodes 
        WHERE datetime(last_heartbeat) < datetime('now', ? || ' minutes')
    `);
  const result = stmt.run(-minutes);
  return result.changes;
}

/**
 * Mark nodes as unhealthy if heartbeat expired
 */
function markUnhealthyNodes(minutes = 2) {
  const stmt = getDb().prepare(`
        UPDATE nodes 
        SET status = 'unhealthy'
        WHERE status = 'healthy' 
        AND datetime(last_heartbeat) < datetime('now', ? || ' minutes')
    `);
  const result = stmt.run(-minutes);
  return result.changes;
}

// ============================================
// Rate Limiting
// ============================================

/**
 * Check and update rate limit for IP
 * Returns true if within limit, false if exceeded
 */
function checkRateLimit(ip, maxAttempts = 5, windowMinutes = 60) {
  const database = getDb();
    
  // Clean old entries
  database.prepare(`
        DELETE FROM rate_limits 
        WHERE datetime(first_attempt) < datetime('now', ? || ' minutes')
    `).run(-windowMinutes);
    
  // Check current attempts
  const existing = database.prepare(`
        SELECT attempts FROM rate_limits WHERE ip = ?
    `).get(ip);
    
  if (!existing) {
    database.prepare(`
            INSERT INTO rate_limits (ip) VALUES (?)
        `).run(ip);
    return true;
  }
    
  if (existing.attempts >= maxAttempts) {
    return false;
  }
    
  database.prepare(`
        UPDATE rate_limits 
        SET attempts = attempts + 1, last_attempt = CURRENT_TIMESTAMP
        WHERE ip = ?
    `).run(ip);
    
  return true;
}

// ============================================
// Health Check History
// ============================================

/**
 * Record a health check result
 */
function recordHealthCheck(nodeId, success, latencyMs = null, errorMessage = null) {
  const stmt = getDb().prepare(`
        INSERT INTO health_checks (node_id, success, latency_ms, error_message)
        VALUES (?, ?, ?, ?)
    `);
  return stmt.run(nodeId, success ? 1 : 0, latencyMs, errorMessage);
}

/**
 * Clean old health check records
 */
function cleanOldHealthChecks(days = 7) {
  const stmt = getDb().prepare(`
        DELETE FROM health_checks 
        WHERE datetime(checked_at) < datetime('now', ? || ' days')
    `);
  const result = stmt.run(-days);
  return result.changes;
}

// ============================================
// Statistics
// ============================================

/**
 * Get network statistics
 */
function getNetworkStats() {
  const database = getDb();
    
  const totalNodes = database.prepare(`
        SELECT COUNT(*) as count FROM nodes
    `).get().count;
    
  const healthyNodes = database.prepare(`
        SELECT COUNT(*) as count FROM nodes WHERE status = 'healthy'
    `).get().count;
    
  const avgLatency = database.prepare(`
        SELECT AVG(avg_latency) as avg FROM nodes WHERE status = 'healthy' AND avg_latency IS NOT NULL
    `).get().avg;
    
  const regions = database.prepare(`
        SELECT region, COUNT(*) as count 
        FROM nodes 
        WHERE status = 'healthy'
        GROUP BY region
        ORDER BY count DESC
    `).all();
    
  const recentChecks = database.prepare(`
        SELECT 
            COUNT(*) as total,
            SUM(success) as successful
        FROM health_checks 
        WHERE datetime(checked_at) > datetime('now', '-1 hour')
    `).get();
    
  return {
    totalNodes,
    healthyNodes,
    unhealthyNodes: totalNodes - healthyNodes,
    averageLatency: avgLatency ? Math.round(avgLatency) : null,
    regions,
    recentChecks: {
      total: recentChecks.total || 0,
      successful: recentChecks.successful || 0,
      successRate: recentChecks.total > 0 
        ? Math.round((recentChecks.successful / recentChecks.total) * 100) 
        : 0
    }
  };
}

module.exports = {
  getDb,
  initialize,
  close,
  // Nodes
  registerNode,
  getNodeById,
  getNodeByUrl,
  deleteNode,
  getHealthyNodes,
  getAllNodes,
  getRandomHealthyNode,
  getNodesByLatency,
  updateHeartbeat,
  updateNodeHealth,
  getNodesForHealthCheck,
  removeStaleNodes,
  markUnhealthyNodes,
  // Rate limiting
  checkRateLimit,
  // Health checks
  recordHealthCheck,
  cleanOldHealthChecks,
  // Statistics
  getNetworkStats
};
