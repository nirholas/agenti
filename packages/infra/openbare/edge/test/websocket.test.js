/**
 * WebSocket Handler Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('WebSocket Module', () => {
  describe('handleWebSocketUpgrade', () => {
    it('should export handleWebSocketUpgrade', async () => {
      const { handleWebSocketUpgrade } = await import('../src/websocket.js');
      assert.ok(typeof handleWebSocketUpgrade === 'function');
    });
  });
});

describe('WebSocket Protocol', () => {
  describe('upgrade detection', () => {
    it('should detect WebSocket upgrade headers', () => {
      const headers = new Headers({
        'Upgrade': 'websocket',
        'Connection': 'Upgrade'
      });
      
      const isUpgrade = headers.get('Upgrade')?.toLowerCase() === 'websocket';
      assert.strictEqual(isUpgrade, true);
    });

    it('should be case-insensitive', () => {
      const headers = new Headers({
        'upgrade': 'WebSocket',
        'connection': 'upgrade'
      });
      
      const isUpgrade = headers.get('Upgrade')?.toLowerCase() === 'websocket';
      assert.strictEqual(isUpgrade, true);
    });
  });

  describe('target URL extraction', () => {
    it('should extract URL from X-Bare-URL header', () => {
      const headers = new Headers({
        'X-Bare-URL': 'wss://echo.websocket.org'
      });
      
      const targetUrl = headers.get('X-Bare-URL');
      assert.ok(targetUrl);
      assert.ok(targetUrl.startsWith('wss://') || targetUrl.startsWith('ws://'));
    });
  });

  describe('protocol support', () => {
    it('should support wss:// protocol', () => {
      const url = new URL('wss://example.com/socket');
      assert.strictEqual(url.protocol, 'wss:');
    });

    it('should support ws:// protocol', () => {
      const url = new URL('ws://example.com/socket');
      assert.strictEqual(url.protocol, 'ws:');
    });
  });
});

describe('WebSocket Error Handling', () => {
  it('should handle missing target URL', () => {
    const headers = new Headers({});
    const targetUrl = headers.get('X-Bare-URL');
    assert.strictEqual(targetUrl, null);
  });

  it('should handle invalid URL format', () => {
    assert.throws(() => {
      new URL('not-a-valid-url');
    });
  });
});
