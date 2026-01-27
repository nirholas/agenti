/**
 * @fileoverview Module exports and initialization
 * Multi-format API specification parser with unified interface
 * Supports: OpenAPI, AsyncAPI, GraphQL, gRPC/Protobuf, Postman, Insomnia, HAR
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { OpenAPIV3 } from 'openapi-types';
import { OpenApiParser } from './parser.js';
import { OpenApiAnalyzer, type EndpointInfo } from './analyzer.js';
import { OpenApiTransformer, type TransformOptions, type McpToolDefinition } from './transformer.js';
import { CodeGenerator, type GeneratorOptions } from './generator.js';
import { parseAsyncAPI, type AsyncAPIParseResult, type AsyncAPIToolDefinition } from './asyncapi-parser.js';
import { parseGraphQL, type GraphQLParseResult, type GraphQLToolDefinition } from './graphql-parser.js';
import { GrpcParser, type GrpcParseResult, type GrpcToolDefinition, type ProtobufService, type ProtobufMessage, type ProtobufEnum, type ProtobufRpcMethod } from './grpc-parser.js';
import { parsePostman, type PostmanParseResult, type PostmanToolDefinition } from './postman-parser.js';
import { parseInsomnia, type InsomniaParseResult, type InsomniaToolDefinition } from './insomnia-parser.js';
import { parseHAR, type HarParseResult, type HarToolDefinition } from './har-parser.js';
import { RefResolver, resolveRefs, type RefResolverOptions, type ResolvedSpec } from './ref-resolver.js';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Export generators module
export * from './generators/index.js';
export {
  ExpressAnalyzer,
  FastAPIAnalyzer,
  NextJSAnalyzer,
  OpenApiBuilder,
  generateOpenApiFromCode,
  generateOpenApiFromCodeWithDetails,
  analyzeFiles,
  detectFramework,
  analyzeWithFramework,
} from './generators/index.js';

// Export gRPC parser
export { GrpcParser, type GrpcParseResult, type GrpcToolDefinition, type ProtobufService, type ProtobufMessage, type ProtobufEnum, type ProtobufRpcMethod };

export interface ConverterConfig {
  /** OpenAPI spec source (file path or URL) */
  spec: string;
  
  /** Output directory */
  outputDir: string;
  
  /** Base URL for API (overrides spec) */
  baseUrl?: string;
  
  /** Filter options */
  filters?: {
    tags?: string[];
    paths?: string[];
    methods?: string[];
    include?: string[];
    exclude?: string[];
  };
  
  /** Transformation options */
  transform?: TransformOptions;
  
  /** Generation options */
  generation?: Partial<GeneratorOptions>;
}

export interface ConversionStats {
  spec: {
    title: string;
    version: string;
    endpoints: number;
  };
  conversion: {
    toolsGenerated: number;
    filesCreated: number;
    duration: number;
  };
  breakdown: {
    byMethod: Record<string, number>;
    byTag: Record<string, number>;
  };
}

/**
 * Main converter class - orchestrates the conversion pipeline
 */
export class OpenApiToMcp {
  private parser: OpenApiParser;
  private analyzer: OpenApiAnalyzer | null = null;
  private transformer: OpenApiTransformer | null = null;
  private generator: CodeGenerator | null = null;
  
  private tools: McpToolDefinition[] = [];
  private stats: ConversionStats | null = null;

  constructor(private config: ConverterConfig) {
    this.parser = new OpenApiParser();
  }

