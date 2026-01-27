/**
 * @fileoverview OpenAPI specification builder
 * Builds OpenAPI 3.1 specs from analyzed routes
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import {
  AnalyzedRoute,
  AnalysisResult,
  GeneratorOptions,
  JsonSchemaDefinition,
  OpenAPISpec,
} from './types.js';
import { OpenAPIV3_1 } from 'openapi-types';

/**
 * OpenAPI specification builder
 */
export class OpenApiBuilder {
  private options: Required<GeneratorOptions>;

  constructor(options: GeneratorOptions = {}) {
    this.options = {
      title: options.title || 'Generated API',
      description: options.description || 'API specification generated from source code',
      version: options.version || '1.0.0',
      baseUrl: options.baseUrl || 'http://localhost:3000',
      defaultTags: options.defaultTags || [],
      includeExamples: options.includeExamples ?? true,
      inferSchemas: options.inferSchemas ?? true,
      securitySchemes: options.securitySchemes || {},
      contact: options.contact || {},
      license: options.license || { name: 'MIT' },
      externalDocs: options.externalDocs || undefined,
      servers: options.servers || [{ url: options.baseUrl || 'http://localhost:3000' }],
    } as Required<GeneratorOptions>;
  }

  /**
   * Build OpenAPI specification from analysis result
   */
  build(result: AnalysisResult): OpenAPISpec {
    const spec: OpenAPISpec = {
      openapi: '3.1.0',
      info: this.buildInfo(),
      servers: this.buildServers(),
      paths: this.buildPaths(result.routes),
      components: this.buildComponents(result),
    };

    // Add external docs if provided
    if (this.options.externalDocs) {
      spec.externalDocs = this.options.externalDocs;
    }

    // Add tags from routes
    const tags = this.extractTags(result.routes);
    if (tags.length > 0) {
      spec.tags = tags;
    }

    // Add global security if security schemes are present
    if (Object.keys(result.securitySchemes).length > 0) {
      spec.security = [
        Object.fromEntries(
          Object.keys(result.securitySchemes).map(name => [name, []])
        ),
      ];
    }

    return spec;
  }

  /**
   * Build from multiple analysis results
   */
  buildFromMultiple(results: AnalysisResult[]): OpenAPISpec {
    const combinedRoutes: AnalyzedRoute[] = [];
    const combinedSchemas: Record<string, JsonSchemaDefinition> = {};
    const combinedSecurity: Record<string, OpenAPIV3_1.SecuritySchemeObject> = {};
    const allWarnings: string[] = [];
    const allErrors: string[] = [];
    const filesAnalyzed: string[] = [];

    for (const result of results) {
      combinedRoutes.push(...result.routes);
      Object.assign(combinedSchemas, result.schemas);
      Object.assign(combinedSecurity, result.securitySchemes);
      allWarnings.push(...result.warnings);
      allErrors.push(...result.errors);
      filesAnalyzed.push(...result.filesAnalyzed);
    }

    const combinedResult: AnalysisResult = {
      routes: combinedRoutes,
      schemas: combinedSchemas,
      securitySchemes: combinedSecurity,
      warnings: allWarnings,
      errors: allErrors,
      framework: results[0]?.framework || 'unknown',
      filesAnalyzed,
    };

    return this.build(combinedResult);
  }

  /**
   * Build info object
   */
  private buildInfo(): OpenAPIV3_1.InfoObject {
    const info: OpenAPIV3_1.InfoObject = {
      title: this.options.title,
      description: this.options.description,
      version: this.options.version,
    };

    if (this.options.contact && Object.keys(this.options.contact).length > 0) {
      info.contact = this.options.contact as OpenAPIV3_1.ContactObject;
    }

    if (this.options.license) {
      info.license = this.options.license as OpenAPIV3_1.LicenseObject;
    }

    return info;
  }

  /**
   * Build servers array
   */
  private buildServers(): OpenAPIV3_1.ServerObject[] {
    return this.options.servers.map(server => ({
      url: server.url,
      description: server.description,
      variables: server.variables as Record<string, OpenAPIV3_1.ServerVariableObject> | undefined,
    }));
  }

  /**
   * Build paths object
   */
  private buildPaths(routes: AnalyzedRoute[]): OpenAPIV3_1.PathsObject {
    const paths: OpenAPIV3_1.PathsObject = {};

    for (const route of routes) {
      const path = route.openApiPath;
      
      if (!paths[path]) {
        paths[path] = {};
      }

      const operation = this.buildOperation(route);
      (paths[path] as OpenAPIV3_1.PathItemObject)[route.method] = operation;
    }

    return paths;
  }

