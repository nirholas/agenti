/**
 * @fileoverview GraphQL schema parser and tool extractor
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { ExtractedTool, GraphQLSchema, GraphQLOperation, GraphQLArg, GraphQLType } from './types';

/**
 * Parse GraphQL schema and extract tool definitions
 */
export class GraphQLExtractor {
  /**
   * Parse a GraphQL schema string into structured format
   */
  parseSchema(schemaContent: string): GraphQLSchema {
    const schema: GraphQLSchema = {
      queries: [],
      mutations: [],
      subscriptions: [],
      types: {}
    };

    // Parse type definitions
    const typeMatches = schemaContent.matchAll(
      /type\s+(\w+)\s*(?:implements\s+[\w\s,&]+)?\s*\{([^}]+)\}/g
    );
    for (const match of typeMatches) {
      const typeName = match[1];
      const fieldsBlock = match[2];
      
      if (typeName === 'Query') {
        schema.queries = this.parseOperations(fieldsBlock);
      } else if (typeName === 'Mutation') {
        schema.mutations = this.parseOperations(fieldsBlock);
      } else if (typeName === 'Subscription') {
        schema.subscriptions = this.parseOperations(fieldsBlock);
      } else {
        schema.types[typeName] = this.parseType(typeName, fieldsBlock);
      }
    }