  /**
   * Run the complete conversion pipeline
   */
  async convert(): Promise<ConversionStats> {
    const startTime = Date.now();

    console.log('🔍 Parsing OpenAPI specification...');
    const spec = await this.parser.parse(this.config.spec);
    const specInfo = this.parser.getInfo();
    
    console.log(`✅ Parsed: ${specInfo.title} v${specInfo.version}`);

    console.log('📊 Analyzing endpoints...');
    // Cast to OpenAPIV3.Document - OpenAPI 3.1 is mostly compatible for our analysis
    const v3Spec = spec as OpenAPIV3.Document;
    this.analyzer = new OpenApiAnalyzer(v3Spec);
    let endpoints = this.analyzer.extractEndpoints(this.config.filters);
    
    // Apply include/exclude filters
    if (this.config.filters?.include) {
      endpoints = endpoints.filter(e => 
        this.config.filters!.include!.includes(e.operationId || '')
      );
    }
    if (this.config.filters?.exclude) {
      endpoints = endpoints.filter(e => 
        !this.config.filters!.exclude!.includes(e.operationId || '')
      );
    }
    
    console.log(`✅ Found ${endpoints.length} endpoints`);

    console.log('🔄 Transforming to MCP tools...');
    this.transformer = new OpenApiTransformer(v3Spec, this.config.transform);
    
    // Detect pagination for endpoints
    const paginationMap = new Map();
    for (const endpoint of endpoints) {
      const pagination = this.analyzer.detectPagination(endpoint);
      if (pagination) {
        const key = `${endpoint.method}:${endpoint.path}`;
        paginationMap.set(key, pagination);
      }
    }
    
    this.tools = this.transformer.transformEndpoints(endpoints, paginationMap);
    console.log(`✅ Generated ${this.tools.length} MCP tools`);

    console.log('💻 Generating code...');
    const baseUrl = this.config.baseUrl || this.parser.getBaseUrl();
    const generatorOptions: GeneratorOptions = {
      format: 'typescript',
      serverName: specInfo.title,
      serverVersion: specInfo.version,
      baseUrl,
      ...this.config.generation,
    };
    
    this.generator = new CodeGenerator(generatorOptions);
    
    // Group tools by tag
    const toolGroups = new Map<string, McpToolDefinition[]>();
    for (const tool of this.tools) {
      const group = tool.metadata.tags?.[0] || 'default';
      if (!toolGroups.has(group)) {
        toolGroups.set(group, []);
      }
      toolGroups.get(group)!.push(tool);
    }
    
    const files = this.generator.generateServer(this.tools, toolGroups);

    console.log('📝 Writing files...');
    await this.writeFiles(files);
    console.log(`✅ Created ${files.size} files`);

    const duration = Date.now() - startTime;
    
    this.stats = {
      spec: {
        title: specInfo.title,
        version: specInfo.version,
        endpoints: endpoints.length,
      },
      conversion: {
        toolsGenerated: this.tools.length,
        filesCreated: files.size,
        duration,
      },
      breakdown: this.analyzer.getEndpointStats(endpoints) as any,
    };

    console.log('\n✨ Conversion complete!');
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`📁 Output: ${this.config.outputDir}`);
    
    return this.stats;
  }

  /**
   * Write generated files to disk
   */
  private async writeFiles(files: Map<string, string>): Promise<void> {
    // Create output directory
    await fs.mkdir(this.config.outputDir, { recursive: true });

    // Write each file
    for (const [relativePath, content] of files.entries()) {
      const fullPath = path.join(this.config.outputDir, relativePath);
      const dir = path.dirname(fullPath);
      
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });
      
      // Write file
      await fs.writeFile(fullPath, content, 'utf-8');
    }
  }

  /**
   * Get generated tools
   */
  getTools(): McpToolDefinition[] {
    return this.tools;
  }

  /**
   * Get conversion statistics
   */
  getStats(): ConversionStats | null {
    return this.stats;
  }

  /**
   * Preview conversion (don't write files)
   */
  async preview(): Promise<{
    tools: McpToolDefinition[];
    stats: any;
  }> {
    const spec = await this.parser.parse(this.config.spec);
    // Cast to OpenAPIV3.Document - OpenAPI 3.1 is mostly compatible
    const v3Spec = spec as OpenAPIV3.Document;
    this.analyzer = new OpenApiAnalyzer(v3Spec);
    
    let endpoints = this.analyzer.extractEndpoints(this.config.filters);
    
    if (this.config.filters?.include) {
      endpoints = endpoints.filter(e => 
        this.config.filters!.include!.includes(e.operationId || '')
      );
    }
    if (this.config.filters?.exclude) {
      endpoints = endpoints.filter(e => 
        !this.config.filters!.exclude!.includes(e.operationId || '')
      );
    }

    this.transformer = new OpenApiTransformer(v3Spec, this.config.transform);
    const tools = this.transformer.transformEndpoints(endpoints);
    const stats = this.analyzer.getEndpointStats(endpoints);

    return { tools, stats };
  }
}

/**
 * Convenience function to convert OpenAPI spec to MCP tools
 */
export async function convertOpenApiToMcp(spec: any): Promise<{
  tools: McpToolDefinition[];
  stats: any;
}> {
  const parser = new OpenApiParser();
  const parsedSpec = parser.parseObject(spec);
  const v3Spec = parsedSpec as OpenAPIV3.Document;
  
  const analyzer = new OpenApiAnalyzer(v3Spec);
  const endpoints = analyzer.extractEndpoints();
  
  const transformer = new OpenApiTransformer(v3Spec);
  const tools = transformer.transformEndpoints(endpoints);
  const stats = analyzer.getEndpointStats(endpoints);
  
  return { tools, stats };
}

