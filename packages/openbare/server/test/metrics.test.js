/**
 * Metrics Module Tests
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  recordRequest,
  recordResponse,
  recordError,
  connectionOpened,
  connectionClosed,
  getMetrics,
  getSummary,
  resetMetrics
} from '../metrics.js';

describe('Metrics Module', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('recordRequest', () => {
    it('should increment total requests', () => {
      const before = getMetrics().requests.total;
      recordRequest('GET');
      const after = getMetrics().requests.total;
      assert.strictEqual(after, before + 1);
    });

    it('should track by method', () => {
      recordRequest('GET');
      recordRequest('GET');
      recordRequest('POST');
      const metrics = getMetrics();
      assert.strictEqual(metrics.requests.by_method.GET, 2);
      assert.strictEqual(metrics.requests.by_method.POST, 1);
    });
  });

  describe('recordResponse', () => {
    it('should record response latency', () => {
      recordResponse(200, 100);
      const metrics = getMetrics();
      assert.ok(metrics.latency.average_ms > 0);
    });

    it('should track by status code', () => {
      recordResponse(200, 100);
      recordResponse(200, 100);
      recordResponse(404, 50);
      const metrics = getMetrics();
      assert.strictEqual(metrics.requests.by_status['2xx'], 2);
      assert.strictEqual(metrics.requests.by_status['4xx'], 1);
    });
  });

  describe('recordError', () => {
    it('should increment error count', () => {
      const before = getMetrics().errors.total;
      recordError('test_error');
      const after = getMetrics().errors.total;
      assert.strictEqual(after, before + 1);
    });
  });

  describe('connectionOpened/connectionClosed', () => {
    it('should track active connections', () => {
      const before = getMetrics().connections.active;
      connectionOpened();
      assert.strictEqual(getMetrics().connections.active, before + 1);
      connectionClosed();
      assert.strictEqual(getMetrics().connections.active, before);
    });

    it('should track peak connections', () => {
      connectionOpened();
      connectionOpened();
      connectionOpened();
      const metrics = getMetrics();
      assert.ok(metrics.connections.peak >= 3);
    });
  });

  describe('getSummary', () => {
    it('should return summary object', () => {
      const summary = getSummary();
      assert.ok(summary);
      assert.ok(typeof summary.uptime_seconds === 'number');
      assert.ok(typeof summary.requests_total === 'number');
    });
  });

  describe('getMetrics', () => {
    it('should return full metrics object', () => {
      const metrics = getMetrics();
      assert.ok(metrics.requests);
      assert.ok(metrics.latency);
      assert.ok(metrics.connections);
      assert.ok(metrics.bytes);
      assert.ok(metrics.errors);
    });
  });
});
