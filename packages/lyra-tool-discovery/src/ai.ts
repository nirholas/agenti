import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { 
  DiscoveredTool, 
  TemplateDecision, 
  PluginTemplate,
  CustomPlugin,
  PluginIndexEntry,
  MCPHttpConnection,
  MCPStdioConnection
} from './types.js';

// ============================================
// AI Provider Types
// ============================================

export type AIProvider = 'anthropic' | 'openai';

export interface AIConfig {
  provider?: AIProvider;
  apiKey?: string;
  model?: string;
}

// ============================================
// Template Descriptions for AI Prompt
// ============================================

const TEMPLATE_DESCRIPTIONS = `
Available Plugin Templates for plugin.delivery:

## MCP Templates (for Model Context Protocol tools)

1. mcp-http - MCP Streamable HTTP
   - Type: MCP
   - Description: Remote MCP server with HTTP endpoint
   - Use Case: Tool has a publicly accessible MCP HTTP/SSE endpoint
   - Compatible with web and desktop versions
   
2. mcp-stdio - MCP STDIO  
   - Type: MCP
   - Description: Local MCP server via command line
   - Use Case: npm package that runs locally via npx/node
   - Requires local installation, desktop only

## Standard Plugin Templates (for non-MCP tools)

3. basic - Standard Plugin
   - Type: Default
   - Description: Standard plugin with API endpoint
   - Use Case: Simple data lookups, basic REST APIs
   
4. default - Plugin with Settings UI
   - Type: Default
   - Description: Plugin with configurable settings interface
   - Use Case: Configurable plugins that need user input (API keys, options)
   
5. markdown - Rich Text Output
   - Type: Markdown
   - Description: Plugin that renders rich formatted content
   - Use Case: Formatted reports, documentation, styled output
   
6. openapi - OpenAPI Spec
   - Type: OpenAPI
   - Description: Auto-generated plugin from OpenAPI/Swagger specification
   - Use Case: Existing APIs with OpenAPI spec available
   
7. settings - User Preferences
   - Type: Default
   - Description: Plugin for storing user preferences
   - Use Case: Personalized tools, saved configurations
   
8. standalone - Full React Application
   - Type: Standalone
   - Description: Complete interactive React application
   - Use Case: Interactive dashboards, complex UIs, data visualizations

## Decision Priority
1. If tool is an MCP server → use mcp-http or mcp-stdio
2. If tool has OpenAPI spec → use openapi
3. If tool needs complex UI → use standalone
4. If tool outputs formatted content → use markdown
5. If tool needs user config → use default or settings
6. Otherwise → use basic
`;

const ANALYSIS_PROMPT = `You are analyzing a discovered tool to determine the best SperaxOS plugin template.

${TEMPLATE_DESCRIPTIONS}

Analyze the following tool and decide:
1. Which template type is most appropriate
2. Generate the plugin configuration

Tool Information:
{TOOL_INFO}

Respond with valid JSON only, no markdown:
{
  "template": "one of: mcp-http, mcp-stdio, openapi, basic, default, markdown, standalone, settings",
  "reasoning": "brief explanation of why this template was chosen",
  "config": {
    // For mcp-http or mcp-stdio:
    "identifier": "plugin-name",
    "customParams": {
      "mcp": {
        "type": "http or stdio",
        "url": "for http type",
        "command": "for stdio type",
        "args": ["for stdio type"],
        "env": {"for stdio type": "value"}
      },
      "description": "plugin description",
      "avatar": "emoji or url"
    }
    // OR for other types, plugin index entry:
    "identifier": "plugin-name",
    "manifest": "url to manifest.json",
    "author": "author name",
    "meta": {
      "title": "Plugin Title",
      "description": "Plugin description",
      "avatar": "emoji or url",
      "tags": ["tag1", "tag2"]
    }
  }
}
`;

// ============================================
// AI Analyzer Class
// ============================================

export class AIAnalyzer {
  private provider: AIProvider;
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private model: string;
  
  constructor(config: AIConfig = {}) {
    // Determine provider from config or env vars
    this.provider = config.provider || this.detectProvider();
    this.model = config.model || this.getDefaultModel();
    
    // Initialize the appropriate client
    if (this.provider === 'anthropic') {
      this.anthropic = new Anthropic({
        apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY
      });
    } else {
      this.openai = new OpenAI({
        apiKey: config.apiKey || process.env.OPENAI_API_KEY
      });
    }
    
    console.log(`🤖 AI Provider: ${this.provider} (${this.model})`);
  }
  
  /**
   * Detect which provider to use based on available env vars
   */
  private detectProvider(): AIProvider {
    // Check for explicit provider setting
    const explicit = process.env.AI_PROVIDER?.toLowerCase();
    if (explicit === 'openai') return 'openai';
    if (explicit === 'anthropic') return 'anthropic';
    
    // Auto-detect based on available API keys
    if (process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      return 'openai';
    }
    if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
      return 'anthropic';
    }
    
    // Default to OpenAI if both are available (more common)
    if (process.env.OPENAI_API_KEY) {
      return 'openai';
    }
    