  /**
   * Build operation object
   */
  private buildOperation(route: AnalyzedRoute): OpenAPIV3_1.OperationObject {
    const operation: OpenAPIV3_1.OperationObject = {
      operationId: route.operationId,
      summary: route.summary,
      description: route.description,
      tags: route.tags,
      deprecated: route.deprecated || undefined,
      responses: this.buildResponses(route.responses),
    };

    // Add parameters
    const parameters = this.buildParameters(route);
    if (parameters.length > 0) {
      operation.parameters = parameters;
    }

    // Add request body
    if (route.requestBody) {
      operation.requestBody = this.buildRequestBody(route.requestBody);
    }

    // Add security if route has security requirements
    if (route.security && route.security.length > 0) {
      operation.security = route.security.map(s => ({ [s]: [] }));
    }

    return operation;
  }

  /**
   * Build parameters array
   */
  private buildParameters(route: AnalyzedRoute): OpenAPIV3_1.ParameterObject[] {
    const parameters: OpenAPIV3_1.ParameterObject[] = [];

    // Path parameters
    for (const param of route.pathParameters) {
      parameters.push(this.buildParameter(param, 'path'));
    }

    // Query parameters
    for (const param of route.queryParameters) {
      parameters.push(this.buildParameter(param, 'query'));
    }

    // Header parameters
    for (const param of route.headerParameters) {
      parameters.push(this.buildParameter(param, 'header'));
    }

    return parameters;
  }

  /**
   * Build parameter object
   */
  private buildParameter(
    param: { name: string; type: string; required: boolean; description?: string; format?: string; enum?: unknown[]; example?: unknown; defaultValue?: unknown },
    location: 'path' | 'query' | 'header' | 'cookie'
  ): OpenAPIV3_1.ParameterObject {
    const parameter: OpenAPIV3_1.ParameterObject = {
      name: param.name,
      in: location,
      required: location === 'path' ? true : param.required,
      description: param.description,
      schema: this.buildSchemaFromType(param.type, {
        format: param.format,
        enum: param.enum,
        default: param.defaultValue,
      }),
    };

    if (this.options.includeExamples && param.example !== undefined) {
      parameter.example = param.example;
    }

    return parameter;
  }

  /**
   * Build schema from type string
   */
  private buildSchemaFromType(
    type: string,
    options: { format?: string; enum?: unknown[]; default?: unknown } = {}
  ): OpenAPIV3_1.SchemaObject {
    const schema: OpenAPIV3_1.SchemaObject = {
      type: type as OpenAPIV3_1.NonArraySchemaObjectType,
    };

    if (options.format) {
      schema.format = options.format;
    }

    if (options.enum) {
      schema.enum = options.enum;
    }

    if (options.default !== undefined) {
      schema.default = options.default;
    }

    return schema;
  }

  /**
   * Build request body object
   */
  private buildRequestBody(body: { contentType: string; required: boolean; schema: JsonSchemaDefinition; description?: string; example?: unknown }): OpenAPIV3_1.RequestBodyObject {
    const requestBody: OpenAPIV3_1.RequestBodyObject = {
      description: body.description,
      required: body.required,
      content: {
        [body.contentType]: {
          schema: this.convertToOpenAPISchema(body.schema),
        },
      },
    };

    if (this.options.includeExamples && body.example !== undefined) {
      (requestBody.content[body.contentType] as OpenAPIV3_1.MediaTypeObject).example = body.example;
    }

    return requestBody;
  }

  /**
   * Build responses object
   */
  private buildResponses(responses: Array<{ statusCode: number; description: string; contentType?: string; schema?: JsonSchemaDefinition; example?: unknown }>): OpenAPIV3_1.ResponsesObject {
    const responsesObj: OpenAPIV3_1.ResponsesObject = {};

    for (const response of responses) {
      const responseObj: OpenAPIV3_1.ResponseObject = {
        description: response.description,
      };

      if (response.contentType && response.schema) {
        responseObj.content = {
          [response.contentType]: {
            schema: this.convertToOpenAPISchema(response.schema),
          },
        };

        if (this.options.includeExamples && response.example !== undefined) {
          (responseObj.content[response.contentType] as OpenAPIV3_1.MediaTypeObject).example = response.example;
        }
      }

      responsesObj[response.statusCode.toString()] = responseObj;
    }

    // Ensure there's at least one response
    if (Object.keys(responsesObj).length === 0) {
      responsesObj['200'] = { description: 'Successful response' };
    }

    return responsesObj;
  }

  /**
   * Build components object
   */
  private buildComponents(result: AnalysisResult): OpenAPIV3_1.ComponentsObject {
    const components: OpenAPIV3_1.ComponentsObject = {};

    // Add schemas
    if (Object.keys(result.schemas).length > 0) {
      components.schemas = {};
      for (const [name, schema] of Object.entries(result.schemas)) {
        components.schemas[name] = this.convertToOpenAPISchema(schema);
      }
    }

    // Add security schemes
    const allSecuritySchemes = {
      ...result.securitySchemes,
      ...this.options.securitySchemes,
    };

    if (Object.keys(allSecuritySchemes).length > 0) {
      components.securitySchemes = allSecuritySchemes;
    }

    return components;
  }

