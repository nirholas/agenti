/**
 * @fileoverview MCP server introspection - extract tools from existing MCP repos
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { ExtractedTool, McpToolDefinition } from './types';

/**
 * Extract tool definitions from existing MCP server code
 */
export class McpIntrospector {
  /**
   * Extract tools from TypeScript/JavaScript MCP server code
   */
  extractFromTypeScript(code: string, filePath: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];

    // Pattern 1: Tool definitions in array format
    // tools: [{ name: "...", description: "...", inputSchema: {...} }]
    const toolArrayMatch = code.match(/tools\s*:\s*\[([\s\S]*?)\]/);
    if (toolArrayMatch) {
      const toolsFromArray = this.parseToolArray(toolArrayMatch[1], filePath);
      tools.push(...toolsFromArray);
    }

    // Pattern 2: ListToolsRequestSchema handler
    // server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...] }))
    const listToolsMatch = code.match(
      /setRequestHandler\s*\(\s*ListToolsRequestSchema[\s\S]*?tools\s*:\s*\[([\s\S]*?)\]\s*\}/
    );
    if (listToolsMatch) {
      const toolsFromHandler = this.parseToolArray(listToolsMatch[1], filePath);
      tools.push(...toolsFromHandler);
    }

    // Pattern 3: Individual tool definitions
    // { name: "tool_name", description: "...", inputSchema: {...} }
    const individualToolMatches = code.matchAll(
      /\{\s*name\s*:\s*['"`](\w+)['"`]\s*,\s*description\s*:\s*['"`]([^'"`]+)['"`]\s*,\s*inputSchema\s*:\s*(\{[\s\S]*?\})\s*\}/g
    );
    for (const match of individualToolMatches) {
      const [, name, description, schemaStr] = match;
      try {
        // Try to parse the schema (may fail for complex cases)
        const inputSchema = this.parseJsonLike(schemaStr);
        tools.push({
          name,
          description,
          inputSchema,
          source: { type: 'mcp-introspect', file: filePath }
        });
      } catch {
        // Fallback with basic schema
        tools.push({
          name,
          description,
          inputSchema: { type: 'object', properties: {}, required: [] },
          source: { type: 'mcp-introspect', file: filePath }
        });
      }
    }

    // Pattern 4: server.tool() calls (MCP SDK pattern)
    // server.tool("name", "description", { schema }, handler)
    const serverToolMatches = code.matchAll(
      /server\.tool\s*\(\s*['"`](\w+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,?\s*(\{[\s\S]*?\})?\s*,/g
    );
    for (const match of serverToolMatches) {
      const [, name, description, schemaStr] = match;
      let inputSchema = { type: 'object', properties: {}, required: [] as string[] };
      
      if (schemaStr) {
        try {
          inputSchema = this.parseJsonLike(schemaStr);
        } catch { /* use default */ }
      }
      
      tools.push({
        name,
        description,
        inputSchema,
        source: { type: 'mcp-introspect', file: filePath }
      });
    }

    return this.deduplicateTools(tools);
  }

  /**
   * Extract tools from Python MCP server code
   */
  extractFromPython(code: string, filePath: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];

    // Pattern 1: @server.tool() decorator
    // @server.tool()
    // async def tool_name(arg1: str, arg2: int) -> str:
    //     """Description"""
    const decoratorMatches = code.matchAll(
      /@(?:server|mcp)\.(?:tool|call_tool)\s*\([^)]*\)\s*\n\s*(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)[^:]*:\s*\n\s*(?:"""([^"]+)"""|'''([^']+)''')?/g
    );
    
    for (const match of decoratorMatches) {
      const [, name, argsStr, docstring1, docstring2] = match;
      const description = (docstring1 || docstring2 || `Python tool: ${name}`).trim();
      const inputSchema = this.pythonArgsToSchema(argsStr);
      
      tools.push({
        name,
        description,
        inputSchema,
        source: { type: 'mcp-introspect', file: filePath }
      });
    }

    // Pattern 2: Tool class definitions
    // class MyTool(Tool):
    //     name = "my_tool"
    //     description = "..."
    const classMatches = code.matchAll(
      /class\s+(\w+)\s*\([^)]*Tool[^)]*\)[\s\S]*?name\s*=\s*['"`](\w+)['"`][\s\S]*?description\s*=\s*['"`]([^'"`]+)['"`]/g
    );
    
    for (const match of classMatches) {
      const [, , name, description] = match;
      tools.push({
        name,
        description,
        inputSchema: { type: 'object', properties: {}, required: [] },
        source: { type: 'mcp-introspect', file: filePath }
      });
    }

    // Pattern 3: tools list/dict
    // tools = [{"name": "...", "description": "..."}]
    const toolsListMatch = code.match(/tools\s*=\s*\[([\s\S]*?)\]/);
    if (toolsListMatch) {
      const dictMatches = toolsListMatch[1].matchAll(
        /\{\s*["']name["']\s*:\s*["'](\w+)["']\s*,\s*["']description["']\s*:\s*["']([^"']+)["']/g
      );
      for (const m of dictMatches) {
        tools.push({
          name: m[1],
          description: m[2],
          inputSchema: { type: 'object', properties: {}, required: [] },
          source: { type: 'mcp-introspect', file: filePath }
        });
      }
    }

    return this.deduplicateTools(tools);
  }

  /**
   * Parse Python function arguments to JSON schema
   */
  private pythonArgsToSchema(argsStr: string): { type: string; properties: Record<string, any>; required: string[] } {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Parse args like: arg1: str, arg2: int = 5, arg3: Optional[str] = None
    const argMatches = argsStr.matchAll(
      /(\w+)\s*:\s*([^,=]+)(?:\s*=\s*([^,]+))?/g
    );

    for (const match of argMatches) {
      const [, name, typeHint, defaultValue] = match;
      if (name === 'self' || name === 'ctx' || name === 'context') continue;

      const jsonType = this.pythonTypeToJsonType(typeHint.trim());
      properties[name] = {
        type: jsonType,
        description: `${name} parameter`
      };

      // If no default value and not Optional, it's required
      if (!defaultValue && !typeHint.includes('Optional') && !typeHint.includes('None')) {
        required.push(name);
      }
    }

    return { type: 'object', properties, required };
  }

  /**
   * Map Python type hints to JSON Schema types
   */
  private pythonTypeToJsonType(pyType: string): string {
    const typeMap: Record<string, string> = {
      'str': 'string',
      'int': 'integer',
      'float': 'number',
      'bool': 'boolean',
      'list': 'array',
      'dict': 'object',
      'List': 'array',
      'Dict': 'object',
      'Any': 'string'
    };

    // Handle Optional[X], List[X], etc
    const baseMatch = pyType.match(/^(?:Optional|List|Dict|Union)?\[?(\w+)/);
    if (baseMatch) {
      return typeMap[baseMatch[1]] || 'string';
    }

    return typeMap[pyType] || 'string';
  }

  /**
   * Parse a tool array string into tool definitions
   */
  private parseToolArray(arrayContent: string, filePath: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    
    // Find each tool object
    const toolMatches = arrayContent.matchAll(
      /\{\s*(?:["'])?name(?:["'])?\s*:\s*["'](\w+)["']\s*,\s*(?:["'])?description(?:["'])?\s*:\s*["']([^"']+)["']/g
    );

    for (const match of toolMatches) {
      tools.push({
        name: match[1],
        description: match[2],
        inputSchema: { type: 'object', properties: {}, required: [] },
        source: { type: 'mcp-introspect', file: filePath }
      });
    }

    return tools;
  }

  /**
   * Parse JSON-like object strings (handles some JS patterns)
   */
  private parseJsonLike(str: string): any {
    // Convert JS object syntax to valid JSON
    let jsonStr = str
      .replace(/(\w+)\s*:/g, '"$1":')  // unquoted keys
      .replace(/'/g, '"')               // single to double quotes
      .replace(/,\s*}/g, '}')          // trailing commas
      .replace(/,\s*]/g, ']');

    return JSON.parse(jsonStr);
  }

  /**
   * Remove duplicate tools by name
   */
  private deduplicateTools(tools: ExtractedTool[]): ExtractedTool[] {
    const seen = new Set<string>();
    return tools.filter(tool => {
      if (seen.has(tool.name)) return false;
      seen.add(tool.name);
      return true;
    });
  }

  /**
   * Detect if a file is likely an MCP server
   */
  isLikelyMcpServer(code: string): boolean {
    const indicators = [
      '@modelcontextprotocol',
      'mcp.server',
      'McpServer',
      'MCP server',
      'ListToolsRequestSchema',
      'CallToolRequestSchema',
      'StdioServerTransport',
      '@server.tool',
      'from mcp',
      'import mcp'
    ];

    return indicators.some(indicator => code.includes(indicator));
  }
}
