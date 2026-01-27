/**
 * Plugin Types for SperaxOS
 * 
 * Based on analysis of SperaxOS source code:
 * - MCP Plugins: http (Streamable HTTP) or stdio (local command)
 * - Online Link Plugins: Traditional manifest URL
 * - Templates: basic, default, markdown, openapi, settings, standalone
 */

// ============================================
// MCP Plugin Types
// ============================================

export type MCPType = 'http' | 'stdio';

export interface MCPAuthConfig {
  type: 'none' | 'bearer' | 'oauth2';
  token?: string;
  accessToken?: string;
}

export interface MCPHttpConnection {
  type: 'http';
  url: string;
  auth?: MCPAuthConfig;
  headers?: Record<string, string>;
}

export interface MCPStdioConnection {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export type MCPConnection = MCPHttpConnection | MCPStdioConnection;

// ============================================
// Plugin Configuration (for Quick Import)
// ============================================

/**
 * Quick Import format for MCP plugins
 * Can be either nested or flat structure
 */
export interface MCPQuickImportConfig {
  mcpServers?: {
    [identifier: string]: Omit<MCPHttpConnection, 'type'> | Omit<MCPStdioConnection, 'type'>;
  };
}

/**
 * Full custom plugin params as used in SperaxOS
 */
export interface CustomPluginParams {
  mcp?: MCPConnection;
  description?: string;
  avatar?: string;
  manifestUrl?: string;
  useProxy?: boolean;
}

export interface CustomPlugin {
  identifier: string;
  customParams?: CustomPluginParams;
  manifest?: PluginManifest;
}

// ============================================
// Plugin Manifest Types
// ============================================

export interface PluginAPI {
  url: string;
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface PluginMeta {
  title: string;
  description: string;
  avatar?: string;
  tags?: string[];
  category?: string;
}

export interface PluginManifest {
  identifier: string;
  version?: string;
  api?: PluginAPI[];
  ui?: {
    url: string;
    height?: number;
    width?: number;
  };
  gateway?: string;
  meta?: PluginMeta;
}

// ============================================
// Plugin Index Entry (for plugin.delivery)
// ============================================

export interface PluginIndexEntry {
  identifier: string;
  manifest: string;
  author: string;
  homepage?: string;
  createdAt?: string;
  meta: PluginMeta;
  schemaVersion?: number;
}

// ============================================
// Template Types (plugin.delivery templates)
// ============================================

/**
 * Plugin Templates for plugin.delivery
 * 
 * | Template   | Type       | Description                      | Use Case              |
 * |------------|------------|----------------------------------|-----------------------|
 * | basic      | Default    | Standard plugin with API endpoint| Simple data lookups   |
 * | default    | Default    | Plugin with settings UI          | Configurable plugins  |
 * | markdown   | Markdown   | Rich text output                 | Formatted reports     |
 * | openapi    | OpenAPI    | Auto-generated from spec         | Existing APIs         |
 * | settings   | Default    | Plugin with user preferences     | Personalized tools    |
 * | standalone | Standalone | Full React application           | Interactive dashboards|
 * | mcp-http   | MCP        | Streamable HTTP MCP server       | Remote MCP tools      |
 * | mcp-stdio  | MCP        | STDIO-based MCP server           | Local npm MCP tools   |
 */
export type PluginTemplate = 
  | 'basic'      // Default type - Standard plugin with API endpoint (simple data lookups)
  | 'default'    // Default type - Plugin with settings UI (configurable plugins)
  | 'markdown'   // Markdown type - Rich text output (formatted reports)
  | 'openapi'    // OpenAPI type - Auto-generated from spec (existing APIs)
  | 'settings'   // Default type - Plugin with user preferences (personalized tools)
  | 'standalone' // Standalone type - Full React application (interactive dashboards)
  | 'mcp-http'   // MCP type - Streamable HTTP MCP server (remote MCP tools)
  | 'mcp-stdio'; // MCP type - STDIO-based MCP server (local npm MCP tools)

export interface TemplateDecision {
  template: PluginTemplate;
  reasoning: string;
  config: CustomPlugin | PluginIndexEntry;
}

// ============================================
// Discovery Types
// ============================================

export type DiscoverySource = 
  | 'github'
  | 'npm' 
  | 'smithery'
  | 'mcp-directory'
  | 'openapi-directory'
  | 'rapidapi';

export interface DiscoveredTool {
  id: string;
  name: string;
  description: string;
  source: DiscoverySource;
  sourceUrl: string;
  
  // Optional fields discovered
  license?: string;
  author?: string;
  homepage?: string;
  repository?: string;
  
  // Type hints
  hasOpenAPI?: boolean;
  hasMCPSupport?: boolean;
  hasNpmPackage?: boolean;
  
  // Raw data for AI analysis
  readme?: string;
  packageJson?: Record<string, unknown>;
  manifestUrl?: string;
  mcpConfig?: MCPConnection;
}

export interface DiscoveryResult {
  tool: DiscoveredTool;
  decision: TemplateDecision;
  generated: {
    pluginConfig: CustomPlugin | PluginIndexEntry;
    files?: Record<string, string>; // filename -> content
  };
}