  /**
   * Convert internal schema to OpenAPI schema
   */
  private convertToOpenAPISchema(schema: JsonSchemaDefinition): OpenAPIV3_1.SchemaObject {
    const result: OpenAPIV3_1.SchemaObject = {};

    if (schema.$ref) {
      return { $ref: schema.$ref } as OpenAPIV3_1.SchemaObject;
    }

    if (schema.type) {
      if (Array.isArray(schema.type)) {
        // OpenAPI 3.1 supports type arrays for nullable
        result.type = schema.type as OpenAPIV3_1.NonArraySchemaObjectType[];
      } else {
        result.type = schema.type as OpenAPIV3_1.NonArraySchemaObjectType;
      }
    }

    if (schema.properties) {
      result.properties = {};
      for (const [name, prop] of Object.entries(schema.properties)) {
        result.properties[name] = this.convertToOpenAPISchema(prop);
      }
    }

    if (schema.required) {
      result.required = schema.required;
    }

    if (schema.items) {
      result.items = this.convertToOpenAPISchema(schema.items);
    }

    if (schema.description) {
      result.description = schema.description;
    }

    if (schema.enum) {
      result.enum = schema.enum;
    }

    if (schema.format) {
      result.format = schema.format;
    }

    if (schema.default !== undefined) {
      result.default = schema.default;
    }

    if (schema.nullable) {
      // In OpenAPI 3.1, use type array for nullable
      if (result.type && !Array.isArray(result.type)) {
        result.type = [result.type, 'null'] as OpenAPIV3_1.NonArraySchemaObjectType[];
      }
    }

    if (schema.oneOf) {
      result.oneOf = schema.oneOf.map(s => this.convertToOpenAPISchema(s));
    }

    if (schema.anyOf) {
      result.anyOf = schema.anyOf.map(s => this.convertToOpenAPISchema(s));
    }

    if (schema.allOf) {
      result.allOf = schema.allOf.map(s => this.convertToOpenAPISchema(s));
    }

    if (schema.additionalProperties !== undefined) {
      if (typeof schema.additionalProperties === 'boolean') {
        result.additionalProperties = schema.additionalProperties;
      } else {
        result.additionalProperties = this.convertToOpenAPISchema(schema.additionalProperties);
      }
    }

    // Numeric constraints
    if (schema.minimum !== undefined) result.minimum = schema.minimum;
    if (schema.maximum !== undefined) result.maximum = schema.maximum;
    
    // String constraints
    if (schema.minLength !== undefined) result.minLength = schema.minLength;
    if (schema.maxLength !== undefined) result.maxLength = schema.maxLength;
    if (schema.pattern !== undefined) result.pattern = schema.pattern;

    return result;
  }

  /**
   * Extract unique tags from routes
   */
  private extractTags(routes: AnalyzedRoute[]): OpenAPIV3_1.TagObject[] {
    const tagSet = new Set<string>();
    
    for (const route of routes) {
      if (route.tags) {
        for (const tag of route.tags) {
          tagSet.add(tag);
        }
      }
    }

    // Add default tags
    for (const tag of this.options.defaultTags) {
      tagSet.add(tag);
    }

    return Array.from(tagSet)
      .sort()
      .map(tag => ({ name: tag }));
  }

  /**
   * Serialize spec to JSON
   */
  toJSON(spec: OpenAPISpec): string {
    return JSON.stringify(spec, null, 2);
  }

  /**
   * Serialize spec to YAML
   */
  toYAML(spec: OpenAPISpec): string {
    // Simple YAML conversion - for production, use a proper YAML library
    return this.objectToYaml(spec, 0);
  }

  /**
   * Convert object to YAML string
   */
  private objectToYaml(obj: unknown, indent: number): string {
    const spaces = '  '.repeat(indent);
    
    if (obj === null || obj === undefined) {
      return 'null';
    }
    
    if (typeof obj === 'string') {
      // Check if string needs quoting
      if (obj.includes('\n') || obj.includes(':') || obj.includes('#') || obj.match(/^[\[\]{},]/)) {
        return `"${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
      }
      return obj;
    }
    
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      return obj
        .map(item => `\n${spaces}- ${this.objectToYaml(item, indent + 1).trimStart()}`)
        .join('');
    }
    
    if (typeof obj === 'object') {
      const entries = Object.entries(obj);
      if (entries.length === 0) return '{}';
      
      return entries
        .map(([key, value]) => {
          const valueYaml = this.objectToYaml(value, indent + 1);
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            return `\n${spaces}${key}:${valueYaml}`;
          }
          if (Array.isArray(value) && value.length > 0) {
            return `\n${spaces}${key}:${valueYaml}`;
          }
          return `\n${spaces}${key}: ${valueYaml}`;
        })
        .join('');
    }
    
    return String(obj);
  }
}
