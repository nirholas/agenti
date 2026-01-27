/**
 * @fileoverview Reference resolver for multi-file specifications
 * Handles $ref resolution for OpenAPI specs split across multiple files
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface RefResolverOptions {
  /** Base directory for relative file paths */
  baseDir?: string;
  /** Cache resolved schemas */
  cache?: boolean;
  /** Maximum depth for circular reference detection */
  maxDepth?: number;
  /** Custom fetch function for URL references */
  fetchFn?: (url: string) => Promise<string>;
}

export interface ResolvedSpec {
  spec: any;
  resolved: Map<string, any>;
  unresolved: string[];
  errors: Array<{ ref: string; error: string }>;
}

/**
 * Reference resolver for multi-file specifications
 */
export class RefResolver {
  private cache: Map<string, any> = new Map();
  private resolving: Set<string> = new Set();
  private options: RefResolverOptions;

  constructor(options: RefResolverOptions = {}) {
    this.options = {
      cache: true,
      maxDepth: 100,
      ...options,
    };
  }

  /**
   * Resolve a single $ref
   */
  async resolve(ref: string, baseUri: string): Promise<any> {
    const absoluteRef = this.toAbsoluteRef(ref, baseUri);

    // Check cache
    if (this.options.cache && this.cache.has(absoluteRef)) {
      return this.cache.get(absoluteRef);
    }

    // Check for circular reference
    if (this.resolving.has(absoluteRef)) {
      return { $circularRef: absoluteRef };
    }

    this.resolving.add(absoluteRef);

    try {
      const result = await this.fetchAndResolve(absoluteRef);
      
      if (this.options.cache) {
        this.cache.set(absoluteRef, result);
      }

      return result;
    } finally {
      this.resolving.delete(absoluteRef);
    }
  }

  /**
   * Resolve all $ref in a specification
   */
  async resolveAll(spec: any, baseUri: string = ''): Promise<ResolvedSpec> {
    const resolved = new Map<string, any>();
    const unresolved: string[] = [];
    const errors: Array<{ ref: string; error: string }> = [];

    const resolvedSpec = await this.resolveObject(
      spec,
      baseUri,
      0,
      resolved,
      unresolved,
      errors
    );

    return {
      spec: resolvedSpec,
      resolved,
      unresolved,
      errors,
    };
  }

  /**
   * Recursively resolve $ref in an object
   */
  private async resolveObject(
    obj: any,
    baseUri: string,
    depth: number,
    resolved: Map<string, any>,
    unresolved: string[],
    errors: Array<{ ref: string; error: string }>
  ): Promise<any> {
    if (depth > (this.options.maxDepth || 100)) {
      throw new Error(`Maximum reference depth exceeded at ${baseUri}`);
    }

    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return Promise.all(
        obj.map(item => this.resolveObject(item, baseUri, depth + 1, resolved, unresolved, errors))
      );
    }

    // Handle $ref
    if ('$ref' in obj && typeof obj.$ref === 'string') {
      const ref = obj.$ref;

      // Handle local references
      if (ref.startsWith('#')) {
        return obj; // Let the parser handle local refs
      }

      try {
        const resolvedValue = await this.resolve(ref, baseUri);
        resolved.set(ref, resolvedValue);
        
        // Merge with any additional properties
        const { $ref, ...rest } = obj;
        if (Object.keys(rest).length > 0) {
          return { ...resolvedValue, ...rest };
        }
        return resolvedValue;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ ref, error: errorMsg });
        unresolved.push(ref);
        return obj;
      }
    }

    // Recursively resolve nested objects
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = await this.resolveObject(value, baseUri, depth + 1, resolved, unresolved, errors);
    }

    return result;
  }

  /**
   * Convert relative reference to absolute
   */
  private toAbsoluteRef(ref: string, baseUri: string): string {
    // Already absolute URL
    if (ref.startsWith('http://') || ref.startsWith('https://')) {
      return ref;
    }

    // Already absolute path
    if (ref.startsWith('/')) {
      return ref;
    }

    // Relative to base
    if (baseUri.startsWith('http://') || baseUri.startsWith('https://')) {
      return new URL(ref, baseUri).toString();
    }

    // File path
    const baseDir = this.options.baseDir || (baseUri ? path.dirname(baseUri) : process.cwd());
    return path.resolve(baseDir, ref);
  }

  /**
   * Fetch and resolve a reference
   */
  private async fetchAndResolve(absoluteRef: string): Promise<any> {
    // Split reference into file and JSON pointer
    const [filePath, pointer] = this.splitRef(absoluteRef);
    
    // Fetch the file
    const content = await this.fetchContent(filePath);
    
    // Parse content
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = yaml.load(content);
    }

    // Apply JSON pointer if present
    if (pointer) {
      return this.resolvePointer(parsed, pointer);
    }

    return parsed;
  }

  /**
   * Split reference into file path and JSON pointer
   */
  private splitRef(ref: string): [string, string | null] {
    const hashIndex = ref.indexOf('#');
    if (hashIndex === -1) {
      return [ref, null];
    }
    return [ref.substring(0, hashIndex), ref.substring(hashIndex + 1)];
  }

  /**
   * Fetch content from file or URL
   * Note: URL fetching requires Node.js 18+ or a polyfill. 
   * For older Node.js versions, provide a custom fetchFn in options.
   */
  private async fetchContent(location: string): Promise<string> {
    // URL
    if (location.startsWith('http://') || location.startsWith('https://')) {
      if (this.options.fetchFn) {
        return this.options.fetchFn(location);
      }
      // Use global fetch (available in Node.js 18+)
      if (typeof fetch === 'undefined') {
        throw new Error(
          `Cannot fetch URL "${location}": fetch is not available. ` +
          `Use Node.js 18+ or provide a custom fetchFn in options.`
        );
      }
      const response = await fetch(location);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${location}: ${response.status} ${response.statusText}`);
      }
      return response.text();
    }

    // File
    return fs.readFile(location, 'utf-8');
  }

  /**
   * Resolve JSON pointer within an object
   */
  private resolvePointer(obj: any, pointer: string): any {
    if (!pointer || pointer === '/') {
      return obj;
    }

    const parts = pointer.split('/').filter(Boolean);
    let current = obj;

    for (const part of parts) {
      // Unescape JSON pointer encoding
      const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
      
      if (current === null || typeof current !== 'object') {
        throw new Error(`Cannot resolve pointer ${pointer}: path not found at ${key}`);
      }

      if (Array.isArray(current)) {
        const index = parseInt(key, 10);
        if (isNaN(index) || index < 0 || index >= current.length) {
          throw new Error(`Invalid array index in pointer: ${key}`);
        }
        current = current[index];
      } else {
        if (!(key in current)) {
          throw new Error(`Cannot resolve pointer ${pointer}: key ${key} not found`);
        }
        current = current[key];
      }
    }

    return current;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache contents
   */
  getCache(): Map<string, any> {
    return new Map(this.cache);
  }
}

/**
 * Convenience function to resolve all references in a spec
 */
export async function resolveRefs(
  spec: any,
  options?: RefResolverOptions & { baseUri?: string }
): Promise<ResolvedSpec> {
  const resolver = new RefResolver(options);
  return resolver.resolveAll(spec, options?.baseUri);
}
