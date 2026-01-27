/**
 * OpenBare Client Tests
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { OpenBareClient, ServerPool } from '../src/index.js';

describe('OpenBareClient', () => {
  let client;

  // Clean up after each test to prevent hanging promises
  afterEach(() => {
    if (client) {
      client.destroy();
      client = null;
    }
  });

  describe('constructor', () => {
    it('should create client with default options', () => {
      client = new OpenBareClient();
      assert.ok(client);
    });

    it('should accept servers array', () => {
      client = new OpenBareClient({
        servers: ['https://bare1.example.com', 'https://bare2.example.com']
      });
      assert.ok(client);
    });

    it('should accept timeout option', () => {
      client = new OpenBareClient({
        timeout: 10000
      });
      assert.ok(client);
    });

    it('should accept retries option', () => {
      client = new OpenBareClient({
        retries: 5
      });
      assert.ok(client);
    });

    it('should accept strategy option', () => {
      client = new OpenBareClient({
        strategy: 'round-robin'
      });
      assert.ok(client);
    });

    it('should accept registry URL without auto-discover', () => {
      // Don't use autoDiscover: true to avoid network requests
      client = new OpenBareClient({
        registryUrl: 'https://registry.openbare.dev',
        autoDiscover: false
      });
      assert.ok(client);
    });
  });

  describe('addServer', () => {
    beforeEach(() => {
      client = new OpenBareClient();
    });

    it('should add server and return client for chaining', () => {
      const result = client.addServer('https://bare1.example.com');
      assert.strictEqual(result, client);
    });

    it('should allow chaining multiple addServer calls', () => {
      const result = client
        .addServer('https://bare1.example.com')
        .addServer('https://bare2.example.com')
        .addServer('https://bare3.example.com');
      
      // Chaining should return the client
      assert.strictEqual(result, client);
    });

    it('should accept priority parameter', () => {
      // Just verify no error is thrown with priority param
      assert.doesNotThrow(() => {
        client.addServer('https://bare1.example.com', 1);
      });
    });
  });

  describe('removeServer', () => {
    beforeEach(() => {
      client = new OpenBareClient({
        servers: ['https://bare1.example.com', 'https://bare2.example.com']
      });
    });

    it('should remove server and return boolean', () => {
      const result = client.removeServer('https://bare1.example.com');
      assert.strictEqual(typeof result, 'boolean');
    });
  });

  describe('getHealthyServers', () => {
    it('should return empty array when no servers', () => {
      client = new OpenBareClient();
      const healthy = client.getHealthyServers();
      assert.ok(Array.isArray(healthy));
      assert.strictEqual(healthy.length, 0);
    });

    it('should return healthy servers', () => {
      client = new OpenBareClient({
        servers: ['https://bare1.example.com', 'https://bare2.example.com']
      });
      const healthy = client.getHealthyServers();
      assert.ok(Array.isArray(healthy));
      // Initially all servers are considered healthy
      assert.strictEqual(healthy.length, 2);
    });

    it('should return server info with expected properties', () => {
      client = new OpenBareClient({
        servers: ['https://bare1.example.com']
      });
      const healthy = client.getHealthyServers();
      assert.ok(healthy.length > 0);
      assert.ok('url' in healthy[0]);
      assert.ok('latency' in healthy[0]);
      assert.ok('priority' in healthy[0]);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      client = new OpenBareClient({
        servers: ['https://bare1.example.com'],
        autoHealthCheck: true
      });
      assert.doesNotThrow(() => client.destroy());
      client = null; // Prevent double destroy in afterEach
    });
  });

  describe('setStrategy', () => {
    beforeEach(() => {
      client = new OpenBareClient();
    });

    it('should return client for chaining', () => {
      const result = client.setStrategy('round-robin');
      assert.strictEqual(result, client);
    });

    it('should accept all valid strategies', () => {
      assert.doesNotThrow(() => client.setStrategy('fastest'));
      assert.doesNotThrow(() => client.setStrategy('round-robin'));
      assert.doesNotThrow(() => client.setStrategy('priority'));
    });
  });

  describe('setFallbackOrder', () => {
    beforeEach(() => {
      client = new OpenBareClient({
        servers: ['https://bare1.example.com', 'https://bare2.example.com']
      });
    });

    it('should return client for chaining', () => {
      const result = client.setFallbackOrder([
        'https://bare2.example.com',
        'https://bare1.example.com'
      ]);
      assert.strictEqual(result, client);
    });
  });

  describe('getStats', () => {
    it('should return stats object', () => {
      client = new OpenBareClient({
        servers: ['https://bare1.example.com']
      });
      const stats = client.getStats();
      assert.ok(typeof stats === 'object');
    });
  });
});

describe('ServerPool', () => {
  let pool;

  afterEach(() => {
    if (pool) {
      pool.stopHealthChecks();
      pool = null;
    }
  });

  describe('constructor', () => {
    it('should create pool with default options', () => {
      pool = new ServerPool();
      assert.ok(pool);
    });

    it('should accept strategy option', () => {
      pool = new ServerPool({ strategy: 'round-robin' });
      assert.ok(pool);
    });
  });

  describe('addServer', () => {
    beforeEach(() => {
      pool = new ServerPool();
    });

    it('should add server and return server info', () => {
      const info = pool.addServer('https://bare1.example.com');
      assert.ok(info);
      assert.ok('url' in info);
      assert.ok('healthy' in info);
    });

    it('should add multiple servers', () => {
      pool.addServer('https://bare1.example.com');
      pool.addServer('https://bare2.example.com');
      pool.addServer('https://bare3.example.com');
      
      const servers = pool.getAllServers();
      assert.strictEqual(servers.length, 3);
    });
  });

  describe('removeServer', () => {
    beforeEach(() => {
      pool = new ServerPool();
      pool.addServer('https://bare1.example.com');
      pool.addServer('https://bare2.example.com');
    });

    it('should remove server', () => {
      const result = pool.removeServer('https://bare1.example.com');
      assert.strictEqual(result, true);
      const servers = pool.getAllServers();
      assert.strictEqual(servers.length, 1);
    });

    it('should return false for non-existent server', () => {
      const result = pool.removeServer('https://nonexistent.example.com');
      assert.strictEqual(result, false);
    });
  });

  describe('getAllServers', () => {
    it('should return empty array when no servers', () => {
      pool = new ServerPool();
      const servers = pool.getAllServers();
      assert.ok(Array.isArray(servers));
      assert.strictEqual(servers.length, 0);
    });

    it('should return added servers', () => {
      pool = new ServerPool();
      pool.addServer('https://bare1.example.com');
      const servers = pool.getAllServers();
      assert.strictEqual(servers.length, 1);
    });
  });

  describe('getHealthyServers', () => {
    beforeEach(() => {
      pool = new ServerPool();
      pool.addServer('https://bare1.example.com');
      pool.addServer('https://bare2.example.com');
    });

    it('should return healthy servers', () => {
      const healthy = pool.getHealthyServers();
      assert.ok(Array.isArray(healthy));
      // Initially all servers are healthy
      assert.strictEqual(healthy.length, 2);
    });
  });

  describe('selectServer', () => {
    it('should return null when no servers', () => {
      pool = new ServerPool();
      const server = pool.selectServer();
      assert.strictEqual(server, null);
    });

    it('should return server when available', () => {
      pool = new ServerPool();
      pool.addServer('https://bare1.example.com');
      const server = pool.selectServer();
      assert.ok(server);
      assert.ok(server.url.includes('bare1.example.com'));
    });
  });
});
