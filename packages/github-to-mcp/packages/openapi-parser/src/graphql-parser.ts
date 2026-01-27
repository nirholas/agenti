/**
 * @fileoverview GraphQL schema parser for extracting queries, mutations, and subscriptions
 * Supports SDL (Schema Definition Language) and introspection query results
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import {
  buildSchema,
  parse,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLField,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLEnumType,
  GraphQLScalarType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  isScalarType,
  isEnumType,
  isListType,
  isNonNullType,
  isInputObjectType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  buildClientSchema,
  IntrospectionQuery,
} from 'graphql';

export interface GraphQLToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  metadata: {
    operationType: 'query' | 'mutation' | 'subscription';
    returnType: string;
    deprecated?: boolean;
    deprecationReason?: string;
  };
}

export interface GraphQLParseResult {
  format: 'graphql';
  tools: GraphQLToolDefinition[];
  types: {
    queries: string[];
    mutations: string[];
    subscriptions: string[];
    inputTypes: string[];
    outputTypes: string[];
    enums: string[];
  };
}

/**
 * Parser for GraphQL schemas (SDL and Introspection)
 */
export class GraphQLParser {
  private schema: GraphQLSchema | null = null;

  /**
   * Parse GraphQL SDL (Schema Definition Language)
   */
  parseSDL(sdl: string): GraphQLSchema {
    try {
      this.schema = buildSchema(sdl);
      return this.schema;
    } catch (error) {
      throw new Error(`Failed to parse GraphQL SDL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse GraphQL Introspection Query result
   */
  parseIntrospection(introspection: IntrospectionQuery | { data: IntrospectionQuery }): GraphQLSchema {
    try {
      const data = 'data' in introspection ? introspection.data : introspection;
      this.schema = buildClientSchema(data);
      return this.schema;
    } catch (error) {
      throw new Error(`Failed to parse GraphQL introspection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse from string - auto-detect SDL or JSON introspection
   */
  parse(input: string): GraphQLSchema {
    const trimmed = input.trim();
    
    // Check if it's JSON (introspection result)
    if (trimmed.startsWith('{')) {
      try {
        const introspection = JSON.parse(trimmed);
        return this.parseIntrospection(introspection);
      } catch {
        // Not valid JSON, try SDL
      }
    }
    
    // Try SDL parsing
    return this.parseSDL(input);
  }

  /**
   * Get all queries as MCP tools
   */
  extractQueries(): GraphQLToolDefinition[] {
    if (!this.schema) {
      throw new Error('No schema parsed. Call parse() first.');
    }

    const queryType = this.schema.getQueryType();
    if (!queryType) return [];

    return this.extractFieldsAsTools(queryType, 'query');
  }

  /**
   * Get all mutations as MCP tools
   */
  extractMutations(): GraphQLToolDefinition[] {
    if (!this.schema) {
      throw new Error('No schema parsed. Call parse() first.');
    }

    const mutationType = this.schema.getMutationType();
    if (!mutationType) return [];

    return this.extractFieldsAsTools(mutationType, 'mutation');
  }

  /**
   * Get all subscriptions as MCP tools
   */
  extractSubscriptions(): GraphQLToolDefinition[] {
    if (!this.schema) {
      throw new Error('No schema parsed. Call parse() first.');
    }

    const subscriptionType = this.schema.getSubscriptionType();
    if (!subscriptionType) return [];

    return this.extractFieldsAsTools(subscriptionType, 'subscription');
  }

  /**
   * Extract all operations as MCP tools
   */
  toMcpTools(): GraphQLToolDefinition[] {
    return [
      ...this.extractQueries(),
      ...this.extractMutations(),
      ...this.extractSubscriptions(),
    ];
  }

  /**
   * Extract fields from a GraphQL type as MCP tools
   */
  private extractFieldsAsTools(
    type: GraphQLObjectType,
    operationType: 'query' | 'mutation' | 'subscription'
  ): GraphQLToolDefinition[] {
    const fields = type.getFields();
    const tools: GraphQLToolDefinition[] = [];

    for (const [fieldName, field] of Object.entries(fields)) {
      tools.push(this.fieldToTool(fieldName, field, operationType));
    }

    return tools;
  }

  /**
   * Convert a GraphQL field to an MCP tool
   */
  private fieldToTool(
    fieldName: string,
    field: GraphQLField<any, any>,
    operationType: 'query' | 'mutation' | 'subscription'
  ): GraphQLToolDefinition {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Extract arguments as input properties
    for (const arg of field.args) {
      const argSchema = this.typeToJsonSchema(arg.type);
      
      if (arg.description) {
        argSchema.description = arg.description;
      }
      if (arg.defaultValue !== undefined) {
        argSchema.default = arg.defaultValue;
      }

      properties[arg.name] = argSchema;

      // Check if argument is required (non-null without default)
      if (isNonNullType(arg.type) && arg.defaultValue === undefined) {
        required.push(arg.name);
      }
    }

    const deprecation = field.deprecationReason ? {
      deprecated: true,
      deprecationReason: field.deprecationReason,
    } : {};

    return {
      name: this.generateToolName(operationType, fieldName),
      description: field.description || `${operationType}: ${fieldName}`,
      inputSchema: {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      },
      metadata: {
        operationType,
        returnType: this.typeToString(field.type),
        ...deprecation,
      },
    };
  }

  /**
   * Convert GraphQL type to JSON Schema
   */
  private typeToJsonSchema(type: any): any {
    // Handle NonNull wrapper
    if (isNonNullType(type)) {
      return this.typeToJsonSchema(type.ofType);
    }

    // Handle List wrapper
    if (isListType(type)) {
      return {
        type: 'array',
        items: this.typeToJsonSchema(type.ofType),
      };
    }

    // Handle scalar types
    if (isScalarType(type)) {
      return this.scalarToJsonSchema(type);
    }

    // Handle enum types
    if (isEnumType(type)) {
      return this.enumToJsonSchema(type);
    }

    // Handle input object types
    if (isInputObjectType(type)) {
      return this.inputObjectToJsonSchema(type);
    }

    // Handle output object types (for return types)
    if (isObjectType(type)) {
      return { type: 'object', description: type.description || undefined };
    }

    // Handle interface types
    if (isInterfaceType(type)) {
      return { type: 'object', description: type.description || undefined };
    }

    // Handle union types
    if (isUnionType(type)) {
      return this.unionToJsonSchema(type);
    }

    return { type: 'string' };
  }

  /**
   * Convert GraphQL scalar to JSON Schema
   */
  private scalarToJsonSchema(type: GraphQLScalarType): any {
    const scalarMappings: Record<string, any> = {
      Int: { type: 'integer' },
      Float: { type: 'number' },
      String: { type: 'string' },
      Boolean: { type: 'boolean' },
      ID: { type: 'string' },
    };

    return scalarMappings[type.name] || { type: 'string', description: `Custom scalar: ${type.name}` };
  }

  /**
   * Convert GraphQL enum to JSON Schema
   */
  private enumToJsonSchema(type: GraphQLEnumType): any {
    const values = type.getValues();
    return {
      type: 'string',
      enum: values.map(v => v.value),
      description: type.description || undefined,
    };
  }

  /**
   * Convert GraphQL input object to JSON Schema
   */
  private inputObjectToJsonSchema(type: GraphQLInputObjectType): any {
    const fields = type.getFields();
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [fieldName, field] of Object.entries(fields)) {
      const fieldSchema = this.typeToJsonSchema(field.type);
      
      if (field.description) {
        fieldSchema.description = field.description;
      }
      if (field.defaultValue !== undefined) {
        fieldSchema.default = field.defaultValue;
      }

      properties[fieldName] = fieldSchema;

      if (isNonNullType(field.type) && field.defaultValue === undefined) {
        required.push(fieldName);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
      description: type.description || undefined,
    };
  }

  /**
   * Convert GraphQL union to JSON Schema
   */
  private unionToJsonSchema(type: GraphQLUnionType): any {
    const types = type.getTypes();
    return {
      oneOf: types.map(t => ({ type: 'object', description: t.description || t.name })),
      description: type.description || undefined,
    };
  }

  /**
   * Convert GraphQL type to string representation
   */
  private typeToString(type: any): string {
    if (isNonNullType(type)) {
      return `${this.typeToString(type.ofType)}!`;
    }
    if (isListType(type)) {
      return `[${this.typeToString(type.ofType)}]`;
    }
    return type.toString();
  }

  /**
   * Generate tool name from operation type and field name
   */
  private generateToolName(operationType: string, fieldName: string): string {
    // For queries, use the field name directly
    // For mutations, prefix with mutate_ or similar
    if (operationType === 'mutation') {
      return `mutate_${this.toSnakeCase(fieldName)}`;
    }
    if (operationType === 'subscription') {
      return `subscribe_${this.toSnakeCase(fieldName)}`;
    }
    return this.toSnakeCase(fieldName);
  }

  /**
   * Convert string to snake_case
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/[_-]+/g, '_')
      .replace(/^_/, '');
  }

  /**
   * Get type statistics
   */
  getTypeStats(): {
    queries: string[];
    mutations: string[];
    subscriptions: string[];
    inputTypes: string[];
    outputTypes: string[];
    enums: string[];
  } {
    if (!this.schema) {
      throw new Error('No schema parsed. Call parse() first.');
    }

    const typeMap = this.schema.getTypeMap();
    const inputTypes: string[] = [];
    const outputTypes: string[] = [];
    const enums: string[] = [];

    for (const [typeName, type] of Object.entries(typeMap)) {
      // Skip built-in types
      if (typeName.startsWith('__')) continue;

      if (isInputObjectType(type)) {
        inputTypes.push(typeName);
      } else if (isObjectType(type)) {
        outputTypes.push(typeName);
      } else if (isEnumType(type)) {
        enums.push(typeName);
      }
    }

    const queryType = this.schema.getQueryType();
    const mutationType = this.schema.getMutationType();
    const subscriptionType = this.schema.getSubscriptionType();

    return {
      queries: queryType ? Object.keys(queryType.getFields()) : [],
      mutations: mutationType ? Object.keys(mutationType.getFields()) : [],
      subscriptions: subscriptionType ? Object.keys(subscriptionType.getFields()) : [],
      inputTypes,
      outputTypes,
      enums,
    };
  }

  /**
   * Get complete parse result
   */
  getParseResult(): GraphQLParseResult {
    return {
      format: 'graphql',
      tools: this.toMcpTools(),
      types: this.getTypeStats(),
    };
  }
}

/**
 * Convenience function to parse GraphQL schema
 */
export function parseGraphQL(input: string): GraphQLParseResult {
  const parser = new GraphQLParser();
  parser.parse(input);
  return parser.getParseResult();
}
