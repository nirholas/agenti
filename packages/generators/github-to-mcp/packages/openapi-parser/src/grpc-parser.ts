/**
 * @fileoverview gRPC/Protobuf parser for extracting service methods as MCP tools
 * Parses .proto files to extract service definitions, RPC methods, and messages
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

export interface ProtobufField {
  name: string;
  type: string;
  number: number;
  repeated: boolean;
  optional: boolean;
  mapKeyType?: string;
  mapValueType?: string;
  comment?: string;
}

export interface ProtobufMessage {
  name: string;
  fields: ProtobufField[];
  nestedMessages: ProtobufMessage[];
  enums: ProtobufEnum[];
  comment?: string;
}

export interface ProtobufEnum {
  name: string;
  values: Array<{
    name: string;
    number: number;
    comment?: string;
  }>;
  comment?: string;
}

export interface ProtobufRpcMethod {
  name: string;
  inputType: string;
  outputType: string;
  clientStreaming: boolean;
  serverStreaming: boolean;
  comment?: string;
  options?: Record<string, string>;
}

export interface ProtobufService {
  name: string;
  methods: ProtobufRpcMethod[];
  comment?: string;
}

export interface GrpcToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  metadata: {
    service: string;
    method: string;
    inputType: string;
    outputType: string;
    clientStreaming: boolean;
    serverStreaming: boolean;
    httpBinding?: {
      method: string;
      path: string;
    };
  };
}

export interface GrpcParseResult {
  format: 'grpc';
  package: string;
  services: ProtobufService[];
  messages: ProtobufMessage[];
  enums: ProtobufEnum[];
  tools: GrpcToolDefinition[];
  imports: string[];
  options: Record<string, string>;
}

/**
 * Parser for Protocol Buffer (.proto) files
 */
export class GrpcParser {
  private messages: Map<string, ProtobufMessage> = new Map();
  private enums: Map<string, ProtobufEnum> = new Map();
  private packageName: string = '';
  private imports: string[] = [];
  private options: Record<string, string> = {};

  /**
   * Parse a .proto file content
   */
  parse(protoContent: string): GrpcParseResult {
    // Reset state
    this.messages.clear();
    this.enums.clear();
    this.packageName = '';
    this.imports = [];
    this.options = {};

    // Remove comments for easier parsing but keep for documentation
    const commentMap = this.extractComments(protoContent);
    const cleanContent = this.removeComments(protoContent);

    // Parse package
    this.parsePackage(cleanContent);

    // Parse imports
    this.parseImports(cleanContent);

    // Parse options
    this.parseOptions(cleanContent);

    // Parse enums (need to do before messages)
    const enums = this.parseEnums(cleanContent, commentMap);
    enums.forEach(e => this.enums.set(e.name, e));

    // Parse messages
    const messages = this.parseMessages(cleanContent, commentMap);
    messages.forEach(m => this.messages.set(m.name, m));

    // Parse services
    const services = this.parseServices(cleanContent, commentMap);

    // Generate tool definitions
    const tools = this.generateTools(services);

    return {
      format: 'grpc',
      package: this.packageName,
      services,
      messages,
      enums,
      tools,
      imports: this.imports,
      options: this.options,
    };
  }

  /**
   * Extract comments and their positions
   */
  private extractComments(content: string): Map<number, string> {
    const comments = new Map<number, string>();
    const lines = content.split('\n');
    let currentComment = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Single-line comment
      if (line.startsWith('//')) {
        const comment = line.substring(2).trim();
        currentComment = currentComment ? `${currentComment} ${comment}` : comment;
        continue;
      }
      
      // Block comment start
      if (line.includes('/*')) {
        const blockMatch = content.substring(content.indexOf(line)).match(/\/\*[\s\S]*?\*\//);
        if (blockMatch) {
          currentComment = blockMatch[0]
            .replace(/^\/\*\*?/, '')
            .replace(/\*\/$/, '')
            .split('\n')
            .map(l => l.replace(/^\s*\*?\s*/, '').trim())
            .filter(l => l)
            .join(' ');
        }
        continue;
      }
      
      // If we have a comment and reach a definition line, attach it
      if (currentComment && (
        line.startsWith('message ') ||
        line.startsWith('enum ') ||
        line.startsWith('service ') ||
        line.startsWith('rpc ') ||
        line.match(/^\w+\s+\w+\s*=/)
      )) {
        comments.set(i, currentComment);
        currentComment = '';
      } else if (!line.startsWith('//') && !line.includes('/*') && line.length > 0) {
        currentComment = '';
      }
    }
    
    return comments;
  }

