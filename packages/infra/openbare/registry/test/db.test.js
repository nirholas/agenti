/**
 * Registry Database Tests
 * 
 * Note: These tests require better-sqlite3 which may not compile on all Node versions.
 * They are designed to run in CI with Node 20.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Use in-memory database for tests
process.env.DB_PATH = ':memory:';

describe('Database Module', () => {
  let db;

  beforeEach(() => {
    // Clear require cache for fresh import
    const dbPath = require.resolve('../db.js');
    delete require.cache[dbPath];
    db = require('../db.js');
    db.initialize();
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('initialize', () => {
    it('should create database successfully', () => {
      assert.ok(db.getDb());
    });
  });

  describe('registerNode', () => {
    it('should register a new node and return row id', () => {
      const id = db.registerNode({
        url: 'https://bare1.example.com',
        region: 'us-east',
        owner: 'test@example.com'
      });
      assert.ok(id);
      assert.ok(typeof id === 'number' || typeof id === 'bigint');
    });

    it('should register node with optional contact', () => {
      const id = db.registerNode({
        url: 'https://bare2.example.com',
        region: 'eu-west',
        owner: 'admin@example.com',
        contact: 'support@example.com'
      });
      assert.ok(id);
    });
  });

  describe('getNodeById', () => {
    it('should retrieve registered node by id', () => {
      const id = db.registerNode({
        url: 'https://bare1.example.com',
        region: 'us-east',
        owner: 'test@example.com'
      });
      
      const node = db.getNodeById(id);
      assert.ok(node);
      assert.strictEqual(node.url, 'https://bare1.example.com');
      assert.strictEqual(node.region, 'us-east');
    });

    it('should return undefined for non-existent node', () => {
      const result = db.getNodeById(99999);
      assert.strictEqual(result, undefined);
    });
  });

  describe('getNodeByUrl', () => {
    it('should retrieve node by URL', () => {
      db.registerNode({
        url: 'https://bare1.example.com',
        region: 'us-east',
        owner: 'test@example.com'
      });
      
      const node = db.getNodeByUrl('https://bare1.example.com');
      assert.ok(node);
      assert.strictEqual(node.url, 'https://bare1.example.com');
    });
  });

  describe('getAllNodes', () => {
    it('should return all registered nodes', () => {
      db.registerNode({ url: 'https://bare1.example.com', region: 'us-east', owner: 'test1@example.com' });
      db.registerNode({ url: 'https://bare2.example.com', region: 'eu-west', owner: 'test2@example.com' });
      
      const nodes = db.getAllNodes();
      assert.strictEqual(nodes.length, 2);
    });

    it('should return empty array when no nodes', () => {
      const nodes = db.getAllNodes();
      assert.ok(Array.isArray(nodes));
      assert.strictEqual(nodes.length, 0);
    });
  });

  describe('getHealthyNodes', () => {
    it('should return only healthy nodes', () => {
      const id1 = db.registerNode({ url: 'https://bare1.example.com', region: 'us-east', owner: 'test@example.com' });
      const id2 = db.registerNode({ url: 'https://bare2.example.com', region: 'eu-west', owner: 'test@example.com' });
      
      // Mark one as healthy, leave other as default
      db.updateNodeHealth(id1, 'healthy', 100);
      db.updateNodeHealth(id2, 'unhealthy', null);
      
      const healthy = db.getHealthyNodes();
      assert.strictEqual(healthy.length, 1);
    });

    it('should filter by region', () => {
      const id1 = db.registerNode({ url: 'https://bare1.example.com', region: 'us-east', owner: 'test@example.com' });
      const id2 = db.registerNode({ url: 'https://bare2.example.com', region: 'eu-west', owner: 'test@example.com' });
      
      db.updateNodeHealth(id1, 'healthy', 100);
      db.updateNodeHealth(id2, 'healthy', 100);
      
      const usEast = db.getHealthyNodes('us-east');
      assert.strictEqual(usEast.length, 1);
      assert.strictEqual(usEast[0].region, 'us-east');
    });
  });

  describe('updateNodeHealth', () => {
    it('should update node status', () => {
      const id = db.registerNode({ url: 'https://bare1.example.com', region: 'us-east', owner: 'test@example.com' });
      
      db.updateNodeHealth(id, 'healthy', 150);
      const node = db.getNodeById(id);
      
      assert.strictEqual(node.status, 'healthy');
    });

    it('should update latency', () => {
      const id = db.registerNode({ url: 'https://bare1.example.com', region: 'us-east', owner: 'test@example.com' });
      
      db.updateNodeHealth(id, 'healthy', 150);
      const node = db.getNodeById(id);
      
      assert.strictEqual(node.avg_latency, 150);
    });
  });

  describe('updateHeartbeat', () => {
    it('should update last heartbeat time', () => {
      const id = db.registerNode({ url: 'https://bare1.example.com', region: 'us-east', owner: 'test@example.com' });
      
      const result = db.updateHeartbeat(id);
      assert.strictEqual(result, true);
    });
  });

  describe('deleteNode', () => {
    it('should delete a node', () => {
      const id = db.registerNode({ url: 'https://bare1.example.com', region: 'us-east', owner: 'test@example.com' });
      
      const deleted = db.deleteNode(id);
      assert.strictEqual(deleted, true);
      
      const node = db.getNodeById(id);
      assert.strictEqual(node, undefined);
    });

    it('should return false for non-existent node', () => {
      const deleted = db.deleteNode(99999);
      assert.strictEqual(deleted, false);
    });
  });

  describe('getRandomHealthyNode', () => {
    it('should return a healthy node', () => {
      const id = db.registerNode({ url: 'https://bare1.example.com', region: 'us-east', owner: 'test@example.com' });
      db.updateNodeHealth(id, 'healthy', 100);
      
      const node = db.getRandomHealthyNode();
      assert.ok(node);
      assert.strictEqual(node.url, 'https://bare1.example.com');
    });

    it('should return undefined when no healthy nodes', () => {
      const id = db.registerNode({ url: 'https://bare1.example.com', region: 'us-east', owner: 'test@example.com' });
      db.updateNodeHealth(id, 'unhealthy', null);
      
      const node = db.getRandomHealthyNode();
      assert.strictEqual(node, undefined);
    });
  });

  describe('getNetworkStats', () => {
    it('should return statistics object', () => {
      db.registerNode({ url: 'https://bare1.example.com', region: 'us-east', owner: 'test@example.com' });
      
      const stats = db.getNetworkStats();
      assert.ok(stats);
      assert.strictEqual(stats.totalNodes, 1);
      assert.ok(typeof stats.healthyNodes === 'number');
      assert.ok(typeof stats.unhealthyNodes === 'number');
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', () => {
      const allowed = db.checkRateLimit('127.0.0.1', 5, 60);
      assert.strictEqual(allowed, true);
    });

    it('should block requests exceeding limit', () => {
      const ip = '192.168.1.1';
      
      // Make max attempts
      for (let i = 0; i < 5; i++) {
        db.checkRateLimit(ip, 5, 60);
      }
      
      // Next one should be blocked
      const allowed = db.checkRateLimit(ip, 5, 60);
      assert.strictEqual(allowed, false);
    });
  });

  describe('recordHealthCheck', () => {
    it('should record health check result', () => {
      const id = db.registerNode({ url: 'https://bare1.example.com', region: 'us-east', owner: 'test@example.com' });
      
      const result = db.recordHealthCheck(id, true, 150, null);
      assert.ok(result);
    });
  });
});
