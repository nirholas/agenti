/**
 * @fileoverview readme-extractor module implementation
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * README Extractor
 * Extract API information from README markdown files
 */

import { marked } from 'marked';
import { ExtractedTool, CodeExample } from './types';

export class ReadmeExtractor {
  /**
   * Extract tools from README
   */
  async extract(readme: string): Promise<ExtractedTool[]> {
    const tools: ExtractedTool[] = [];

    // Parse markdown
    const tokens = marked.lexer(readme);

    // 1. Extract from code examples (JS/TS)
    const examples = this.extractCodeExamples(tokens);
    for (const example of examples) {
      const tool = this.exampleToTool(example);
      if (tool) {
        tools.push(tool);
      }
    }

    // 2. Extract from Python @mcp.tool decorators
    const pythonTools = this.extractPythonMcpTools(tokens);
    tools.push(...pythonTools);

    // 3. Extract from tool lists in text ("Available Tools" sections)
    const listTools = this.extractToolLists(tokens);
    tools.push(...listTools);

    return tools;
  }

  /**
   * Extract Python MCP tools from code blocks
   */
  private extractPythonMcpTools(tokens: any[]): ExtractedTool[] {
    const tools: ExtractedTool[] = [];

    for (const token of tokens) {
      if (token.type === 'code' && (token.lang === 'python' || token.lang === 'py')) {
        // Match @mcp.tool decorators
        const mcpToolPattern = /@mcp\.tool\s*\(\s*name\s*=\s*["']([^"']+)["']\s*,\s*description\s*=\s*["']([^"']+)["']/g;
        let match;
        while ((match = mcpToolPattern.exec(token.text)) !== null) {
          tools.push({
            name: match[1],
            description: match[2],
            inputSchema: { type: 'object', properties: {}, required: [] },
            source: { type: 'readme', file: 'README.md', line: 0 }
          });
        }

        // Match FastMCP tool decorator patterns
        const fastMcpPattern = /@(\w+)\.tool\s*(?:\(([^)]+)\))?/g;
        while ((match = fastMcpPattern.exec(token.text)) !== null) {
          const args = match[2] || '';
          const nameMatch = args.match(/name\s*=\s*["']([^"']+)["']/);
          const descMatch = args.match(/description\s*=\s*["']([^"']+)["']/);
          if (nameMatch) {
            tools.push({
              name: nameMatch[1],
              description: descMatch?.[1] || `${nameMatch[1]} tool`,
              inputSchema: { type: 'object', properties: {}, required: [] },
              source: { type: 'readme', file: 'README.md', line: 0 }
            });
          }
        }
      }
    }

    return tools;
  }

  /**
   * Extract tools from text lists ("Available Tools", "Tools", etc.)
   */
  private extractToolLists(tokens: any[]): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    let inToolsSection = false;
    const toolsSectionPatterns = /^(available\s+tools?|tools?|features|capabilities|commands?)$/i;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Check for tools section heading
      if (token.type === 'heading') {
        inToolsSection = toolsSectionPatterns.test(token.text.trim());
        continue;
      }

      // Extract from bullet lists in tools section
      if (inToolsSection && token.type === 'list') {
        for (const item of token.items || []) {
          const tool = this.parseToolListItem(item.text || item.raw || '');
          if (tool) {
            tools.push(tool);
          }
        }
      }