    // Parse input types
    const inputMatches = schemaContent.matchAll(
      /input\s+(\w+)\s*\{([^}]+)\}/g
    );
    for (const match of inputMatches) {
      schema.types[match[1]] = {
        name: match[1],
        kind: 'input',
        fields: this.parseFields(match[2])
      };
    }

    // Parse enums
    const enumMatches = schemaContent.matchAll(
      /enum\s+(\w+)\s*\{([^}]+)\}/g
    );
    for (const match of enumMatches) {
      const values = match[2].split('\n')
        .map(v => v.trim())
        .filter(v => v && !v.startsWith('#'));
      schema.types[match[1]] = {
        name: match[1],
        kind: 'enum',
        values
      };
    }

    return schema;
  }

  /**
   * Parse operations from a Query/Mutation block
   */
  private parseOperations(block: string): GraphQLOperation[] {
    const operations: GraphQLOperation[] = [];
    
    // First normalize - collapse multiline into single line per operation
    // Split by lines but track parenthesis depth
    let currentOp = '';
    let parenDepth = 0;
    let currentDescription = '';
    
    const lines = block.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Capture description comments
      if (trimmed.startsWith('#') || (trimmed.startsWith('"') && !currentOp)) {
        currentDescription = trimmed.replace(/^[#"]+\s*/, '').replace(/"$/, '');
        continue;
      }
      
      currentOp += ' ' + trimmed;
      
      for (const char of trimmed) {
        if (char === '(') parenDepth++;
        if (char === ')') parenDepth--;
      }
      
      // If we've closed all parens and see a return type, parse the operation
      if (parenDepth === 0 && currentOp.includes(':')) {
        const opMatch = currentOp.trim().match(/(\w+)\s*(?:\(([^)]*)\))?\s*:\s*(.+)/);
        if (opMatch) {
          const [, name, argsContent, returnType] = opMatch;
          const args = argsContent ? this.parseArgsContent(argsContent) : [];
          
          operations.push({
            name,
            description: currentDescription || `GraphQL ${name} operation`,
            args,
            returnType: returnType.trim()
          });
          currentDescription = '';
        }
        currentOp = '';
      }
    }
    
    return operations;
  }
  
  /**
   * Parse args content directly (already stripped of parentheses)
   */
  private parseArgsContent(content: string): GraphQLArg[] {
    const args: GraphQLArg[] = [];
    const argStrings = this.splitArgs(content);
    
    for (const argStr of argStrings) {
      const match = argStr.trim().match(/(\w+)\s*:\s*(.+)/);
      if (match) {
        const [, name, typeStr] = match;
        const required = typeStr.includes('!');
        const type = typeStr.replace(/!/g, '').trim();
        
        args.push({ name, type, required });
      }
    }
    
    return args;
  }

  /**
   * Parse arguments from (arg1: Type!, arg2: Type)
   */
  private parseArgs(argsBlock: string): GraphQLArg[] {
    const args: GraphQLArg[] = [];
    const content = argsBlock.replace(/^\(|\)$/g, '');
    
    // Split by comma, handling nested types
    const argStrings = this.splitArgs(content);
    
    for (const argStr of argStrings) {
      const match = argStr.trim().match(/(\w+)\s*:\s*(.+)/);
      if (match) {
        const [, name, typeStr] = match;
        const required = typeStr.includes('!');
        const type = typeStr.replace(/!/g, '').trim();
        
        args.push({ name, type, required });
      }
    }
    
    return args;
  }

  /**
   * Split args handling nested brackets
   */
  private splitArgs(content: string): string[] {
    const args: string[] = [];
    let depth = 0;
    let current = '';
    
    for (const char of content) {
      if (char === '[' || char === '(') depth++;
      if (char === ']' || char === ')') depth--;
      if (char === ',' && depth === 0) {
        args.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) args.push(current);
    return args;
  }

  /**
   * Parse a type definition
   */
  private parseType(name: string, fieldsBlock: string): GraphQLType {
    return {
      name,
      kind: 'object',
      fields: this.parseFields(fieldsBlock)
    };
  }

  /**
   * Parse fields from a type block
   */
  private parseFields(block: string): Array<{ name: string; type: string; description?: string }> {
    const fields: Array<{ name: string; type: string; description?: string }> = [];
    const lines = block.split('\n');
    
    let currentDescription = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('#') || trimmed.startsWith('"')) {
        currentDescription = trimmed.replace(/^[#"]+\s*/, '').replace(/"$/, '');
        continue;
      }
      
      const fieldMatch = trimmed.match(/(\w+)\s*(?:\([^)]*\))?\s*:\s*(.+)/);
      if (fieldMatch) {
        fields.push({
          name: fieldMatch[1],
          type: fieldMatch[2].trim(),
          description: currentDescription || undefined
        });
        currentDescription = '';
      }
    }
    
    return fields;
  }

  /**
   * Convert GraphQL schema to MCP tools
   */
  schemaToTools(schema: GraphQLSchema, endpoint: string, owner: string, repo: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];

    // Convert queries
    for (const query of schema.queries) {
      tools.push(this.operationToTool(query, 'query', endpoint, owner, repo));
    }

    // Convert mutations
    for (const mutation of schema.mutations) {
      tools.push(this.operationToTool(mutation, 'mutation', endpoint, owner, repo));
    }

    return tools;
  }

  /**
   * Convert a single GraphQL operation to an MCP tool
   */
  private operationToTool(
    op: GraphQLOperation, 
    opType: 'query' | 'mutation',
    endpoint: string,
    owner: string,
    repo: string
  ): ExtractedTool {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const arg of op.args) {
      properties[arg.name] = {
        type: this.graphqlTypeToJsonType(arg.type),
        description: arg.description || `${arg.name} parameter`
      };
      if (arg.required) {
        required.push(arg.name);
      }
    }

    const implementation = this.generateImplementation(op, opType, endpoint);

    return {
      name: `graphql_${op.name}`,
      description: op.description || `GraphQL ${opType}: ${op.name}`,
      inputSchema: {
        type: 'object',
        properties,
        required
      },
      implementation,
      source: {
        type: 'graphql',
        file: `${owner}/${repo}/schema.graphql`
      }
    };
  }

  /**
   * Map GraphQL types to JSON Schema types
   */
  private graphqlTypeToJsonType(gqlType: string): string {
    const baseType = gqlType.replace(/[\[\]!]/g, '').trim();
    
    const typeMap: Record<string, string> = {
      'String': 'string',
      'Int': 'integer',
      'Float': 'number',
      'Boolean': 'boolean',
      'ID': 'string'
    };

    if (gqlType.startsWith('[')) {
      return 'array';
    }

    return typeMap[baseType] || 'string';
  }

  /**
   * Generate implementation code for a GraphQL operation
   */
  private generateImplementation(
    op: GraphQLOperation, 
    opType: 'query' | 'mutation',
    endpoint: string
  ): string {
    const argsStr = op.args.map(a => `$${a.name}: ${a.type}${a.required ? '!' : ''}`).join(', ');
    const varsStr = op.args.map(a => `${a.name}: $${a.name}`).join(', ');
    
    const query = opType === 'query' 
      ? `query ${op.name}${argsStr ? `(${argsStr})` : ''} { ${op.name}${varsStr ? `(${varsStr})` : ''} { __typename } }`
      : `mutation ${op.name}${argsStr ? `(${argsStr})` : ''} { ${op.name}${varsStr ? `(${varsStr})` : ''} { __typename } }`;

    return `async function graphql_${op.name}(args: Record<string, any>) {
  const query = \`${query}\`;
  
  const response = await fetch('${endpoint}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: args
    })
  });
  
  if (!response.ok) {
    throw new Error(\`GraphQL request failed: \${response.status}\`);
  }
  
  const result = await response.json();
  
  if (result.errors) {
    return { content: [{ type: 'text', text: 'GraphQL errors: ' + JSON.stringify(result.errors, null, 2) }] };
  }
  
  return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
}`;
  }
}
