/**
 * Tests for encoding utilities
 */

import { describe, it, expect } from 'vitest';
import {
  encodeBase64,
  decodeBase64,
  hexToFelt,
  feltToHex,
  normalizeAddress,
} from '../../src/utils/encoding.js';

describe('Encoding Utilities', () => {
  describe('encodeBase64', () => {
    it('should encode simple string to base64', () => {
      const encoded = encodeBase64('hello world');
      expect(encoded).toBe('aGVsbG8gd29ybGQ=');
    });

    it('should encode empty string', () => {
      const encoded = encodeBase64('');
      expect(encoded).toBe('');
    });

    it('should encode special characters', () => {
      const encoded = encodeBase64('Hello, 世界! 🌍');
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('should encode JSON string', () => {
      const json = JSON.stringify({ key: 'value', number: 42 });
      const encoded = encodeBase64(json);
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
    });
  });

  describe('decodeBase64', () => {
    it('should decode base64 string', () => {
      const decoded = decodeBase64('aGVsbG8gd29ybGQ=');
      expect(decoded).toBe('hello world');
    });

    it('should decode empty string', () => {
      const decoded = decodeBase64('');
      expect(decoded).toBe('');
    });

    it('should decode special characters', () => {
      const original = 'Hello, 世界! 🌍';
      const encoded = encodeBase64(original);
      const decoded = decodeBase64(encoded);
      expect(decoded).toBe(original);
    });

    it('should roundtrip encode/decode', () => {
      const original = 'This is a test string with numbers: 12345';
      const encoded = encodeBase64(original);
      const decoded = decodeBase64(encoded);
      expect(decoded).toBe(original);
    });
  });

  describe('hexToFelt', () => {
    it('should convert hex with 0x prefix to felt', () => {
      const felt = hexToFelt('0x1234');
      expect(felt).toBe('4660');
    });

    it('should convert hex without 0x prefix to felt', () => {
      const felt = hexToFelt('1234');
      expect(felt).toBe('4660');
    });

    it('should convert zero', () => {
      const felt = hexToFelt('0x0');
      expect(felt).toBe('0');
    });

    it('should convert large hex numbers', () => {
      const felt = hexToFelt(
        '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
      );
      expect(felt).toBe(
        '2087021424722619777119509474943472645767659996348769578120564519014510906823'
      );
    });

    it('should handle uppercase hex', () => {
      const felt = hexToFelt('0xABCD');
      expect(felt).toBe('43981');
    });
  });

  describe('feltToHex', () => {
    it('should convert felt string to hex', () => {
      const hex = feltToHex('4660');
      expect(hex).toBe('0x1234');
    });

    it('should convert felt bigint to hex', () => {
      const hex = feltToHex(BigInt(4660));
      expect(hex).toBe('0x1234');
    });

    it('should convert zero', () => {
      const hex = feltToHex('0');
      expect(hex).toBe('0x0');
    });

    it('should convert large felt numbers', () => {
      const hex = feltToHex(
        '2087021424722619777119509474943472645767659996348769578120564519014510906823'
      );
      // BigInt toString(16) doesn't include leading zeros
      expect(hex.toLowerCase()).toBe(
        '0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
      );
    });

    it('should roundtrip hex to felt to hex', () => {
      const original = '0x1234567890abcdef';
      const felt = hexToFelt(original);
      const hex = feltToHex(felt);
      expect(hex).toBe(original);
    });
  });

  describe('normalizeAddress', () => {
    it('should normalize address with leading zeros', () => {
      const normalized = normalizeAddress('0x0001');
      expect(normalized).toBe('0x1');
    });

    it('should normalize address without 0x prefix', () => {
      const normalized = normalizeAddress('1234');
      expect(normalized).toBe('0x1234');
    });

    it('should normalize uppercase address to lowercase', () => {
      const normalized = normalizeAddress('0xABCD');
      expect(normalized).toBe('0xabcd');
    });

    it('should normalize address with mixed case', () => {
      const normalized = normalizeAddress('0xAbCdEf');
      expect(normalized).toBe('0xabcdef');
    });

    it('should handle already normalized address', () => {
      const normalized = normalizeAddress('0x1234');
      expect(normalized).toBe('0x1234');
    });

    it('should handle zero address', () => {
      const normalized = normalizeAddress('0x0');
      expect(normalized).toBe('0x0');
    });

    it('should handle long addresses', () => {
      const address =
        '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
      const normalized = normalizeAddress(address);
      // Leading zeros are stripped by BigInt conversion
      expect(normalized).toBe(
        '0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
      );
    });

    it('should handle empty string', () => {
      const normalized = normalizeAddress('');
      expect(normalized).toBe('');
    });

    it('should handle invalid address gracefully', () => {
      const normalized = normalizeAddress('not-a-hex');
      expect(normalized).toBe('not-a-hex');
    });

    it('should be idempotent', () => {
      const address = '0x00123ABC';
      const normalized1 = normalizeAddress(address);
      const normalized2 = normalizeAddress(normalized1);
      expect(normalized1).toBe(normalized2);
    });
  });
});
