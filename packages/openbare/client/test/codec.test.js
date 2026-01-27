/**
 * Codec Module Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as codec from '../src/codec.js';

describe('Codec Module', () => {
  describe('encodeUrl', () => {
    it('should encode URL', () => {
      const url = 'https://example.com/path?query=value';
      const encoded = codec.encodeUrl(url);
      assert.ok(encoded);
      assert.ok(typeof encoded === 'string');
      assert.notStrictEqual(encoded, url);
    });

    it('should handle special characters', () => {
      const url = 'https://example.com/path?q=hello world&foo=bar';
      const encoded = codec.encodeUrl(url);
      assert.ok(encoded);
    });
  });

  describe('decodeUrl', () => {
    it('should decode encoded URL back to original', () => {
      const original = 'https://example.com/path?query=value';
      const encoded = codec.encodeUrl(original);
      const decoded = codec.decodeUrl(encoded);
      assert.strictEqual(decoded, original);
    });

    it('should handle round-trip encoding', () => {
      const urls = [
        'https://google.com',
        'https://example.com/path/to/resource',
        'https://api.example.com/v1/users?page=1&limit=10',
        'http://localhost:3000/test',
      ];

      for (const url of urls) {
        const encoded = codec.encodeUrl(url);
        const decoded = codec.decodeUrl(encoded);
        assert.strictEqual(decoded, url, `Round-trip failed for: ${url}`);
      }
    });
  });

  describe('encodeHeaders', () => {
    it('should encode headers object', () => {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123'
      };
      const encoded = codec.encodeHeaders(headers);
      assert.ok(encoded);
      assert.ok(typeof encoded === 'string');
    });

    it('should handle empty headers', () => {
      const encoded = codec.encodeHeaders({});
      assert.ok(encoded);
    });
  });

  describe('decodeHeaders', () => {
    it('should decode headers back to object', () => {
      const original = {
        'Content-Type': 'application/json',
        'Accept': 'text/html'
      };
      const encoded = codec.encodeHeaders(original);
      const decoded = codec.decodeHeaders(encoded);
      // Headers are normalized to lowercase by the codec
      assert.deepStrictEqual(decoded, {
        'content-type': 'application/json',
        'accept': 'text/html'
      });
    });

    it('should handle round-trip with lowercase keys', () => {
      const original = {
        'content-type': 'text/plain',
        'x-custom-header': 'value'
      };
      const encoded = codec.encodeHeaders(original);
      const decoded = codec.decodeHeaders(encoded);
      assert.deepStrictEqual(decoded, original);
    });
  });
});
