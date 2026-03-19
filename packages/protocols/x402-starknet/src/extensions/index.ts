/**
 * Extensions system module
 * Spec compliance: x402 v2 - Extensions System
 * @module extensions
 */

// Types
export type {
  Extension,
  IExtensionRegistry,
  ValidationResult,
  JSONSchema,
  CreateExtensionDataOptions,
  ExtensionData,
} from './types.js';

// Registry
export {
  ExtensionRegistry,
  createExtensionRegistry,
  globalRegistry,
} from './registry.js';

// Utilities
export {
  createExtensionData,
  getExtensionInfo,
  hasExtension,
  getExtensionNames,
  mergeExtensions,
  filterRegisteredExtensions,
  validateExtensions,
  defineExtension,
} from './utils.js';
