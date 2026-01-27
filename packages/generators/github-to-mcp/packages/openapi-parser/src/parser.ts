/**
 * @fileoverview parser module implementation
 * Full support for OpenAPI 3.0, 3.1, and Swagger 2.0
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { z } from 'zod';

/**
 * OpenAPI 3.1 specific fields
 */
export interface OpenAPI31Extensions {
  webhooks?: Record<string, OpenAPIV3_1.PathItemObject>;
  jsonSchemaDialect?: string;
}

/**
 * Parses and validates OpenAPI/Swagger specifications
 * Supports OpenAPI 3.0, 3.1, and Swagger 2.0
 */
export class OpenApiParser {
  private spec: OpenAPIV3.Document | OpenAPIV3_1.Document | undefined = undefined;

  /**
   * Parse OpenAPI spec from file or URL
   */
  async parse(source: string): Promise<OpenAPIV3.Document | OpenAPIV3_1.Document> {
    try {
      // Use swagger-parser to handle all OpenAPI versions and resolve $ref
      const api = await SwaggerParser.validate(source);
      this.spec = api as OpenAPIV3.Document | OpenAPIV3_1.Document;
      return this.spec;
    } catch (error) {
      throw new Error(`Failed to parse OpenAPI spec: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse from object (already loaded)
   */
  parseObject(spec: OpenAPIV3.Document | OpenAPIV3_1.Document): OpenAPIV3.Document | OpenAPIV3_1.Document {
    this.spec = spec;
    return spec;
  }

  /**
   * Get parsed specification
   */
  getSpec(): OpenAPIV3.Document | OpenAPIV3_1.Document {
    if (!this.spec) {
      throw new Error('No spec parsed. Call parse() first.');
    }
    return this.spec;
  }

  /**
   * Check if this is OpenAPI 3.1
   */
  isVersion31(): boolean {
    const spec = this.getSpec();
    return 'openapi' in spec && spec.openapi.startsWith('3.1');
  }

  /**
   * Get API info
   */
  getInfo() {
    const spec = this.getSpec();
    return {
      title: spec.info.title,
      version: spec.info.version,
      description: spec.info.description,
      termsOfService: spec.info.termsOfService,
      contact: spec.info.contact,
      license: spec.info.license,
      summary: (spec.info as any).summary, // OpenAPI 3.1
    };
  }

  /**
   * Get all servers
   */
  getServers() {
    const spec = this.getSpec();
    return spec.servers || [];
  }

  /**
   * Get base URL (first server URL)
   */
  getBaseUrl(): string {
    const servers = this.getServers();
    if (servers.length === 0) {
      throw new Error('No servers defined in OpenAPI spec');
    }
    return servers[0].url;
  }

  /**
   * Get all paths
   */
  getPaths() {
    const spec = this.getSpec();
    return spec.paths || {};
  }

  /**
   * Get webhooks (OpenAPI 3.1)
   */
  getWebhooks(): Record<string, OpenAPIV3_1.PathItemObject> {
    const spec = this.getSpec() as any;
    return spec.webhooks || {};
  }

  /**
   * Get pathItems from components (OpenAPI 3.1)
   */
  getComponentPathItems(): Record<string, OpenAPIV3_1.PathItemObject> {
    const spec = this.getSpec() as any;
    return spec.components?.pathItems || {};
  }

  /**
   * Get all security schemes
   */
  getSecuritySchemes() {
    const spec = this.getSpec();
    if ('components' in spec && spec.components?.securitySchemes) {
      return spec.components.securitySchemes;
    }
    return {};
  }

  /**
   * Get all tags
   */
  getTags() {
    const spec = this.getSpec();
    return spec.tags || [];
  }

  /**
   * Get JSON Schema dialect (OpenAPI 3.1)
   */
  getJsonSchemaDialect(): string | undefined {
    const spec = this.getSpec() as any;
    return spec.jsonSchemaDialect;
  }

  /**
   * Validate spec structure
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.spec) {
      errors.push('No spec loaded');
      return { valid: false, errors };
    }

    // Check required fields
    if (!this.spec.info) {
      errors.push('Missing required field: info');
    }
    
    // In OpenAPI 3.1, paths is optional if webhooks is present
    if (!this.spec.paths && !('webhooks' in this.spec)) {
      errors.push('Missing required field: paths (or webhooks for 3.1)');
    }

    // Check OpenAPI version
    if ('openapi' in this.spec) {
      const version = this.spec.openapi;
      if (!version.startsWith('3.0') && !version.startsWith('3.1')) {
        errors.push(`Unsupported OpenAPI version: ${version}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get statistics about the spec
   */
  getStats() {
    const spec = this.getSpec();
    const paths = Object.keys(spec.paths || {});
    const webhooks = Object.keys(this.getWebhooks());
    const operations: string[] = [];
    const methods: Record<string, number> = {};
    const tags = new Set<string>();

    // Count operations from paths
    paths.forEach(path => {
      const pathItem = spec.paths?.[path];
      if (!pathItem) return;

      ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].forEach(method => {
        if (method in pathItem) {
          operations.push(method);
          methods[method.toUpperCase()] = (methods[method.toUpperCase()] || 0) + 1;

          const operation = (pathItem as any)[method];
          if (operation.tags) {
            operation.tags.forEach((tag: string) => tags.add(tag));
          }
        }
      });
    });

    // Count webhook operations (OpenAPI 3.1)
    const webhookOps = webhooks.length;

    return {
      paths: paths.length,
      operations: operations.length,
      webhooks: webhookOps,
      methods,
      tags: Array.from(tags),
      servers: this.getServers().length,
      securitySchemes: Object.keys(this.getSecuritySchemes()).length,
      isOpenAPI31: this.isVersion31(),
    };
  }
}
