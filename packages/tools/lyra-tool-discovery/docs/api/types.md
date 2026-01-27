# Type Definitions

Complete TypeScript type definitions for Lyra Tool Discovery.

## Import Types

```typescript
import type {
  // Discovery
  DiscoveredTool,
  DiscoveryResult,
  DiscoverySource,
  DiscoveryOptions,
  
  // Templates
  TemplateDecision,
  PluginTemplate,
  
  // MCP
  MCPType,
  MCPConnection,
  MCPHttpConnection,
  MCPStdioConnection,
  MCPAuthConfig,
  MCPQuickImportConfig,
  
  // Plugins
  CustomPlugin,
  CustomPluginParams,
  PluginManifest,
  PluginIndexEntry,
  PluginAPI,
  PluginMeta,
  
  // AI
  AIConfig,
  AIProvider
} from '@nirholas/lyra-tool-discovery';
```

## Discovery Types

### DiscoveredTool

Represents a tool discovered from a source.

```typescript
interface DiscoveredTool {
  // Required fields
  id: string;                    // Unique ID (e.g., "github:owner/repo")
  name: string;                  // Display name
  description: string;           // Brief description
  source: DiscoverySource;       // Source type
  sourceUrl: string;             // URL to source
  
  // Optional metadata
  license?: string;              // License identifier
  author?: string;               // Author/owner
  homepage?: string;             // Project homepage
  repository?: string;           // Repository URL
  
  // Type hints
  hasOpenAPI?: boolean;          // Has OpenAPI spec
  hasMCPSupport?: boolean;       // MCP compatible
  hasNpmPackage?: boolean;       // Has npm package
  
  // Raw data for AI
  readme?: string;               // README content
  packageJson?: Record<string, unknown>;  // package.json data
  manifestUrl?: string;          // Plugin manifest URL
  mcpConfig?: MCPConnection;     // Pre-detected MCP config
}
```

### DiscoveryResult

Result of analyzing a discovered tool.

```typescript
interface DiscoveryResult {
  tool: DiscoveredTool;
  decision: TemplateDecision;
  generated: {
    pluginConfig: CustomPlugin | PluginIndexEntry;
    files?: Record<string, string>;  // Generated file contents
  };
}
```

### DiscoverySource

Available discovery sources.

```typescript
type DiscoverySource = 
  | 'github'
  | 'npm' 
  | 'smithery'
  | 'mcp-directory'
  | 'openapi-directory'
  | 'rapidapi';
```

### DiscoveryOptions

Options for the discover() method.

```typescript
interface DiscoveryOptions {
  sources?: DiscoverySource[];  // Default: ['github', 'npm']
  limit?: number;                // Default: 10
  dryRun?: boolean;              // Default: false
  outputDir?: string;            // Output directory
}
```

## Template Types

### PluginTemplate

Available plugin templates.

```typescript
type PluginTemplate = 
  | 'basic'      // Standard plugin with API
  | 'default'    // Plugin with settings UI
  | 'markdown'   // Rich text output
  | 'openapi'    // OpenAPI spec wrapper
  | 'settings'   // User preferences
  | 'standalone' // Full React app
  | 'mcp-http'   // Remote MCP server
  | 'mcp-stdio'; // Local MCP server
```

### TemplateDecision

AI's template selection and configuration.

```typescript
interface TemplateDecision {
  template: PluginTemplate;
  reasoning: string;
  config: CustomPlugin | PluginIndexEntry;
}
```

## MCP Types

### MCPType

MCP connection types.

```typescript
type MCPType = 'http' | 'stdio';
```

### MCPConnection

Union of MCP connection types.

```typescript
type MCPConnection = MCPHttpConnection | MCPStdioConnection;
```

### MCPHttpConnection

HTTP-based MCP connection.

```typescript
interface MCPHttpConnection {
  type: 'http';
  url: string;
  auth?: MCPAuthConfig;
  headers?: Record<string, string>;
}
```

### MCPStdioConnection

STDIO-based MCP connection.

```typescript
interface MCPStdioConnection {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}
```

### MCPAuthConfig

Authentication configuration for MCP.

```typescript
interface MCPAuthConfig {
  type: 'none' | 'bearer' | 'oauth2';
  token?: string;
  accessToken?: string;
}
```

### MCPQuickImportConfig

Quick Import format for SperaxOS.

```typescript
interface MCPQuickImportConfig {
  mcpServers?: {
    [identifier: string]: 
      | Omit<MCPHttpConnection, 'type'> 
      | Omit<MCPStdioConnection, 'type'>;
  };
}
```

## Plugin Types

### CustomPlugin

Custom plugin configuration.

```typescript
interface CustomPlugin {
  identifier: string;
  customParams?: CustomPluginParams;
  manifest?: PluginManifest;
}
```

### CustomPluginParams

Parameters for custom plugins.

```typescript
interface CustomPluginParams {
  mcp?: MCPConnection;
  description?: string;
  avatar?: string;
  manifestUrl?: string;
  useProxy?: boolean;
}
```

### PluginManifest

Plugin manifest structure.

```typescript
interface PluginManifest {
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
```

### PluginAPI

Plugin API definition.

```typescript
interface PluginAPI {
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
```

### PluginMeta

Plugin metadata.

```typescript
interface PluginMeta {
  title: string;
  description: string;
  avatar?: string;
  tags?: string[];
  category?: string;
}
```

### PluginIndexEntry

Entry in the plugin index.

```typescript
interface PluginIndexEntry {
  identifier: string;
  manifest: string;              // URL to manifest
  author: string;
  homepage?: string;
  createdAt?: string;
  meta: PluginMeta;
  schemaVersion?: number;
}
```

## AI Types

### AIProvider

Available AI providers.

```typescript
type AIProvider = 'anthropic' | 'openai';
```

### AIConfig

AI configuration options.

```typescript
interface AIConfig {
  provider?: AIProvider;
  apiKey?: string;
  model?: string;
}
```

## Usage Examples

### Type Guards

```typescript
function isMCPPlugin(config: CustomPlugin | PluginIndexEntry): config is CustomPlugin {
  return 'customParams' in config && config.customParams?.mcp !== undefined;
}

function isHttpMCP(conn: MCPConnection): conn is MCPHttpConnection {
  return conn.type === 'http';
}

function isStdioMCP(conn: MCPConnection): conn is MCPStdioConnection {
  return conn.type === 'stdio';
}
```

### Working with Results

```typescript
import type { DiscoveryResult, MCPStdioConnection } from '@nirholas/lyra-tool-discovery';

function extractStdioConfigs(results: DiscoveryResult[]): MCPStdioConnection[] {
  return results
    .filter(r => r.decision.template === 'mcp-stdio')
    .map(r => {
      const config = r.generated.pluginConfig as CustomPlugin;
      return config.customParams?.mcp as MCPStdioConnection;
    })
    .filter(Boolean);
}
```

### Building Configs Manually

```typescript
import type { CustomPlugin, MCPStdioConnection } from '@nirholas/lyra-tool-discovery';

const myPlugin: CustomPlugin = {
  identifier: 'my-mcp-tool',
  customParams: {
    mcp: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@my-org/mcp-tool'],
      env: {
        API_KEY: '${MY_API_KEY}'
      }
    } satisfies MCPStdioConnection,
    description: 'My custom MCP tool',
    avatar: '🔧'
  }
};
```

## Next Steps

- [ToolDiscovery](/api/tool-discovery) - Main class reference
- [AIAnalyzer](/api/ai-analyzer) - AI analyzer reference
- [Examples](/examples/) - Usage examples