// Export all types (excluding duplicates)
export * from './parser.js';
export * from './analyzer.js';
export * from './transformer.js';
// Note: GeneratorOptions is exported from generators/types.js, not generator.js to avoid conflicts
export { CodeGenerator } from './generator.js';
export * from './asyncapi-parser.js';
export * from './graphql-parser.js';
export * from './postman-parser.js';
export * from './insomnia-parser.js';
export * from './har-parser.js';
export * from './ref-resolver.js';

// ============================================================================
// Unified Parser Interface
// ============================================================================

/** Supported API specification formats */
export type SpecFormat = 'openapi' | 'asyncapi' | 'graphql' | 'postman' | 'insomnia' | 'har';

/** Unified tool definition */
export interface UnifiedToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  metadata: {
    format: SpecFormat;
    endpoint?: {
      path: string;
      method: string;
    };
    channel?: string;
    operationType?: 'query' | 'mutation' | 'subscription';
    auth?: {
      type: string;
      envVar?: string;
    };
    tags?: string[];
    deprecated?: boolean;
    confidence?: 'high' | 'medium' | 'low';
  };
  examples?: Array<{ input?: any; output?: any }>;
}

/** Unified parse options */
export interface ParseOptions {
  /** Specify format or auto-detect if not specified */
  format?: SpecFormat;
  /** How to group operations */
  groupBy?: 'tags' | 'paths' | 'none';
  /** Include examples in output */
  includeExamples?: boolean;
  /** Resolve external $ref references */
  resolveRefs?: boolean;
  /** Include deprecated operations */
  includeDeprecated?: boolean;
  /** Custom operation filter */
  operationFilter?: (op: any) => boolean;
}

/** Unified parse result */
export interface UnifiedParseResult {
  format: SpecFormat;
  info: {
    title?: string;
    version?: string;
    description?: string;
  };
  tools: UnifiedToolDefinition[];
  auth?: {
    type: string;
    schemes?: Array<{ name: string; type: string }>;
  };
  errors?: Array<{ message: string; location?: string }>;
}

/**
 * Detect the format of an API specification
 */
export function detectFormat(input: string | object): SpecFormat {
  let obj: any;
  
  if (typeof input === 'string') {
    const trimmed = input.trim();
    
    // Check for GraphQL SDL patterns first (before YAML parsing which can succeed on SDL)
    if (trimmed.includes('type Query') || 
        trimmed.includes('type Mutation') ||
        trimmed.includes('type Subscription') ||
        trimmed.includes('schema {') ||
        /^\s*type\s+\w+\s*\{/.test(trimmed)) {
      return 'graphql';
    }
    
    // Try JSON first
    if (trimmed.startsWith('{')) {
      try {
        obj = JSON.parse(trimmed);
      } catch {
        // Try YAML
        try {
          obj = yaml.load(trimmed);
        } catch {
          throw new Error('Unable to parse input as JSON, YAML, or GraphQL SDL');
        }
      }
    } else {
      // Likely YAML
      try {
        obj = yaml.load(trimmed);
      } catch {
        throw new Error('Unable to parse input as JSON, YAML, or GraphQL SDL');
      }
    }
  } else {
    obj = input;
  }

  if (!obj || typeof obj !== 'object') {
    throw new Error('Invalid input: expected an object');
  }

  // OpenAPI detection
  if ('openapi' in obj || 'swagger' in obj) {
    return 'openapi';
  }

  // AsyncAPI detection
  if ('asyncapi' in obj) {
    return 'asyncapi';
  }

  // Postman Collection detection
  // Check for Postman collection schema URL (should be at the start of the schema property)
  if ('info' in obj && typeof obj.info?.schema === 'string') {
    const schema = obj.info.schema;
    // Postman collection schemas follow the pattern: https://schema.getpostman.com/...
    if (schema.startsWith('https://schema.getpostman.com/') || 
        schema.startsWith('http://schema.getpostman.com/')) {
      return 'postman';
    }
  }
  // Fallback detection for Postman collections without schema field
  if ('info' in obj && 'item' in obj && Array.isArray(obj.item)) {
    return 'postman';
  }

  // Insomnia export detection
  if (obj._type === 'export' && '__export_format' in obj) {
    return 'insomnia';
  }

  // HAR file detection
  if ('log' in obj && obj.log?.version && Array.isArray(obj.log?.entries)) {
    return 'har';
  }

  // GraphQL introspection result detection
  if ('__schema' in obj || (obj.data && '__schema' in obj.data)) {
    return 'graphql';
  }

  throw new Error('Unable to detect specification format');
}

/**
 * Convert format-specific tools to unified format
 */
function toUnifiedTools(
  tools: any[],
  format: SpecFormat
): UnifiedToolDefinition[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    metadata: {
      format,
      endpoint: tool.metadata?.endpoint,
      channel: tool.metadata?.channel,
      operationType: tool.metadata?.operationType,
      auth: tool.metadata?.auth,
      tags: tool.metadata?.tags,
      deprecated: tool.metadata?.deprecated,
      confidence: tool.metadata?.confidence,
    },
    examples: tool.examples,
  }));
}

