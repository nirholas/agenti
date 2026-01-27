/**
 * Health Module Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getHealthStatus,
  isHealthy,
  HealthStatus
} from '../health.js';

describe('Health Module', () => {
  describe('getHealthStatus', () => {
    it('should return health status object', () => {
      const status = getHealthStatus();
      assert.ok(status);
      assert.ok(status.status);
      assert.ok(status.checks);
    });

    it('should include checks object', () => {
      const status = getHealthStatus();
      assert.ok(typeof status.checks === 'object');
      assert.ok(typeof status.checks.server === 'boolean');
      assert.ok(typeof status.checks.memory === 'boolean');
    });

    it('should have valid status value', () => {
      const status = getHealthStatus();
      const validStatuses = [HealthStatus.HEALTHY, HealthStatus.DEGRADED, HealthStatus.UNHEALTHY];
      assert.ok(validStatuses.includes(status.status));
    });
  });

  describe('isHealthy', () => {
    it('should return boolean', () => {
      const healthy = isHealthy();
      assert.ok(typeof healthy === 'boolean');
    });

    it('should be healthy in normal conditions', () => {
      const healthy = isHealthy();
      assert.strictEqual(healthy, true);
    });
  });

  describe('HealthStatus', () => {
    it('should export health status constants', () => {
      assert.ok(HealthStatus.HEALTHY);
      assert.ok(HealthStatus.DEGRADED);
      assert.ok(HealthStatus.UNHEALTHY);
    });

    it('should have correct values', () => {
      assert.strictEqual(HealthStatus.HEALTHY, 'healthy');
      assert.strictEqual(HealthStatus.DEGRADED, 'degraded');
      assert.strictEqual(HealthStatus.UNHEALTHY, 'unhealthy');
    });
  });
});