    // Fall back to Anthropic
    return 'anthropic';
  }
  
  /**
   * Get default model for the provider
   */
  private getDefaultModel(): string {
    // Allow override via env var
    if (process.env.AI_MODEL) {
      return process.env.AI_MODEL;
    }
    
    if (this.provider === 'openai') {
      return 'gpt-4o'; // or gpt-4-turbo, gpt-3.5-turbo
    }
    return 'claude-sonnet-4-20250514';
  }
  
  /**
   * Analyze a discovered tool and decide the best template
   */
  async analyzeAndDecide(tool: DiscoveredTool): Promise<TemplateDecision> {
    const toolInfo = this.formatToolInfo(tool);
    const prompt = ANALYSIS_PROMPT.replace('{TOOL_INFO}', toolInfo);
    
    let text: string;
    
    if (this.provider === 'anthropic' && this.anthropic) {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });
      
      text = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';
    } else if (this.openai) {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });
      
      text = response.choices[0]?.message?.content || '';
    } else {
      throw new Error('No AI client initialized');
    }
    
    return this.parseResponse(text);
  }
  
  /**
   * Parse the AI response into a TemplateDecision
   */
  private parseResponse(text: string): TemplateDecision {
    try {
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]) as {
        template: PluginTemplate;
        reasoning: string;
        config: CustomPlugin | PluginIndexEntry;
      };
      
      return {
        template: parsed.template,
        reasoning: parsed.reasoning,
        config: parsed.config
      };
    } catch (error) {
      console.error('Failed to parse AI response:', text);
      throw new Error(`AI response parsing failed: ${error}`);
    }
  }
  
  /**
   * Format tool info for the AI prompt
   */
  private formatToolInfo(tool: DiscoveredTool): string {
    const info: string[] = [
      `Name: ${tool.name}`,
      `Description: ${tool.description}`,
      `Source: ${tool.source}`,
      `URL: ${tool.sourceUrl}`,
    ];
    
    if (tool.author) info.push(`Author: ${tool.author}`);
    if (tool.license) info.push(`License: ${tool.license}`);
    if (tool.homepage) info.push(`Homepage: ${tool.homepage}`);
    if (tool.repository) info.push(`Repository: ${tool.repository}`);
    if (tool.hasOpenAPI) info.push(`Has OpenAPI: yes`);
    if (tool.hasMCPSupport) info.push(`Has MCP Support: yes`);
    if (tool.hasNpmPackage) info.push(`Has NPM Package: yes`);
    if (tool.manifestUrl) info.push(`Manifest URL: ${tool.manifestUrl}`);
    
    if (tool.mcpConfig) {
      info.push(`MCP Config: ${JSON.stringify(tool.mcpConfig, null, 2)}`);
    }
    
    if (tool.packageJson) {
      const pkg = tool.packageJson;
      info.push(`\nPackage.json highlights:`);
      if (pkg.name) info.push(`  - name: ${pkg.name}`);
      if (pkg.description) info.push(`  - description: ${pkg.description}`);
      if (pkg.bin) info.push(`  - bin: ${JSON.stringify(pkg.bin)}`);
      if (pkg.keywords) info.push(`  - keywords: ${JSON.stringify(pkg.keywords)}`);
    }
    
    if (tool.readme) {
      // Truncate readme to first 2000 chars
      const truncatedReadme = tool.readme.length > 2000 
        ? tool.readme.substring(0, 2000) + '...[truncated]'
        : tool.readme;
      info.push(`\nREADME:\n${truncatedReadme}`);
    }
    
    return info.join('\n');
  }
  
  /**
   * Generate MCP Quick Import JSON for easy pasting into SperaxOS
   */
  generateQuickImport(decision: TemplateDecision): string | null {
    const config = decision.config as CustomPlugin;
    
    if (!config.customParams?.mcp) {
      return null; // Not an MCP plugin
    }
    
    const mcp = config.customParams.mcp;
    
    if (mcp.type === 'http') {
      const httpMcp = mcp as MCPHttpConnection;
      return JSON.stringify({
        mcpServers: {
          [config.identifier]: {
            url: httpMcp.url,
            ...(httpMcp.auth && httpMcp.auth.type !== 'none' ? { auth: httpMcp.auth } : {}),
            ...(httpMcp.headers ? { headers: httpMcp.headers } : {})
          }
        }
      }, null, 2);
    }
    
    if (mcp.type === 'stdio') {
      const stdioMcp = mcp as MCPStdioConnection;
      return JSON.stringify({
        mcpServers: {
          [config.identifier]: {
            command: stdioMcp.command,
            args: stdioMcp.args || [],
            ...(stdioMcp.env ? { env: stdioMcp.env } : {})
          }
        }
      }, null, 2);
    }
    
    return null;
  }
  
  /**
   * Get current provider info
   */
  getProviderInfo(): { provider: AIProvider; model: string } {
    return { provider: this.provider, model: this.model };
  }
}

/**
 * Quick helper to get available providers
 */
export function getAvailableProviders(): AIProvider[] {
  const available: AIProvider[] = [];
  if (process.env.ANTHROPIC_API_KEY) available.push('anthropic');
  if (process.env.OPENAI_API_KEY) available.push('openai');
  return available;
}