      // Also check paragraphs for inline tool mentions
      if (inToolsSection && token.type === 'paragraph') {
        const inlineTools = this.parseInlineTools(token.text || '');
        tools.push(...inlineTools);
      }
    }

    return tools;
  }

  /**
   * Parse a tool list item like "**View:** Read files" or "- Edit: Modify files"
   */
  private parseToolListItem(text: string): ExtractedTool | null {
    // Pattern: **ToolName:** Description or ToolName: Description
    const patterns = [
      /^\*\*([\w-]+)\*\*[:\s]+(.+)$/,
      /^\*([\w-]+)\*[:\s]+(.+)$/,
      /^([\w-]+)[:\s]+(.+)$/,
      /^`([\w-]+)`[:\s]+(.+)$/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const name = match[1].trim();
        const description = match[2].trim();

        // Skip common non-tool patterns
        if (this.isLikelyTool(name)) {
          return {
            name: this.normalizeToolName(name),
            description,
            inputSchema: { type: 'object', properties: {}, required: [] },
            source: { type: 'readme', file: 'README.md', line: 0 }
          };
        }
      }
    }

    return null;
  }

  /**
   * Parse inline tool mentions
   */
  private parseInlineTools(text: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    
    // Look for patterns like "The Edit tool allows..." or "Use the GrepTool for..."
    const pattern = /(?:the\s+)?([A-Z][a-zA-Z]+(?:Tool)?)[:\s]+([^.]+\.)/gi;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1];
      const description = match[2].trim();
      
      if (this.isLikelyTool(name)) {
        tools.push({
          name: this.normalizeToolName(name),
          description,
          inputSchema: { type: 'object', properties: {}, required: [] },
          source: { type: 'readme', file: 'README.md', line: 0 }
        });
      }
    }
    
    return tools;
  }

  /**
   * Check if name looks like a tool
   */
  private isLikelyTool(name: string): boolean {
    // Tool names are usually PascalCase or contain 'Tool'
    const toolPatterns = [
      /^[A-Z][a-z]+[A-Z]/, // PascalCase
      /Tool$/i, // Ends with Tool
      /^(get|set|list|create|update|delete|fetch|search|run|execute)/i, // Common verbs
      /^(View|Edit|Replace|Bash|LS|Grep|Glob|Read|Write)/i // Known tool names
    ];
    
    // Skip common non-tool words
    const skipWords = /^(the|a|an|is|are|this|that|or|and|for|with|to|from|in|on|at)$/i;
    if (skipWords.test(name)) return false;
    
    return toolPatterns.some(p => p.test(name));
  }

  /**
   * Normalize tool name to consistent format
   */
  private normalizeToolName(name: string): string {
    // Remove 'Tool' suffix if present, keep PascalCase
    return name.replace(/Tool$/i, '');
  }

  /**
   * Extract code examples from markdown tokens
   */
  private extractCodeExamples(tokens: any[]): CodeExample[] {
    const examples: CodeExample[] = [];
    let currentHeading = '';

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'heading') {
        currentHeading = token.text;
      }

      if (token.type === 'code') {
        const lang = token.lang || 'javascript';
        
        if (this.isApiExample(token.text, lang)) {
          examples.push({
            code: token.text,
            language: lang,
            description: currentHeading,
            file: 'README.md',
            line: 0
          });
        }
      }
    }

    return examples;
  }

  /**
   * Check if code block is an API example
   */
  private isApiExample(code: string, lang: string): boolean {
    // Must be JavaScript/TypeScript
    if (!['javascript', 'typescript', 'js', 'ts'].includes(lang)) {
      return false;
    }

    // Look for API call patterns
    const patterns = [
      /\.get\(/,
      /\.post\(/,
      /\.put\(/,
      /\.delete\(/,
      /\.patch\(/,
      /fetch\(/,
      /axios\./,
      /\.create\(/,
      /\.update\(/,
      /\.list\(/,
      /\.retrieve\(/
    ];

    return patterns.some(pattern => pattern.test(code));
  }

  /**
   * Convert code example to MCP tool
   */
  private exampleToTool(example: CodeExample): ExtractedTool | null {
    try {
      // Extract method name
      const methodMatch = example.code.match(/(?:await\s+)?(?:\w+\.)?(\w+)\(/);
      if (!methodMatch) return null;

      const methodName = methodMatch[1];

      // Extract parameters
      const params = this.extractParameters(example.code);

      // Extract description
      const description = example.description || `Call ${methodName}`;

      return {
        name: this.toToolName(methodName),
        description,
        inputSchema: {
          type: 'object',
          properties: params,
          required: Object.keys(params).filter(k => params[k].required)
        },
        implementation: this.generateImplementation(methodName, params),
        examples: [example.code],
        source: {
          type: 'readme',
          file: example.file,
          line: example.line
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract parameters from code
   */
  private extractParameters(code: string): Record<string, any> {
    const params: Record<string, any> = {};

    // Look for object literals passed as arguments
    const objectMatch = code.match(/\{([^}]+)\}/);
    if (objectMatch) {
      const objectContent = objectMatch[1];
      
      // Extract key-value pairs
      const pairs = objectContent.split(',');
      for (const pair of pairs) {
        const [key, value] = pair.split(':').map(s => s.trim());
        if (key && value) {
          params[key] = {
            type: this.inferType(value),
            description: `${key} parameter`,
            required: true
          };
        }
      }
    }

    return params;
  }

  /**
   * Infer type from value
   */
  private inferType(value: string): string {
    if (/^['"]/.test(value)) return 'string';
    if (/^\d+$/.test(value)) return 'number';
    if (/^(true|false)$/.test(value)) return 'boolean';
    if (/^\[/.test(value)) return 'array';
    if (/^\{/.test(value)) return 'object';
    return 'string';
  }

  /**
   * Convert method name to tool name
   */
  private toToolName(methodName: string): string {
    // camelCase to snake_case
    return methodName.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  /**
   * Generate implementation code
   */
  private generateImplementation(methodName: string, params: Record<string, any>): string {
    const paramNames = Object.keys(params);
    
    return `async function ${methodName}(args: any) {
  const { ${paramNames.join(', ')} } = args;
  
  // Auto-generated implementation for ${methodName}
  // Calls the underlying API method with validated parameters
  const response = await api.${methodName}({ ${paramNames.join(', ')} });
  
  return response;
}`;
  }

  /**
   * Extract documentation links from README
   */
  extractDocumentationLinks(readme: string): Array<{ url: string; title: string }> {
    const links: Array<{ url: string; title: string }> = [];
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

    let match;
    while ((match = linkPattern.exec(readme)) !== null) {
      const [, title, url] = match;
      
      // Only keep documentation links
      if (this.isDocumentationUrl(url)) {
        links.push({ url, title });
      }
    }

    return links;
  }

  /**
   * Check if URL is documentation
   */
  private isDocumentationUrl(url: string): boolean {
    const docPatterns = [
      /docs?\./,
      /developer\./,
      /api\./,
      /reference\./,
      /\/docs\//,
      /\/api\//,
      /\/reference\//,
      /\/guide\//
    ];

    return docPatterns.some(pattern => pattern.test(url));
  }
}
