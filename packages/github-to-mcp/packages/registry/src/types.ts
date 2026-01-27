/**
 * @fileoverview Type definitions for MCP Registry
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license Apache-2.0
 */

/**
 * Quality metrics for a tool or server
 */
export interface QualityScore {
  /** Overall quality score (0-100) */
  overall: number;
  /** Schema completeness - required fields, types defined (0-100) */
  schemaCompleteness: number;
  /** Documentation quality - descriptions, examples (0-100) */
  documentation: number;
  /** Has examples in OpenAPI or code (0-100) */
  examples: number;
  /** Authentication handling clarity (0-100) */
  authHandling: number;
  /** Parameter type coverage (0-100) */
  parameterTypes: number;
}

/**
 * Summary of a tool in the registry
 */
export interface ToolSummary {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Source of extraction (openapi, readme, code, etc.) */
  source: string;
  /** Number of parameters */
  paramCount: number;
  /** Whether authentication is required */
  requiresAuth: boolean;
}

/**
 * Authentication scheme detected for an API
 */
export interface AuthScheme {
  /** Type of authentication */
  type: 'apiKey' | 'oauth2' | 'http' | 'openIdConnect' | 'none';
  /** Name of the auth header/param */
  name?: string;
  /** Location of the auth credential */
  in?: 'header' | 'query' | 'cookie';
  /** HTTP scheme (bearer, basic) */
  scheme?: 'bearer' | 'basic';
  /** Environment variable name for the credential */
  envVar?: string;
  /** Description of how to obtain credentials */
  instructions?: string;
}

/**
 * IDE configuration formats
 */
export interface IdeConfigs {
  /** Claude Desktop configuration */
  claude: {
    mcpServers: Record<string, {
      command: string;
      args: string[];
      env?: Record<string, string>;
    }>;
  };
  /** Cursor configuration */
  cursor: {
    mcpServers: Record<string, {
      command: string;
      args: string[];
      env?: Record<string, string>;
    }>;
  };
  /** VS Code configuration */
  vscode: {
    mcpServers: Record<string, {
      command: string;
      args: string[];
      env?: Record<string, string>;
    }>;
  };
}

/**
 * Generated code for different languages
 */
export interface GeneratedCode {
  /** TypeScript MCP server code */
  typescript: string;
  /** Python MCP server code (optional) */
  python?: string;
  /** Go MCP server code (optional) */
  go?: string;
}

/**
 * A registry entry for a pre-converted MCP server
 */
export interface RegistryEntry {
  /** Unique identifier (e.g., "stripe-mcp") */
  id: string;
  /** Display name (e.g., "Stripe") */
  name: string;
  /** Short description */
  description: string;
  /** Source GitHub repository (e.g., "stripe/stripe-node") */
  sourceRepo: string;
  /** Source repository URL */
  sourceUrl: string;
  /** Registry entry version */
  version: string;
  /** Source repo version/commit this was generated from */
  sourceVersion: string;
  /** Number of tools */
  toolCount: number;
  /** Summary of all tools */
  tools: ToolSummary[];
  /** Categories for filtering */
  categories: string[];
  /** Tags for search */
  tags: string[];
  /** Download/install count */
  popularity: number;
  /** Last updated timestamp */
  lastUpdated: string;
  /** When entry was created */
  createdAt: string;
  /** Generated code for each language */
  generatedCode: GeneratedCode;
  /** IDE configuration snippets */
  configs: IdeConfigs;
  /** Quality metrics */
  quality: QualityScore;
  /** Authentication requirements */
  auth: AuthScheme[];
  /** Documentation URL */
  docsUrl?: string;
  /** API documentation URL */
  apiDocsUrl?: string;
  /** Logo/icon URL */
  iconUrl?: string;
  /** Whether this is an official/verified entry */
  verified: boolean;
  /** Author of the registry entry */
  author: string;
}

/**
 * Minimal registry entry for list views
 */
export interface RegistryEntrySummary {
  id: string;
  name: string;
  description: string;
  sourceRepo: string;
  version: string;
  toolCount: number;
  categories: string[];
  popularity: number;
  quality: number;
  verified: boolean;
  lastUpdated: string;
}

/**
 * Options for listing registry entries
 */
export interface ListOptions {
  /** Filter by category */
  category?: string;
  /** Search query */
  search?: string;
  /** Sort field */
  sortBy?: 'popularity' | 'name' | 'quality' | 'lastUpdated' | 'toolCount';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Pagination offset */
  offset?: number;
  /** Pagination limit */
  limit?: number;
  /** Only show verified entries */
  verifiedOnly?: boolean;
}

/**
 * Result of a list operation
 */
export interface ListResult {
  entries: RegistryEntrySummary[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Options for installing a registry entry
 */
export interface InstallOptions {
  /** Target IDE/tool */
  target: 'claude' | 'cursor' | 'vscode' | 'file';
  /** Output directory (for 'file' target) */
  outputDir?: string;
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Language preference */
  language?: 'typescript' | 'python';
  /** Overwrite existing installation */
  overwrite?: boolean;
}

/**
 * Result of an install operation
 */
export interface InstallResult {
  success: boolean;
  /** Path to installed files or config */
  path?: string;
  /** Installation instructions */
  instructions?: string[];
  /** Error message if failed */
  error?: string;
}

/**
 * Information about available updates
 */
export interface UpdateInfo {
  /** Entry ID */
  id: string;
  /** Current installed version */
  currentVersion: string;
  /** Latest available version */
  latestVersion: string;
  /** What changed */
  changelog?: string;
  /** Whether update is breaking */
  breaking: boolean;
}

/**
 * Storage adapter interface for registry data
 */
export interface StorageAdapter {
  /** Get an entry by ID */
  get(id: string): Promise<RegistryEntry | null>;
  /** List all entries */
  list(options?: ListOptions): Promise<ListResult>;
  /** Save an entry */
  save(entry: RegistryEntry): Promise<void>;
  /** Delete an entry */
  delete(id: string): Promise<boolean>;
  /** Check if entry exists */
  exists(id: string): Promise<boolean>;
  /** Get all categories */
  getCategories(): Promise<string[]>;
  /** Search entries */
  search(query: string): Promise<RegistryEntrySummary[]>;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalEntries: number;
  totalTools: number;
  totalDownloads: number;
  categories: { name: string; count: number }[];
  topEntries: RegistryEntrySummary[];
  recentlyUpdated: RegistryEntrySummary[];
}