/**
 * Unified parser entry point - parses any supported specification format
 */
export async function parseSpec(
  input: string | object,
  options: ParseOptions = {}
): Promise<UnifiedParseResult> {
  const format = options.format || detectFormat(input);
  
  switch (format) {
    case 'openapi': {
      const parser = new OpenApiParser();
      let spec: any;
      
      if (typeof input === 'string') {
        // Check if it's a file path or content
        if (input.trim().startsWith('{') || input.trim().startsWith('openapi:') || input.trim().startsWith('swagger:')) {
          // It's content, parse it
          try {
            spec = JSON.parse(input);
          } catch {
            spec = yaml.load(input);
          }
          parser.parseObject(spec);
        } else {
          // It's a file path
          spec = await parser.parse(input);
        }
      } else {
        spec = parser.parseObject(input as any);
      }
      
      // Optionally resolve refs
      if (options.resolveRefs) {
        const resolved = await resolveRefs(spec);
        spec = resolved.spec;
      }
      
      const v3Spec = spec as OpenAPIV3.Document;
      const analyzer = new OpenApiAnalyzer(v3Spec);
      let endpoints = analyzer.extractEndpoints();
      
      // Apply filters
      if (!options.includeDeprecated) {
        endpoints = endpoints.filter(e => !e.deprecated);
      }
      if (options.operationFilter) {
        endpoints = endpoints.filter(options.operationFilter);
      }
      
      const transformer = new OpenApiTransformer(v3Spec);
      const tools = transformer.transformEndpoints(endpoints);
      
      // Extract auth info
      const authInfo = analyzer.getAuthenticationInfo();
      
      return {
        format: 'openapi',
        info: {
          title: spec.info?.title,
          version: spec.info?.version,
          description: spec.info?.description,
        },
        tools: toUnifiedTools(tools, 'openapi'),
        auth: authInfo.length > 0 ? {
          type: authInfo[0].type,
          schemes: authInfo.map(a => ({ name: a.name || 'default', type: a.type })),
        } : undefined,
      };
    }
    
    case 'asyncapi': {
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
      const result = parseAsyncAPI(inputStr);
      
      return {
        format: 'asyncapi',
        info: {
          title: result.info.title,
          version: result.info.version,
          description: result.info.description,
        },
        tools: toUnifiedTools(result.tools, 'asyncapi'),
        auth: Object.keys(result.securitySchemes).length > 0 ? {
          type: 'multiple',
          schemes: Object.entries(result.securitySchemes).map(([name, scheme]) => ({
            name,
            type: (scheme as any).type,
          })),
        } : undefined,
      };
    }
    
    case 'graphql': {
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
      const result = parseGraphQL(inputStr);
      
      return {
        format: 'graphql',
        info: {
          title: 'GraphQL API',
          description: `${result.types.queries.length} queries, ${result.types.mutations.length} mutations, ${result.types.subscriptions.length} subscriptions`,
        },
        tools: toUnifiedTools(result.tools, 'graphql'),
      };
    }
    
    case 'postman': {
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
      const result = parsePostman(inputStr);
      
      return {
        format: 'postman',
        info: {
          title: result.info.name,
          description: result.info.description,
        },
        tools: toUnifiedTools(result.tools, 'postman'),
        auth: result.auth ? { type: result.auth.type } : undefined,
      };
    }
    
    case 'insomnia': {
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
      const result = parseInsomnia(inputStr);
      
      return {
        format: 'insomnia',
        info: {
          title: result.workspaces[0]?.name || 'Insomnia Collection',
          description: result.workspaces[0]?.description,
        },
        tools: toUnifiedTools(result.tools, 'insomnia'),
      };
    }
    
    case 'har': {
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
      const result = parseHAR(inputStr);
      
      return {
        format: 'har',
        info: {
          title: 'API from HAR',
          description: `Inferred from ${result.info.entryCount} captured requests (${result.info.endpointCount} unique endpoints)`,
        },
        tools: toUnifiedTools(result.tools, 'har'),
      };
    }
    
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}
