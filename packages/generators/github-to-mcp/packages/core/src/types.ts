/**
 * @fileoverview Type definitions and interfaces
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * Types for GitHub to MCP Generator
 */

export type SourceType = 'readme' | 'openapi' | 'graphql' | 'grpc' | 'code' | 'mcp-introspect' | 'tests' | 'docs' | 'examples' | 'universal';

export type NamingStyle = 'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase';

export type OutputLanguage = 'typescript' | 'python' | 'go';

/**
 * Classification of repository type
 */
export type RepoType = 
  | 'api-sdk'      // API client/SDK with extractable endpoints
  | 'mcp-server'   // Already an MCP server
  | 'cli-tool'     // Command-line tool
  | 'library'      // Code library/package
  | 'documentation' // Docs, tutorials, guides
  | 'data'         // Datasets, configs
  | 'unknown';     // Fallback

export interface RepoClassification {
  type: RepoType;
  confidence: number; // 0-1
  indicators: string[];
}

export interface GithubToMcpOptions {
  // Sources to extract from
  sources?: SourceType[];

  // Follow documentation links
  followDocs?: boolean;
  depth?: number;

  // Include code examples
  includeExamples?: boolean;

  // Generate tests
  generateTests?: boolean;

  // Output format
  outputFormat?: 'typescript' | 'javascript';
  
  // Output language (typescript or python)
  outputLanguage?: OutputLanguage;

  // Naming convention
  naming?: {
    prefix?: string;
    suffix?: string;
    style?: NamingStyle;
  };

  // Authentication
  githubToken?: string;

  // Caching
  cache?: boolean;
  cacheDir?: string;
  cacheTTL?: {
    metadata?: number;  // TTL for repo metadata in seconds (default: 3600)
    files?: number;     // TTL for file contents in seconds (default: 900)
  };

  // Rate limiting
  rateLimit?: {
    maxRequests: number;
    perSeconds: number;
  };

  // Output directory
  outputDir?: string;

  // Verbose logging
  verbose?: boolean;
}

/**
 * Confidence factors for tool extraction
 */
export interface ConfidenceFactors {
  documentation: number; // 0-1: completeness of description, params, returns
  types: number;         // 0-1: type information availability
  examples: number;      // 0-1: presence of examples
  source: number;        // 0-1: reliability of source (README vs code comments)
}

export interface ExtractedTool {
  name: string;
  description: string;
  inputSchema: any;
  implementation?: string;
  examples?: string[];
  source: {
    type: SourceType;
    file: string;
    line?: number;
  };
  confidence?: number;           // 0-1 overall confidence score
  confidenceFactors?: ConfidenceFactors;
}

export interface SourceBreakdown {
  type: SourceType;
  count: number;
  files: string[];
}

export interface GenerationResult {
  repo: string;
  name: string;
  tools: ExtractedTool[];
  sources: SourceBreakdown[];
  classification: RepoClassification;
  metadata: {
    stars: number;
    language: string;
    license?: string;
    description?: string;
  };
  
  // Methods
  generate(): string;
  generatePython?(): string;
  save(outputDir: string): Promise<void>;
  download(): void;
}

export interface RepoMetadata {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
}

export interface FileContent {
  path: string;
  content: string;
  type: 'file' | 'dir';
  sha: string;
}

export interface ApiSpec {
  type: 'openapi' | 'swagger' | 'postman' | 'graphql';
  version: string;
  spec: any;
  path: string;
}

export interface GraphQLSchema {
  queries: GraphQLOperation[];
  mutations: GraphQLOperation[];
  subscriptions: GraphQLOperation[];
  types: Record<string, GraphQLType>;
}

export interface GraphQLOperation {
  name: string;
  description?: string;
  args: GraphQLArg[];
  returnType: string;
}

export interface GraphQLArg {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface GraphQLType {
  name: string;
  kind: 'object' | 'enum' | 'scalar' | 'input';
  fields?: Array<{ name: string; type: string; description?: string }>;
  values?: string[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface CodeExample {
  code: string;
  language: string;
  description?: string;
  file: string;
  line: number;
}

export interface DocumentationLink {
  url: string;
  title?: string;
  source: string;
}

export interface SdkMethod {
  name: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
  returnType: string;
  description?: string;
  file: string;
  line: number;
}

/**
 * Monorepo detection types
 */
export type MonorepoType = 
  | 'lerna'           // lerna.json
  | 'nx'              // nx.json
  | 'turborepo'       // turbo.json
  | 'pnpm'            // pnpm-workspace.yaml
  | 'yarn'            // workspaces in package.json
  | 'npm'             // workspaces in package.json
  | 'custom'          // packages/*, apps/*, libs/*
  | 'none';           // Not a monorepo

export interface MonorepoInfo {
  type: MonorepoType;
  packages: MonorepoPackage[];
  rootPath: string;
}

export interface MonorepoPackage {
  name: string;
  path: string;
  language?: string;
}

/**
 * Cache entry for GitHub API responses
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
}

/**
 * Cache adapter interface for pluggable storage
 */
export interface CacheAdapter {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Parsed documentation from various languages
 */
export interface ParsedDocumentation {
  description?: string;
  params: Array<{
    name: string;
    type?: string;
    description?: string;
    required?: boolean;
    defaultValue?: any;
  }>;
  returns?: {
    type?: string;
    description?: string;
  };
  examples?: string[];
  throws?: string[];
  deprecated?: boolean;
  since?: string;
}
