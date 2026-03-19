/**
 * Tests for Extensions System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExtensionRegistry,
  createExtensionRegistry,
  globalRegistry,
  createExtensionData,
  getExtensionInfo,
  hasExtension,
  getExtensionNames,
  mergeExtensions,
  filterRegisteredExtensions,
  validateExtensions,
  defineExtension,
} from '../../src/extensions/index.js';
import type { Extension, ExtensionData } from '../../src/extensions/index.js';

describe('ExtensionRegistry', () => {
  let registry: ExtensionRegistry;

  beforeEach(() => {
    registry = new ExtensionRegistry();
  });

  describe('register', () => {
    it('should register an extension', () => {
      const extension: Extension = {
        name: 'receipts',
        description: 'Payment receipt generation',
      };

      registry.register(extension);
      expect(registry.has('receipts')).toBe(true);
    });

    it('should throw on duplicate registration', () => {
      registry.register({ name: 'test' });
      expect(() => registry.register({ name: 'test' })).toThrow(
        "Extension 'test' is already registered"
      );
    });

    it('should throw on invalid extension name', () => {
      expect(() => registry.register({ name: '' } as Extension)).toThrow(
        'Extension name is required'
      );
    });
  });

  describe('get', () => {
    it('should return registered extension', () => {
      const extension: Extension = {
        name: 'receipts',
        description: 'Payment receipts',
      };
      registry.register(extension);

      const retrieved = registry.get('receipts');
      expect(retrieved).toEqual(extension);
    });

    it('should return undefined for unknown extension', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered extension', () => {
      registry.register({ name: 'test' });
      expect(registry.has('test')).toBe(true);
    });

    it('should return false for unregistered extension', () => {
      expect(registry.has('unknown')).toBe(false);
    });
  });

  describe('getNames', () => {
    it('should return all registered extension names', () => {
      registry.register({ name: 'ext1' });
      registry.register({ name: 'ext2' });
      registry.register({ name: 'ext3' });

      const names = registry.getNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('ext1');
      expect(names).toContain('ext2');
      expect(names).toContain('ext3');
    });

    it('should return empty array when no extensions', () => {
      expect(registry.getNames()).toEqual([]);
    });
  });

  describe('validate', () => {
    it('should return valid for extension without schema', () => {
      registry.register({ name: 'noschema' });
      const result = registry.validate('noschema', { any: 'data' });
      expect(result.valid).toBe(true);
    });

    it('should return invalid for unregistered extension', () => {
      const result = registry.validate('unknown', {});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Extension 'unknown' is not registered");
    });

    it('should validate against schema - type check', () => {
      registry.register({
        name: 'typed',
        schema: { type: 'object' },
      });

      expect(registry.validate('typed', {}).valid).toBe(true);
      expect(registry.validate('typed', 'string').valid).toBe(false);
    });

    it('should validate against schema - required properties', () => {
      registry.register({
        name: 'required',
        schema: {
          type: 'object',
          properties: {
            format: { type: 'string' },
          },
          required: ['format'],
        },
      });

      expect(registry.validate('required', { format: 'pdf' }).valid).toBe(true);
      expect(registry.validate('required', {}).valid).toBe(false);
    });

    it('should validate against schema - enum values', () => {
      registry.register({
        name: 'enum',
        schema: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['pdf', 'json'] },
          },
        },
      });

      expect(registry.validate('enum', { format: 'pdf' }).valid).toBe(true);
      expect(registry.validate('enum', { format: 'xml' }).valid).toBe(false);
    });

    it('should validate against schema - string constraints', () => {
      registry.register({
        name: 'string',
        schema: {
          type: 'string',
          minLength: 2,
          maxLength: 10,
        },
      });

      expect(registry.validate('string', 'abc').valid).toBe(true);
      expect(registry.validate('string', 'a').valid).toBe(false);
      expect(registry.validate('string', 'a'.repeat(11)).valid).toBe(false);
    });

    it('should validate against schema - number constraints', () => {
      registry.register({
        name: 'number',
        schema: {
          type: 'number',
          minimum: 0,
          maximum: 100,
        },
      });

      expect(registry.validate('number', 50).valid).toBe(true);
      expect(registry.validate('number', -1).valid).toBe(false);
      expect(registry.validate('number', 101).valid).toBe(false);
    });

    it('should validate against schema - array items', () => {
      registry.register({
        name: 'array',
        schema: {
          type: 'array',
          items: { type: 'string' },
        },
      });

      expect(registry.validate('array', ['a', 'b', 'c']).valid).toBe(true);
      expect(registry.validate('array', ['a', 1, 'c']).valid).toBe(false);
    });

    it('should validate against schema - nested objects', () => {
      registry.register({
        name: 'nested',
        schema: {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
              },
              required: ['enabled'],
            },
          },
          required: ['config'],
        },
      });

      expect(
        registry.validate('nested', { config: { enabled: true } }).valid
      ).toBe(true);
      expect(registry.validate('nested', { config: {} }).valid).toBe(false);
      expect(registry.validate('nested', {}).valid).toBe(false);
    });
  });

  describe('unregister', () => {
    it('should remove registered extension', () => {
      registry.register({ name: 'test' });
      expect(registry.has('test')).toBe(true);

      const removed = registry.unregister('test');
      expect(removed).toBe(true);
      expect(registry.has('test')).toBe(false);
    });

    it('should return false for unregistered extension', () => {
      expect(registry.unregister('unknown')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all extensions', () => {
      registry.register({ name: 'ext1' });
      registry.register({ name: 'ext2' });
      expect(registry.getNames()).toHaveLength(2);

      registry.clear();
      expect(registry.getNames()).toHaveLength(0);
    });
  });
});

describe('createExtensionRegistry', () => {
  it('should create a new registry instance', () => {
    const registry = createExtensionRegistry();
    expect(registry).toBeInstanceOf(ExtensionRegistry);
  });
});

describe('globalRegistry', () => {
  it('should be an ExtensionRegistry instance', () => {
    expect(globalRegistry).toBeInstanceOf(ExtensionRegistry);
  });
});

describe('Extension Utilities', () => {
  describe('createExtensionData', () => {
    it('should create extension data', () => {
      const data = createExtensionData({
        name: 'receipts',
        info: { format: 'pdf' },
      });

      expect(data.info).toEqual({ format: 'pdf' });
    });

    it('should include schema from registry', () => {
      const registry = new ExtensionRegistry();
      registry.register({
        name: 'receipts',
        schema: { type: 'object' },
      });

      const data = createExtensionData(
        { name: 'receipts', info: {} },
        registry
      );

      expect(data.schema).toEqual({ type: 'object' });
    });

    it('should throw on validation failure', () => {
      const registry = new ExtensionRegistry();
      registry.register({
        name: 'receipts',
        schema: { type: 'object', required: ['format'] },
      });

      expect(() =>
        createExtensionData(
          { name: 'receipts', info: {}, validate: true },
          registry
        )
      ).toThrow('Extension data validation failed');
    });
  });

  describe('getExtensionInfo', () => {
    it('should extract info from ExtensionData', () => {
      const data: ExtensionData = {
        info: { format: 'pdf' },
      };

      const info = getExtensionInfo(data);
      expect(info).toEqual({ format: 'pdf' });
    });

    it('should return undefined for undefined data', () => {
      expect(getExtensionInfo(undefined)).toBeUndefined();
    });
  });

  describe('hasExtension', () => {
    it('should return true when extension exists', () => {
      const extensions = {
        receipts: { info: {} },
        metering: { info: {} },
      };

      expect(hasExtension(extensions, 'receipts')).toBe(true);
    });

    it('should return false when extension does not exist', () => {
      const extensions = { receipts: { info: {} } };
      expect(hasExtension(extensions, 'metering')).toBe(false);
    });

    it('should return false for undefined extensions', () => {
      expect(hasExtension(undefined, 'receipts')).toBe(false);
    });
  });

  describe('getExtensionNames', () => {
    it('should return extension names', () => {
      const extensions = {
        receipts: { info: {} },
        metering: { info: {} },
      };

      const names = getExtensionNames(extensions);
      expect(names).toEqual(['receipts', 'metering']);
    });

    it('should return empty array for undefined', () => {
      expect(getExtensionNames(undefined)).toEqual([]);
    });
  });

  describe('mergeExtensions', () => {
    it('should merge multiple extension records', () => {
      const ext1 = { receipts: { info: { format: 'pdf' } } };
      const ext2 = { metering: { info: { limit: 100 } } };

      const merged = mergeExtensions(ext1, ext2);
      expect(merged).toEqual({
        receipts: { info: { format: 'pdf' } },
        metering: { info: { limit: 100 } },
      });
    });

    it('should override with later sources', () => {
      const ext1 = { receipts: { info: { format: 'pdf' } } };
      const ext2 = { receipts: { info: { format: 'json' } } };

      const merged = mergeExtensions(ext1, ext2);
      expect(merged.receipts).toEqual({ info: { format: 'json' } });
    });

    it('should handle undefined sources', () => {
      const ext1 = { receipts: { info: {} } };
      const merged = mergeExtensions(ext1, undefined);
      expect(merged).toEqual({ receipts: { info: {} } });
    });
  });

  describe('filterRegisteredExtensions', () => {
    it('should filter to only registered extensions', () => {
      const registry = new ExtensionRegistry();
      registry.register({ name: 'receipts' });

      const extensions = {
        receipts: { info: {} },
        unknown: { info: {} },
      };

      const filtered = filterRegisteredExtensions(extensions, registry);
      expect(Object.keys(filtered)).toEqual(['receipts']);
    });

    it('should return empty for undefined extensions', () => {
      const registry = new ExtensionRegistry();
      expect(filterRegisteredExtensions(undefined, registry)).toEqual({});
    });
  });

  describe('validateExtensions', () => {
    it('should validate all extensions', () => {
      const registry = new ExtensionRegistry();
      registry.register({
        name: 'receipts',
        schema: { type: 'object' },
      });
      registry.register({
        name: 'metering',
        schema: { type: 'object', required: ['limit'] },
      });

      const extensions = {
        receipts: { info: {} },
        metering: { info: {} }, // Missing required 'limit'
      };

      const results = validateExtensions(extensions, registry);
      expect(results.receipts.valid).toBe(true);
      expect(results.metering.valid).toBe(false);
    });

    it('should handle extensions with raw info (not ExtensionData)', () => {
      const registry = new ExtensionRegistry();
      registry.register({
        name: 'simple',
        schema: { type: 'string' },
      });

      const extensions = {
        simple: 'raw string value',
      };

      const results = validateExtensions(extensions, registry);
      expect(results.simple.valid).toBe(true);
    });
  });

  describe('defineExtension', () => {
    it('should create an Extension definition', () => {
      const ext = defineExtension('receipts', {
        description: 'Payment receipts',
        schema: { type: 'object' },
      });

      expect(ext.name).toBe('receipts');
      expect(ext.description).toBe('Payment receipts');
      expect(ext.schema).toEqual({ type: 'object' });
    });

    it('should work with just name', () => {
      const ext = defineExtension('simple');
      expect(ext).toEqual({ name: 'simple' });
    });
  });
});
