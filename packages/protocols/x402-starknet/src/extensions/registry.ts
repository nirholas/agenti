/**
 * Extension registry implementation
 * Spec compliance: x402 v2 - Extensions System
 */

import type {
  Extension,
  IExtensionRegistry,
  ValidationResult,
  JSONSchema,
} from './types.js';
import { err } from '../errors.js';

/**
 * Registry for managing x402 protocol extensions
 *
 * The extension registry allows registering, retrieving, and validating
 * extensions used in payment flows.
 *
 * @example
 * ```typescript
 * const registry = new ExtensionRegistry();
 *
 * // Register an extension
 * registry.register({
 *   name: 'receipts',
 *   description: 'Payment receipt generation',
 *   schema: {
 *     type: 'object',
 *     properties: {
 *       format: { type: 'string', enum: ['pdf', 'json'] }
 *     }
 *   }
 * });
 *
 * // Validate extension data
 * const result = registry.validate('receipts', { format: 'pdf' });
 * if (result.valid) {
 *   console.log('Extension data is valid');
 * }
 * ```
 */
export class ExtensionRegistry implements IExtensionRegistry {
  private readonly extensions = new Map<string, Extension>();

  /**
   * Register an extension
   * @throws Error if extension with same name already exists
   */
  register(extension: Extension): void {
    if (!extension.name || typeof extension.name !== 'string') {
      throw err.invalid('Extension name is required and must be a string');
    }

    if (this.extensions.has(extension.name)) {
      throw err.conflict(`Extension '${extension.name}' is already registered`);
    }

    this.extensions.set(extension.name, { ...extension });
  }

  /**
   * Get an extension by name
   */
  get(name: string): Extension | undefined {
    return this.extensions.get(name);
  }

  /**
   * Check if an extension is registered
   */
  has(name: string): boolean {
    return this.extensions.has(name);
  }

  /**
   * Get all registered extension names
   */
  getNames(): Array<string> {
    return Array.from(this.extensions.keys());
  }

  /**
   * Validate extension data against its schema
   *
   * If the extension has no schema, validation always passes.
   * Uses a simple JSON Schema validator for basic validation.
   */
  validate(name: string, data: unknown): ValidationResult {
    const extension = this.extensions.get(name);

    if (!extension) {
      return {
        valid: false,
        errors: [`Extension '${name}' is not registered`],
      };
    }

    // No schema means any data is valid
    if (!extension.schema) {
      return { valid: true };
    }

    return validateAgainstSchema(data, extension.schema);
  }

  /**
   * Unregister an extension
   */
  unregister(name: string): boolean {
    return this.extensions.delete(name);
  }

  /**
   * Clear all registered extensions
   */
  clear(): void {
    this.extensions.clear();
  }
}

/**
 * Simple JSON Schema validator
 *
 * This is a basic implementation that handles common schema patterns.
 * For production use with complex schemas, consider using a full
 * JSON Schema library like ajv.
 */
function validateAgainstSchema(
  data: unknown,
  schema: JSONSchema,
  path = ''
): ValidationResult {
  const errors: Array<string> = [];

  // Type validation
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = getJsonType(data);

    if (!types.includes(actualType)) {
      errors.push(
        `${path || 'value'}: expected type ${types.join(' or ')}, got ${actualType}`
      );
      return { valid: false, errors };
    }
  }

  // Const validation
  if (schema.const !== undefined) {
    if (!deepEqual(data, schema.const)) {
      errors.push(
        `${path || 'value'}: expected constant ${JSON.stringify(schema.const)}`
      );
    }
  }

  // Enum validation
  if (schema.enum !== undefined) {
    if (!schema.enum.some((v) => deepEqual(data, v))) {
      errors.push(
        `${path || 'value'}: must be one of ${JSON.stringify(schema.enum)}`
      );
    }
  }

  // String validations
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(
        `${path || 'value'}: string length must be >= ${String(schema.minLength)}`
      );
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push(
        `${path || 'value'}: string length must be <= ${String(schema.maxLength)}`
      );
    }
    if (schema.pattern !== undefined) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(data)) {
        errors.push(`${path || 'value'}: must match pattern ${schema.pattern}`);
      }
    }
  }

  // Number validations
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push(`${path || 'value'}: must be >= ${String(schema.minimum)}`);
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push(`${path || 'value'}: must be <= ${String(schema.maximum)}`);
    }
  }

  // Object validations
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;

    // Required properties
    if (schema.required !== undefined) {
      for (const prop of schema.required) {
        if (!(prop in obj)) {
          errors.push(
            `${path || 'object'}: missing required property '${prop}'`
          );
        }
      }
    }

    // Property validations
    if (schema.properties !== undefined) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (prop in obj) {
          const propPath = path ? `${path}.${prop}` : prop;
          const result = validateAgainstSchema(obj[prop], propSchema, propPath);
          if (!result.valid && result.errors) {
            errors.push(...result.errors);
          }
        }
      }
    }

    // Additional properties
    if (schema.additionalProperties === false && schema.properties) {
      const allowedProps = new Set(Object.keys(schema.properties));
      for (const prop of Object.keys(obj)) {
        if (!allowedProps.has(prop)) {
          errors.push(`${path || 'object'}: unexpected property '${prop}'`);
        }
      }
    }
  }

  // Array validations
  if (Array.isArray(data)) {
    if (schema.items !== undefined) {
      for (let i = 0; i < data.length; i++) {
        const itemPath = path ? `${path}[${String(i)}]` : `[${String(i)}]`;
        const result = validateAgainstSchema(data[i], schema.items, itemPath);
        if (!result.valid && result.errors) {
          errors.push(...result.errors);
        }
      }
    }
  }

  if (errors.length === 0) {
    return { valid: true };
  }

  return {
    valid: false,
    errors,
  };
}

/**
 * Get JSON Schema type name for a value
 */
function getJsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Deep equality check for primitive values and simple objects
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;

  if (typeof a === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((v, i) => deepEqual(v, b[i]));
    }

    if (!Array.isArray(a) && !Array.isArray(b)) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b as object);
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key) =>
        deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      );
    }
  }

  return false;
}

/**
 * Global extension registry instance
 *
 * This singleton instance can be used throughout the application
 * for consistent extension management.
 */
export const globalRegistry = new ExtensionRegistry();

/**
 * Create a new extension registry instance
 *
 * @returns New ExtensionRegistry instance
 *
 * @example
 * ```typescript
 * const registry = createExtensionRegistry();
 * registry.register({ name: 'my-extension' });
 * ```
 */
export function createExtensionRegistry(): IExtensionRegistry {
  return new ExtensionRegistry();
}