  /**
   * Remove comments from content
   */
  private removeComments(content: string): string {
    // Remove block comments
    let result = content.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove line comments
    result = result.replace(/\/\/.*$/gm, '');
    return result;
  }

  /**
   * Parse package declaration
   */
  private parsePackage(content: string): void {
    const match = content.match(/package\s+([\w.]+)\s*;/);
    if (match) {
      this.packageName = match[1];
    }
  }

  /**
   * Parse import statements
   */
  private parseImports(content: string): void {
    const importPattern = /import\s+(?:public\s+)?"([^"]+)"\s*;/g;
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      this.imports.push(match[1]);
    }
  }

  /**
   * Parse option statements
   */
  private parseOptions(content: string): void {
    const optionPattern = /option\s+([\w.]+)\s*=\s*"?([^";\n]+)"?\s*;/g;
    let match;
    while ((match = optionPattern.exec(content)) !== null) {
      this.options[match[1]] = match[2];
    }
  }

  /**
   * Parse enum definitions
   */
  private parseEnums(content: string, commentMap: Map<number, string>): ProtobufEnum[] {
    const enums: ProtobufEnum[] = [];
    const enumPattern = /enum\s+(\w+)\s*\{([^}]+)\}/g;
    
    let match;
    while ((match = enumPattern.exec(content)) !== null) {
      const name = match[1];
      const body = match[2];
      const values: ProtobufEnum['values'] = [];
      
      const valuePattern = /(\w+)\s*=\s*(\d+)/g;
      let valueMatch;
      while ((valueMatch = valuePattern.exec(body)) !== null) {
        values.push({
          name: valueMatch[1],
          number: parseInt(valueMatch[2], 10),
        });
      }
      
      enums.push({ name, values });
    }
    
    return enums;
  }

  /**
   * Parse message definitions
   */
  private parseMessages(content: string, commentMap: Map<number, string>): ProtobufMessage[] {
    const messages: ProtobufMessage[] = [];
    const messagePattern = /message\s+(\w+)\s*\{/g;
    
    let match;
    while ((match = messagePattern.exec(content)) !== null) {
      const name = match[1];
      const startIndex = match.index + match[0].length;
      const body = this.extractBracedContent(content, startIndex - 1);
      
      if (body) {
        const fields = this.parseFields(body);
        const nestedMessages = this.parseMessages(body, commentMap);
        const nestedEnums = this.parseEnums(body, commentMap);
        
        messages.push({
          name,
          fields,
          nestedMessages,
          enums: nestedEnums,
        });
      }
    }
    
    return messages;
  }

  /**
   * Parse message fields
   */
  private parseFields(body: string): ProtobufField[] {
    const fields: ProtobufField[] = [];
    
    // Standard field pattern: [optional|repeated] type name = number;
    const fieldPattern = /(optional\s+|repeated\s+)?(\w+(?:\.\w+)*)\s+(\w+)\s*=\s*(\d+)/g;
    
    // Map field pattern: map<keyType, valueType> name = number;
    const mapPattern = /map\s*<\s*(\w+)\s*,\s*(\w+(?:\.\w+)*)\s*>\s+(\w+)\s*=\s*(\d+)/g;
    
    let match;
    
    // Parse map fields first
    while ((match = mapPattern.exec(body)) !== null) {
      fields.push({
        name: match[3],
        type: 'map',
        number: parseInt(match[4], 10),
        repeated: false,
        optional: false,
        mapKeyType: match[1],
        mapValueType: match[2],
      });
    }
    
    // Parse regular fields
    while ((match = fieldPattern.exec(body)) !== null) {
      const modifier = match[1]?.trim() || '';
      fields.push({
        name: match[3],
        type: match[2],
        number: parseInt(match[4], 10),
        repeated: modifier === 'repeated',
        optional: modifier === 'optional',
      });
    }
    
    return fields.sort((a, b) => a.number - b.number);
  }

  /**
   * Parse service definitions
   */
  private parseServices(content: string, commentMap: Map<number, string>): ProtobufService[] {
    const services: ProtobufService[] = [];
    const servicePattern = /service\s+(\w+)\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
    
    let match;
    while ((match = servicePattern.exec(content)) !== null) {
      const name = match[1];
      const body = match[2];
      const methods = this.parseRpcMethods(body);
      
      services.push({ name, methods });
    }
    
    return services;
  }

  /**
   * Parse RPC method definitions
   */
  private parseRpcMethods(body: string): ProtobufRpcMethod[] {
    const methods: ProtobufRpcMethod[] = [];
    
    // RPC pattern: rpc MethodName (stream? RequestType) returns (stream? ResponseType) { options }
    const rpcPattern = /rpc\s+(\w+)\s*\(\s*(stream\s+)?(\w+(?:\.\w+)*)\s*\)\s*returns\s*\(\s*(stream\s+)?(\w+(?:\.\w+)*)\s*\)(?:\s*\{([^}]*)\})?/g;
    
    let match;
    while ((match = rpcPattern.exec(body)) !== null) {
      const options: Record<string, string> = {};
      
      // Parse HTTP bindings if present (google.api.http)
      if (match[6]) {
        const httpMatch = match[6].match(/option\s*\(google\.api\.http\)\s*=\s*\{([^}]+)\}/);
        if (httpMatch) {
          const httpBody = httpMatch[1];
          const methodMatch = httpBody.match(/(get|post|put|delete|patch):\s*"([^"]+)"/i);
          if (methodMatch) {
            options['http.method'] = methodMatch[1].toUpperCase();
            options['http.path'] = methodMatch[2];
          }
          const bodyMatch = httpBody.match(/body:\s*"([^"]+)"/);
          if (bodyMatch) {
            options['http.body'] = bodyMatch[1];
          }
        }
      }
      
      methods.push({
        name: match[1],
        inputType: match[3],
        outputType: match[5],
        clientStreaming: !!match[2],
        serverStreaming: !!match[4],
        options: Object.keys(options).length > 0 ? options : undefined,
      });
    }
    
    return methods;
  }

  /**
   * Extract content between matching braces
   */
  private extractBracedContent(content: string, startIndex: number): string | null {
    let depth = 0;
    let start = -1;
    
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        if (start === -1) start = i;
        depth++;
      } else if (content[i] === '}') {
        depth--;
        if (depth === 0) {
          return content.substring(start + 1, i);
        }
      }
    }
    
    return null;
  }

  /**
   * Generate MCP tool definitions from services
   */
  private generateTools(services: ProtobufService[]): GrpcToolDefinition[] {
    const tools: GrpcToolDefinition[] = [];
    
    for (const service of services) {
      for (const method of service.methods) {
        const inputMessage = this.messages.get(method.inputType);
        const inputSchema = this.messageToJsonSchema(inputMessage);
        
        const toolName = this.generateToolName(service.name, method.name);
        const description = this.generateDescription(service, method);
        
        tools.push({
          name: toolName,
          description,
          inputSchema,
          metadata: {
            service: service.name,
            method: method.name,
            inputType: method.inputType,
            outputType: method.outputType,
            clientStreaming: method.clientStreaming,
            serverStreaming: method.serverStreaming,
            httpBinding: method.options?.['http.method'] ? {
              method: method.options['http.method'],
              path: method.options['http.path'],
            } : undefined,
          },
        });
      }
    }
    
    return tools;
  }

  /**
   * Convert a protobuf message to JSON Schema
   */
  private messageToJsonSchema(message?: ProtobufMessage): GrpcToolDefinition['inputSchema'] {
    if (!message) {
      return { type: 'object', properties: {}, required: [] };
    }
    
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    for (const field of message.fields) {
      const schema = this.fieldToJsonSchema(field);
      properties[field.name] = schema;
      
      // In proto3, fields are optional by default unless explicitly required
      if (!field.optional && !field.repeated) {
        required.push(field.name);
      }
    }
    
    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * Convert a protobuf field to JSON Schema
   */
  private fieldToJsonSchema(field: ProtobufField): Record<string, any> {
    let schema: Record<string, any>;
    
    if (field.type === 'map') {
      schema = {
        type: 'object',
        additionalProperties: this.protoTypeToJsonSchema(field.mapValueType || 'string'),
      };
    } else {
      schema = this.protoTypeToJsonSchema(field.type);
    }
    
    if (field.repeated) {
      return {
        type: 'array',
        items: schema,
      };
    }
    
    if (field.comment) {
      schema.description = field.comment;
    }
    
    return schema;
  }

  /**
   * Convert protobuf type to JSON Schema type
   */
  private protoTypeToJsonSchema(protoType: string): Record<string, any> {
    // Scalar types
    const scalarMap: Record<string, any> = {
      'double': { type: 'number' },
      'float': { type: 'number' },
      'int32': { type: 'integer' },
      'int64': { type: 'integer' },
      'uint32': { type: 'integer', minimum: 0 },
      'uint64': { type: 'integer', minimum: 0 },
      'sint32': { type: 'integer' },
      'sint64': { type: 'integer' },
      'fixed32': { type: 'integer', minimum: 0 },
      'fixed64': { type: 'integer', minimum: 0 },
      'sfixed32': { type: 'integer' },
      'sfixed64': { type: 'integer' },
      'bool': { type: 'boolean' },
      'string': { type: 'string' },
      'bytes': { type: 'string', contentEncoding: 'base64' },
    };
    
    if (scalarMap[protoType]) {
      return scalarMap[protoType];
    }
    
    // Well-known types
    const wellKnownMap: Record<string, any> = {
      'google.protobuf.Timestamp': { type: 'string', format: 'date-time' },
      'google.protobuf.Duration': { type: 'string' },
      'google.protobuf.Empty': { type: 'object', properties: {} },
      'google.protobuf.Any': { type: 'object' },
      'google.protobuf.Struct': { type: 'object' },
      'google.protobuf.Value': {},
      'google.protobuf.NullValue': { type: 'null' },
      'google.protobuf.BoolValue': { type: 'boolean' },
      'google.protobuf.StringValue': { type: 'string' },
      'google.protobuf.Int32Value': { type: 'integer' },
      'google.protobuf.Int64Value': { type: 'integer' },
      'google.protobuf.UInt32Value': { type: 'integer', minimum: 0 },
      'google.protobuf.UInt64Value': { type: 'integer', minimum: 0 },
      'google.protobuf.FloatValue': { type: 'number' },
      'google.protobuf.DoubleValue': { type: 'number' },
      'google.protobuf.BytesValue': { type: 'string', contentEncoding: 'base64' },
    };
    
    if (wellKnownMap[protoType]) {
      return wellKnownMap[protoType];
    }
    
    // Check for enum
    const enumDef = this.enums.get(protoType);
    if (enumDef) {
      return {
        type: 'string',
        enum: enumDef.values.map(v => v.name),
      };
    }
    
    // Check for message (nested object)
    const messageDef = this.messages.get(protoType);
    if (messageDef) {
      return this.messageToJsonSchema(messageDef);
    }
    
    // Unknown type - assume object
    return { type: 'object', description: `Custom type: ${protoType}` };
  }

  /**
   * Generate tool name from service and method
   */
  private generateToolName(serviceName: string, methodName: string): string {
    // Convert CamelCase to snake_case
    const snakeCase = (str: string) => str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase();
    
    return `${snakeCase(serviceName)}_${snakeCase(methodName)}`;
  }

  /**
   * Generate description for a tool
   */
  private generateDescription(service: ProtobufService, method: ProtobufRpcMethod): string {
    const parts: string[] = [];
    
    if (method.comment) {
      parts.push(method.comment);
    } else {
      parts.push(`${method.name} RPC method from ${service.name} service`);
    }
    
    if (method.clientStreaming || method.serverStreaming) {
      const streaming = [];
      if (method.clientStreaming) streaming.push('client');
      if (method.serverStreaming) streaming.push('server');
      parts.push(`(${streaming.join(' and ')} streaming)`);
    }
    
    if (method.options?.['http.method']) {
      parts.push(`HTTP: ${method.options['http.method']} ${method.options['http.path']}`);
    }
    
    return parts.join(' ');
  }

  /**
   * Check if content appears to be a proto file
   */
  static isProtoFile(content: string): boolean {
    const trimmed = content.trim();
    return (
      trimmed.includes('syntax = "proto') ||
      trimmed.includes('message ') ||
      trimmed.includes('service ') ||
      trimmed.includes('rpc ')
    );
  }

  /**
   * Get proto syntax version
   */
  getProtoVersion(content: string): 'proto2' | 'proto3' | 'unknown' {
    const match = content.match(/syntax\s*=\s*"(proto\d)"/);
    if (match) {
      return match[1] as 'proto2' | 'proto3';
    }
    return 'unknown';
  }
}
