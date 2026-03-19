/**
 * Extension utility functions
 * Spec compliance: x402 v2 - Extensions System
 */

import type { ExtensionData } from '../types/payment.js';
import type {
  Extension,
  IExtensionRegistry,
  CreateExtensionDataOptions,
} from './types.js';

/**
 * Create extension data for inclusion in PaymentRequired or PaymentPayload
 *
 * @param options - Options for creating extension data
 * @param registry - Optional registry for schema validation
 * @returns ExtensionData object
 * @throws Error if validation fails and validate option is true
 *
 * @example
 * ```typescript
 * const receiptExtension = createExtensionData({
 *   name: 'receipts',
 *   info: { format: 'pdf', email: 'user@example.com' },
 *   validate: true
 * }, registry);
 *
 * // Use in PaymentRequired
 * const paymentRequired: PaymentRequired = {
 *   // ...
 *   extensions: {
 *     receipts: receiptExtension
 *   }
 * };
 * ```
 */
export function createExtensionData(
  options: CreateExtensionDataOptions,
  registry?: IExtensionRegistry
): ExtensionData {
  const { name, info, validate = false } = options;

  // Get extension schema if registry provided and validation requested
  if (validate && registry) {
    const result = registry.validate(name, info);
    if (!result.valid) {
      throw new Error(
        `Extension data validation failed: ${result.errors?.join(', ') ?? 'unknown error'}`
      );
    }
  }

  // Get schema from registry if available
  const extension = registry?.get(name);
  const schema = extension?.schema;

  return {
    info,
    ...(schema ? { schema } : {}),
  };
}

/**
 * Extract extension info from ExtensionData
 *
 * @param data - Extension data object
 * @returns The info field from extension data
 *
 * @example
 * ```typescript
 * const info = getExtensionInfo(payload.extensions?.receipts);
 * ```
 */
export function getExtensionInfo(data: ExtensionData | undefined): unknown {
  return data?.info;
}

/**
 * Check if extensions contain a specific extension
 *
 * @param extensions - Extensions record from PaymentRequired or PaymentPayload
 * @param name - Extension name to check
 * @returns true if extension is present
 *
 * @example
 * ```typescript
 * if (hasExtension(paymentRequired.extensions, 'receipts')) {
 *   // Handle receipts extension
 * }
 * ```
 */
export function hasExtension(
  extensions: Record<string, unknown> | undefined,
  name: string
): boolean {
  return extensions !== undefined && name in extensions;
}

/**
 * Get all extension names from an extensions record
 *
 * @param extensions - Extensions record
 * @returns Array of extension names
 *
 * @example
 * ```typescript
 * const names = getExtensionNames(paymentRequired.extensions);
 * // ['receipts', 'metering']
 * ```
 */
export function getExtensionNames(
  extensions: Record<string, unknown> | undefined
): Array<string> {
  if (!extensions) return [];
  return Object.keys(extensions);
}

/**
 * Merge extensions from multiple sources
 *
 * Later sources override earlier ones for the same extension name.
 *
 * @param sources - Extension records to merge
 * @returns Merged extensions record
 *
 * @example
 * ```typescript
 * const merged = mergeExtensions(
 *   paymentRequired.extensions,
 *   userExtensions
 * );
 * ```
 */
export function mergeExtensions(
  ...sources: Array<Record<string, unknown> | undefined>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const source of sources) {
    if (source) {
      for (const [name, data] of Object.entries(source)) {
        result[name] = data;
      }
    }
  }

  return result;
}

/**
 * Filter extensions to only include registered ones
 *
 * @param extensions - Extensions record
 * @param registry - Extension registry
 * @returns Filtered extensions containing only registered extensions
 *
 * @example
 * ```typescript
 * const validExtensions = filterRegisteredExtensions(
 *   payload.extensions,
 *   registry
 * );
 * ```
 */
export function filterRegisteredExtensions(
  extensions: Record<string, unknown> | undefined,
  registry: IExtensionRegistry
): Record<string, unknown> {
  if (!extensions) return {};

  const result: Record<string, unknown> = {};

  for (const [name, data] of Object.entries(extensions)) {
    if (registry.has(name)) {
      result[name] = data;
    }
  }

  return result;
}

/**
 * Validate all extensions in an extensions record
 *
 * @param extensions - Extensions record to validate
 * @param registry - Extension registry for validation
 * @returns Object with validation results for each extension
 *
 * @example
 * ```typescript
 * const results = validateExtensions(payload.extensions, registry);
 * if (Object.values(results).every(r => r.valid)) {
 *   // All extensions valid
 * }
 * ```
 */
export function validateExtensions(
  extensions: Record<string, unknown> | undefined,
  registry: IExtensionRegistry
): Record<string, { valid: boolean; errors?: Array<string> }> {
  const results: Record<string, { valid: boolean; errors?: Array<string> }> =
    {};

  if (!extensions) return results;

  for (const [name, data] of Object.entries(extensions)) {
    // Extract info from ExtensionData if present
    const info =
      typeof data === 'object' && data !== null && 'info' in data
        ? (data as ExtensionData).info
        : data;

    results[name] = registry.validate(name, info);
  }

  return results;
}

/**
 * Create an Extension definition helper
 *
 * @param name - Extension name
 * @param options - Optional extension properties
 * @returns Extension definition
 *
 * @example
 * ```typescript
 * const receiptsExtension = defineExtension('receipts', {
 *   description: 'Payment receipt generation',
 *   schema: {
 *     type: 'object',
 *     properties: {
 *       format: { type: 'string', enum: ['pdf', 'json'] }
 *     }
 *   }
 * });
 *
 * registry.register(receiptsExtension);
 * ```
 */
export function defineExtension(
  name: string,
  options?: Omit<Extension, 'name'>
): Extension {
  return {
    name,
    ...options,
  };
}
