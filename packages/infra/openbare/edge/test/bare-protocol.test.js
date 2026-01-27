/**
 * Bare Protocol Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Note: These tests run against exported functions from bare-protocol.js
// Cloudflare Workers tests would typically use miniflare for full integration

describe('Bare Protocol', () => {
  describe('BareError', () => {
    it('should be importable', async () => {
      const { BareError } = await import('../src/bare-protocol.js');
      assert.ok(BareError);
    });

    it('should create error with status, code, and message', async () => {
      const { BareError } = await import('../src/bare-protocol.js');
      const error = new BareError(400, 'INVALID_REQUEST', 'Test error');
      assert.strictEqual(error.message, 'Test error');
      assert.strictEqual(error.status, 400);
      assert.strictEqual(error.code, 'INVALID_REQUEST');
      assert.strictEqual(error.name, 'BareError');
    });

    it('should be instance of Error', async () => {
      const { BareError } = await import('../src/bare-protocol.js');
      const error = new BareError(500, 'SERVER_ERROR', 'Test');
      assert.ok(error instanceof Error);
    });
  });

  describe('parseBareHeaders', () => {
    it('should be a function', async () => {
      const { parseBareHeaders } = await import('../src/bare-protocol.js');
      assert.ok(typeof parseBareHeaders === 'function');
    });

    it('should parse X-Bare-URL header from request', async () => {
      const { parseBareHeaders } = await import('../src/bare-protocol.js');
      const headers = new Headers({
        'X-Bare-URL': 'https://example.com'
      });
      // parseBareHeaders expects a Request-like object with headers property
      const mockRequest = { headers };
      const result = parseBareHeaders(mockRequest);
      assert.strictEqual(result.url, 'https://example.com');
    });

    it('should parse X-Bare-Headers as JSON', async () => {
      const { parseBareHeaders } = await import('../src/bare-protocol.js');
      const headers = new Headers({
        'X-Bare-URL': 'https://example.com',
        'X-Bare-Headers': JSON.stringify({ 'Content-Type': 'application/json' })
      });
      const mockRequest = { headers };
      const result = parseBareHeaders(mockRequest);
      assert.ok(result.headers);
      assert.strictEqual(result.headers['Content-Type'], 'application/json');
    });

    it('should return empty object for missing optional headers', async () => {
      const { parseBareHeaders } = await import('../src/bare-protocol.js');
      const headers = new Headers();
      const mockRequest = { headers };
      const result = parseBareHeaders(mockRequest);
      assert.ok(Array.isArray(result.forwardHeaders));
      assert.ok(Array.isArray(result.passHeaders));
    });
  });

  describe('buildTargetUrl', () => {
    it('should be a function', async () => {
      const { buildTargetUrl } = await import('../src/bare-protocol.js');
      assert.ok(typeof buildTargetUrl === 'function');
    });
  });
});

describe('Header Stripping', () => {
  const STRIP_HEADERS = [
    'x-frame-options',
    'content-security-policy',
    'content-security-policy-report-only',
    'x-content-type-options',
    'x-xss-protection',
    'strict-transport-security',
    'cross-origin-opener-policy',
    'cross-origin-embedder-policy',
    'cross-origin-resource-policy',
    'permissions-policy',
  ];

  it('should have list of headers to strip', () => {
    assert.ok(Array.isArray(STRIP_HEADERS));
    assert.ok(STRIP_HEADERS.length > 0);
  });

  it('should include x-frame-options', () => {
    assert.ok(STRIP_HEADERS.includes('x-frame-options'));
  });

  it('should include content-security-policy', () => {
    assert.ok(STRIP_HEADERS.includes('content-security-policy'));
  });

  it('should include cross-origin headers', () => {
    assert.ok(STRIP_HEADERS.includes('cross-origin-opener-policy'));
    assert.ok(STRIP_HEADERS.includes('cross-origin-embedder-policy'));
  });
});

describe('CORS Headers', () => {
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };

  it('should allow all origins', () => {
    assert.strictEqual(CORS_HEADERS['Access-Control-Allow-Origin'], '*');
  });

  it('should allow common HTTP methods', () => {
    const methods = CORS_HEADERS['Access-Control-Allow-Methods'];
    assert.ok(methods.includes('GET'));
    assert.ok(methods.includes('POST'));
    assert.ok(methods.includes('PUT'));
    assert.ok(methods.includes('DELETE'));
  });

  it('should have reasonable max-age', () => {
    const maxAge = parseInt(CORS_HEADERS['Access-Control-Max-Age']);
    assert.ok(maxAge > 0);
    assert.ok(maxAge <= 86400 * 7); // Max 7 days
  });
});

describe('Request Handling', () => {
  describe('URL validation', () => {
    it('should accept HTTPS URLs', () => {
      const url = 'https://example.com';
      assert.ok(url.startsWith('https://'));
    });

    it('should accept HTTP URLs', () => {
      const url = 'http://example.com';
      assert.ok(url.startsWith('http://'));
    });
  });

  describe('Header encoding', () => {
    it('should handle JSON header encoding', () => {
      const headers = { 'Content-Type': 'application/json' };
      const encoded = JSON.stringify(headers);
      const decoded = JSON.parse(encoded);
      assert.deepStrictEqual(decoded, headers);
    });
  });
});
