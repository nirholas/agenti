/**
 * Server Configuration Tests
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

describe('Config', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use default port 8080', async () => {
    delete process.env.PORT;
    // Re-import to get fresh config
    const { config } = await import('../config.js?' + Date.now());
    assert.strictEqual(config.port, 8080);
  });

  it('should use PORT from environment', async () => {
    process.env.PORT = '3000';
    const { config } = await import('../config.js?' + Date.now());
    assert.strictEqual(config.port, 3000);
  });

  it('should detect development environment', async () => {
    process.env.NODE_ENV = 'development';
    const { config } = await import('../config.js?' + Date.now());
    assert.strictEqual(config.isDev, true);
    assert.strictEqual(config.isProd, false);
  });

  it('should detect production environment', async () => {
    process.env.NODE_ENV = 'production';
    const { config } = await import('../config.js?' + Date.now());
    assert.strictEqual(config.isDev, false);
    assert.strictEqual(config.isProd, true);
  });

  it('should have bare server path', async () => {
    const { config } = await import('../config.js?' + Date.now());
    assert.strictEqual(config.bare.path, '/bare/');
  });

  it('should configure rate limiting', async () => {
    const { config } = await import('../config.js?' + Date.now());
    assert.ok(config.rateLimit.windowMs > 0);
    assert.ok(config.rateLimit.max > 0);
  });

  it('should configure CORS', async () => {
    const { config } = await import('../config.js?' + Date.now());
    assert.strictEqual(config.cors.origin, '*');
    assert.ok(Array.isArray(config.cors.methods));
  });
});

describe('Config Validation', () => {
  it('should validate config without throwing', async () => {
    const { validateConfig } = await import('../config.js');
    assert.doesNotThrow(() => validateConfig());
  });
});
