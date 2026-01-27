/**
 * Discovery Module Tests
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Discovery, DiscoveryError, KNOWN_REGISTRIES } from '../src/discovery.js';

describe('Discovery', () => {
  let discovery;

  afterEach(() => {
    if (discovery) {
      discovery.stopAutoRefresh();
      discovery = null;
    }
  });

  describe('constructor', () => {
    it('should create discovery with default options', () => {
      discovery = new Discovery();
      assert.ok(discovery);
    });

    it('should create discovery with registry URL', () => {
      discovery = new Discovery({
        registryUrl: 'https://registry.openbare.dev'
      });
      assert.ok(discovery);
    });

    it('should accept refresh interval option', () => {
      discovery = new Discovery({
        registryUrl: 'https://registry.openbare.dev',
        refreshInterval: 60000
      });
      assert.ok(discovery);
    });

    it('should accept region filter option', () => {
      discovery = new Discovery({
        region: 'us-east'
      });
      assert.ok(discovery);
    });

    it('should accept verifiedOnly option', () => {
      discovery = new Discovery({
        verifiedOnly: true
      });
      assert.ok(discovery);
    });
  });

  describe('getServerUrls', () => {
    beforeEach(() => {
      discovery = new Discovery({
        registryUrl: 'https://registry.openbare.dev'
      });
    });

    it('should return array', () => {
      const urls = discovery.getServerUrls();
      assert.ok(Array.isArray(urls));
    });

    it('should return empty array when no nodes fetched', () => {
      const urls = discovery.getServerUrls();
      assert.strictEqual(urls.length, 0);
    });
  });

  describe('getTimeSinceLastFetch', () => {
    beforeEach(() => {
      discovery = new Discovery({
        registryUrl: 'https://registry.openbare.dev'
      });
    });

    it('should return Infinity initially', () => {
      const time = discovery.getTimeSinceLastFetch();
      assert.strictEqual(time, Infinity);
    });
  });

  describe('isCacheStale', () => {
    beforeEach(() => {
      discovery = new Discovery({
        registryUrl: 'https://registry.openbare.dev',
        refreshInterval: 30000
      });
    });

    it('should return true when no fetch has occurred', () => {
      const stale = discovery.isCacheStale();
      assert.strictEqual(stale, true);
    });
  });

  describe('setRegistryUrl', () => {
    beforeEach(() => {
      discovery = new Discovery({
        registryUrl: 'https://registry.openbare.dev'
      });
    });

    it('should not throw when setting new URL', () => {
      assert.doesNotThrow(() => {
        discovery.setRegistryUrl('https://new-registry.openbare.dev');
      });
    });
  });

  describe('clearCache', () => {
    beforeEach(() => {
      discovery = new Discovery({
        registryUrl: 'https://registry.openbare.dev'
      });
    });

    it('should not throw', () => {
      assert.doesNotThrow(() => discovery.clearCache());
    });
  });

  describe('stopAutoRefresh', () => {
    it('should stop refresh timer', () => {
      discovery = new Discovery({
        registryUrl: 'https://registry.openbare.dev',
        autoRefresh: true,
        refreshInterval: 1000
      });
      assert.doesNotThrow(() => discovery.stopAutoRefresh());
    });

    it('should be safe to call multiple times', () => {
      discovery = new Discovery({
        registryUrl: 'https://registry.openbare.dev'
      });
      assert.doesNotThrow(() => {
        discovery.stopAutoRefresh();
        discovery.stopAutoRefresh();
      });
    });
  });

  describe('startAutoRefresh', () => {
    it('should not throw', () => {
      discovery = new Discovery({
        registryUrl: 'https://registry.openbare.dev',
        refreshInterval: 60000
      });
      assert.doesNotThrow(() => discovery.startAutoRefresh());
    });
  });

  describe('onUpdate', () => {
    beforeEach(() => {
      discovery = new Discovery({
        registryUrl: 'https://registry.openbare.dev'
      });
    });

    it('should return unsubscribe function', () => {
      const unsubscribe = discovery.onUpdate(() => {});
      assert.ok(typeof unsubscribe === 'function');
    });

    it('should allow unsubscribing', () => {
      const unsubscribe = discovery.onUpdate(() => {});
      assert.doesNotThrow(() => unsubscribe());
    });
  });
});

describe('DiscoveryError', () => {
  it('should create error with message and code', () => {
    const error = new DiscoveryError('Test error', 'TEST_CODE');
    assert.strictEqual(error.message, 'Test error');
    assert.strictEqual(error.code, 'TEST_CODE');
    assert.strictEqual(error.name, 'DiscoveryError');
  });

  it('should be instance of Error', () => {
    const error = new DiscoveryError('Test', 'CODE');
    assert.ok(error instanceof Error);
  });
});

describe('KNOWN_REGISTRIES', () => {
  it('should export known registries', () => {
    assert.ok(KNOWN_REGISTRIES);
    assert.ok(typeof KNOWN_REGISTRIES === 'object');
  });

  it('should have default registry', () => {
    assert.ok(KNOWN_REGISTRIES.default);
    assert.ok(typeof KNOWN_REGISTRIES.default === 'string');
  });
});
