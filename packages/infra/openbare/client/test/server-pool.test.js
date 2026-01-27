/**
 * Server Pool Tests
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ServerPool } from '../src/server-pool.js';

describe('ServerPool', () => {
  let pool;

  beforeEach(() => {
    pool = new ServerPool({
      strategy: 'fastest',
      healthCheckInterval: 30000,
      timeout: 5000
    });
  });

  afterEach(() => {
    if (pool) {
      pool.stopHealthChecks();
      pool = null;
    }
  });

  describe('constructor', () => {
    it('should create pool with default options', () => {
      const p = new ServerPool();
      assert.ok(p);
      p.stopHealthChecks();
    });

    it('should accept custom options', () => {
      const p = new ServerPool({
        strategy: 'round-robin',
        timeout: 10000
      });
      assert.ok(p);
      p.stopHealthChecks();
    });
  });

  describe('addServer', () => {
    it('should add a server to the pool', () => {
      pool.addServer('https://bare1.example.com');
      const servers = pool.getAllServers();
      assert.strictEqual(servers.length, 1);
      assert.strictEqual(servers[0].url, 'https://bare1.example.com');
    });

    it('should add multiple servers', () => {
      pool.addServer('https://bare1.example.com');
      pool.addServer('https://bare2.example.com');
      pool.addServer('https://bare3.example.com');
      const servers = pool.getAllServers();
      assert.strictEqual(servers.length, 3);
    });

    it('should not add duplicate servers', () => {
      pool.addServer('https://bare1.example.com');
      pool.addServer('https://bare1.example.com');
      const servers = pool.getAllServers();
      assert.strictEqual(servers.length, 1);
    });

    it('should accept priority', () => {
      pool.addServer('https://bare1.example.com', 10);
      pool.addServer('https://bare2.example.com', 1);
      const servers = pool.getAllServers();
      assert.strictEqual(servers.length, 2);
    });
  });

  describe('removeServer', () => {
    it('should remove a server from the pool', () => {
      pool.addServer('https://bare1.example.com');
      pool.addServer('https://bare2.example.com');
      pool.removeServer('https://bare1.example.com');
      const servers = pool.getAllServers();
      assert.strictEqual(servers.length, 1);
      assert.strictEqual(servers[0].url, 'https://bare2.example.com');
    });

    it('should handle removing non-existent server', () => {
      pool.addServer('https://bare1.example.com');
      const result = pool.removeServer('https://nonexistent.com');
      assert.strictEqual(result, false);
      const servers = pool.getAllServers();
      assert.strictEqual(servers.length, 1);
    });
  });

  describe('selectServer', () => {
    it('should return null when pool is empty', () => {
      const server = pool.selectServer();
      assert.strictEqual(server, null);
    });

    it('should return a server when available', () => {
      pool.addServer('https://bare1.example.com');
      const server = pool.selectServer();
      assert.ok(server);
      assert.strictEqual(server.url, 'https://bare1.example.com');
    });
  });

  describe('getHealthyServers', () => {
    it('should return empty array when no servers', () => {
      const healthy = pool.getHealthyServers();
      assert.ok(Array.isArray(healthy));
      assert.strictEqual(healthy.length, 0);
    });

    it('should return servers (all healthy by default)', () => {
      pool.addServer('https://bare1.example.com');
      pool.addServer('https://bare2.example.com');
      const healthy = pool.getHealthyServers();
      assert.strictEqual(healthy.length, 2);
    });
  });

  describe('reportSuccess', () => {
    it('should update server latency', () => {
      pool.addServer('https://bare1.example.com');
      pool.reportSuccess('https://bare1.example.com', 150);
      const servers = pool.getAllServers();
      assert.strictEqual(servers[0].latency, 150);
    });

    it('should keep server healthy', () => {
      pool.addServer('https://bare1.example.com');
      pool.reportSuccess('https://bare1.example.com', 100);
      const servers = pool.getAllServers();
      assert.strictEqual(servers[0].healthy, true);
    });

    it('should increment success count', () => {
      pool.addServer('https://bare1.example.com');
      pool.reportSuccess('https://bare1.example.com', 100);
      const servers = pool.getAllServers();
      assert.strictEqual(servers[0].successCount, 1);
    });
  });

  describe('reportFailure', () => {
    it('should increment fail count', () => {
      pool.addServer('https://bare1.example.com');
      pool.reportFailure('https://bare1.example.com');
      const servers = pool.getAllServers();
      assert.strictEqual(servers[0].failCount, 1);
    });

    it('should mark server unhealthy after max failures', () => {
      // Default maxFailures is 3
      pool.addServer('https://bare1.example.com');
      pool.reportFailure('https://bare1.example.com');
      pool.reportFailure('https://bare1.example.com');
      pool.reportFailure('https://bare1.example.com');
      const servers = pool.getAllServers();
      assert.strictEqual(servers[0].healthy, false);
    });
  });

  describe('getAllServers', () => {
    it('should return all servers', () => {
      pool.addServer('https://bare1.example.com');
      pool.addServer('https://bare2.example.com');
      const servers = pool.getAllServers();
      assert.strictEqual(servers.length, 2);
    });

    it('should return server objects with expected properties', () => {
      pool.addServer('https://bare1.example.com');
      const servers = pool.getAllServers();
      assert.ok(servers[0].url);
      assert.ok(typeof servers[0].healthy === 'boolean');
      assert.ok(typeof servers[0].latency === 'number');
      assert.ok(typeof servers[0].priority === 'number');
      assert.ok(typeof servers[0].failCount === 'number');
      assert.ok(typeof servers[0].successCount === 'number');
    });
  });

  describe('getStats', () => {
    it('should return stats object', () => {
      pool.addServer('https://bare1.example.com');
      const stats = pool.getStats();
      assert.ok(typeof stats === 'object');
      assert.strictEqual(stats.total, 1);
      assert.strictEqual(stats.healthy, 1);
      assert.strictEqual(stats.unhealthy, 0);
    });

    it('should track healthy and unhealthy counts', () => {
      pool.addServer('https://bare1.example.com');
      pool.addServer('https://bare2.example.com');
      
      // Mark one as unhealthy
      pool.reportFailure('https://bare1.example.com');
      pool.reportFailure('https://bare1.example.com');
      pool.reportFailure('https://bare1.example.com');
      
      const stats = pool.getStats();
      assert.strictEqual(stats.total, 2);
      assert.strictEqual(stats.healthy, 1);
      assert.strictEqual(stats.unhealthy, 1);
    });
  });

  describe('setFallbackOrder', () => {
    it('should update server priorities', () => {
      pool.addServer('https://bare1.example.com');
      pool.addServer('https://bare2.example.com');
      
      pool.setFallbackOrder([
        'https://bare2.example.com',
        'https://bare1.example.com'
      ]);
      
      const servers = pool.getAllServers();
      const server1 = servers.find(s => s.url === 'https://bare1.example.com');
      const server2 = servers.find(s => s.url === 'https://bare2.example.com');
      
      assert.ok(server2.priority < server1.priority);
    });
  });

  describe('getNextServer', () => {
    it('should return server excluding specified URL', () => {
      pool.addServer('https://bare1.example.com');
      pool.addServer('https://bare2.example.com');
      
      const server = pool.getNextServer('https://bare1.example.com');
      assert.ok(server);
      assert.strictEqual(server.url, 'https://bare2.example.com');
    });

    it('should return null when no other servers available', () => {
      pool.addServer('https://bare1.example.com');
      
      const server = pool.getNextServer('https://bare1.example.com');
      assert.strictEqual(server, null);
    });
  });
});
