/**
 * Extension system types for x402 protocol
 * Spec compliance: x402 v2 - Extensions System
 */

import type { ExtensionData } from '../types/payment.js';

/**
 * JSON Schema type for extension validation
 * This is a simplified subset of JSON Schema Draft-07
 */
export interface JSONSchema {
  type?: string | Array<string>;
  properties?: Record<string, JSONSchema>;
  required?: Array<string>;
  items?: JSONSchema;
  enum?: Array<unknown>;
  const?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | JSONSchema;
  description?: string;
  default?: unknown;
  [key: string]: unknown;
}

/**
 * Extension definition
 * Spec compliance: x402 v2 - Extensions System
 */
export interface Extension {
  /** Unique name of the extension (e.g., "receipts", "metering") */
  name: string;
  /** Extension version (semver) */
  version?: string;
  /** Human-readable description */
  description?: string;
  /** Default extension info/configuration */
  defaultInfo?: unknown;
  /** JSON Schema for validating extension data */
  schema?: JSONSchema;
}

/**
 * Extension registry interface
 * Provides methods for registering and retrieving extensions
 */
export interface IExtensionRegistry {
  /**
   * Register an extension
   * @param extension - Extension to register
   * @throws Error if extension with same name already exists
   */
  register(extension: Extension): void;

  /**
   * Get an extension by name
   * @param name - Extension name
   * @returns Extension or undefined if not found
   */
  get(name: string): Extension | undefined;

  /**
   * Check if an extension is registered
   * @param name - Extension name
   * @returns true if extension is registered
   */
  has(name: string): boolean;

  /**
   * Get all registered extension names
   * @returns Array of extension names
   */
  getNames(): Array<string>;

  /**
   * Validate extension data against its schema
   * @param name - Extension name
   * @param data - Data to validate
   * @returns Validation result
   */
  validate(name: string, data: unknown): ValidationResult;

  /**
   * Unregister an extension
   * @param name - Extension name
   * @returns true if extension was removed
   */
  unregister(name: string): boolean;

  /**
   * Clear all registered extensions
   */
  clear(): void;
}

/**
 * Result of extension data validation
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors if any */
  errors?: Array<string>;
}

/**
 * Options for creating extension data
 */
export interface CreateExtensionDataOptions {
  /** Extension name */
  name: string;
  /** Extension-specific information */
  info: unknown;
  /** Whether to validate against schema */
  validate?: boolean;
}

/**
 * Re-export ExtensionData from payment types
 */
export type { ExtensionData };
