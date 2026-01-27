/**
 * @fileoverview Langchain Exporter - Export MCP tools to Langchain format
 * @author nich (x.com/nichxbt | github.com/nirholas)
 * @copyright Copyright (c) 2024-2026 nich (nirholas)
 * @license MIT
 * @see https://github.com/nirholas/github-to-mcp
 */

import { ExtractedTool } from './types';

/** Exporter metadata - nich (x.com/nichxbt | github.com/nirholas) */
const _LANGCHAIN_META = { author: 'nich', v: 1, project: 'github-to-mcp' } as const;

// ============================================================================
// Types
// ============================================================================

export interface LangchainExportOptions {
  /** Name for the toolkit/tool collection */
  toolkitName?: string;
  /** Base URL for API calls */
  baseUrl?: string;
  /** Environment variable name for API key */
  apiKeyEnvVar?: string;
  /** Include JSDoc/docstrings */
  includeComments?: boolean;
  /** Add runtime validation */
  includeValidation?: boolean;
  /** Export format */
  format?: 'tools' | 'toolkit' | 'agent';
}

export interface LangchainExportResult {
  typescript: string;
  python: string;
  metadata: {
    toolCount: number;
    toolkitName: string;
    generatedAt: string;
  };
}

// ============================================================================
// Langchain Exporter Class
// ============================================================================

/**
 * Export MCP tools to Langchain format
 * 
 * Supports both TypeScript (@langchain/core) and Python (langchain) exports
 * with proper type safety, validation, and documentation.
 */
export class LangchainExporter {
  private options: Required<LangchainExportOptions>;

  constructor(options: LangchainExportOptions = {}) {
    this.options = {
      toolkitName: options.toolkitName ?? 'generatedTools',
      baseUrl: options.baseUrl ?? 'https://api.example.com',
      apiKeyEnvVar: options.apiKeyEnvVar ?? 'API_KEY',
      includeComments: options.includeComments ?? true,
      includeValidation: options.includeValidation ?? true,
      format: options.format ?? 'tools',
    };
  }

  /**
   * Export tools to both TypeScript and Python Langchain format
   */
  export(tools: ExtractedTool[]): LangchainExportResult {
    return {
      typescript: this.exportTypeScript(tools),
      python: this.exportPython(tools),
      metadata: {
        toolCount: tools.length,
        toolkitName: this.options.toolkitName,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Export as Langchain Tools for TypeScript
   */
  exportTypeScript(tools: ExtractedTool[]): string {
    const { toolkitName, baseUrl, apiKeyEnvVar, includeComments, includeValidation } = this.options;

    const imports = this.generateTypeScriptImports(includeValidation);
    const schemas = includeValidation ? this.generateZodSchemas(tools) : '';
    const toolDefinitions = tools.map(tool => this.generateTypeScriptTool(tool, includeValidation)).join('\n\n');

    const code = `${this.generateFileHeader('TypeScript')}

${imports}

${includeComments ? '// ============================================================================\n// Configuration\n// ============================================================================\n\n' : ''}const API_BASE_URL = process.env.BASE_URL || '${baseUrl}';
const API_KEY = process.env.${apiKeyEnvVar};

if (!API_KEY) {
  console.warn('Warning: ${apiKeyEnvVar} environment variable not set');
}

${includeComments ? '// ============================================================================\n// Helper Functions\n// ============================================================================\n\n' : ''}async function makeApiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch(\`\${API_BASE_URL}\${endpoint}\`, {
    method,
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json',
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    throw new Error(\`API request failed: \${response.status} \${response.statusText}\`);
  }

  return response.json();
}

${schemas ? `${includeComments ? '// ============================================================================\n// Zod Schemas for Validation\n// ============================================================================\n\n' : ''}${schemas}\n\n` : ''}${includeComments ? '// ============================================================================\n// Tool Definitions\n// ============================================================================\n\n' : ''}${toolDefinitions}

${includeComments ? '// ============================================================================\n// Export\n// ============================================================================\n\n' : ''}export const ${toolkitName} = [
${tools.map(t => `  ${this.toVariableName(t.name)}Tool,`).join('\n')}
];

${this.options.format === 'toolkit' ? this.generateTypeScriptToolkit(tools, toolkitName) : ''}
export default ${toolkitName};
`;

    return code;
  }

  /**
   * Export as Langchain Tools for Python
   */
  exportPython(tools: ExtractedTool[]): string {
    const { toolkitName, baseUrl, apiKeyEnvVar, includeComments, includeValidation } = this.options;

    const imports = this.generatePythonImports(includeValidation);
    const pydanticModels = includeValidation ? this.generatePydanticModels(tools) : '';
    const toolDefinitions = tools.map(tool => this.generatePythonTool(tool, includeValidation)).join('\n\n');

    const code = `${this.generateFileHeader('Python', '#')}

${imports}

${includeComments ? '# ============================================================================\n# Configuration\n# ============================================================================\n\n' : ''}API_BASE_URL = os.getenv("BASE_URL", "${baseUrl}")
API_KEY = os.getenv("${apiKeyEnvVar}")

if not API_KEY:
    logger.warning("${apiKeyEnvVar} environment variable not set")

${includeComments ? '# ============================================================================\n# HTTP Client\n# ============================================================================\n\n' : ''}async def make_api_request(
    endpoint: str,
    method: str = "GET",
    body: dict | None = None
) -> dict:
    """Make an authenticated API request."""
    async with httpx.AsyncClient() as client:
        response = await client.request(
            method=method,
            url=f"{API_BASE_URL}{endpoint}",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        response.raise_for_status()
        return response.json()

${pydanticModels ? `${includeComments ? '# ============================================================================\n# Pydantic Models for Validation\n# ============================================================================\n\n' : ''}${pydanticModels}\n\n` : ''}${includeComments ? '# ============================================================================\n# Tool Functions\n# ============================================================================\n\n' : ''}${toolDefinitions}

${includeComments ? '# ============================================================================\n# Tool Collection\n# ============================================================================\n\n' : ''}${toolkitName} = [
${tools.map(t => `    ${this.toSnakeCase(t.name)}_tool,`).join('\n')}
]

${this.options.format === 'toolkit' ? this.generatePythonToolkit(tools, toolkitName) : ''}
__all__ = ["${toolkitName}"${this.options.format === 'toolkit' ? `, "${this.toPascalCase(toolkitName)}Toolkit"` : ''}]
`;

    return code;
  }

  // ============================================================================
  // TypeScript Generation Helpers
  // ============================================================================

  private generateFileHeader(language: string, commentChar: string = '//'): string {
    const border = commentChar === '#' ? '#' : '//';
    return `${commentChar === '#' ? '"""' : '/**'}
${commentChar === '#' ? '' : ' *'} Generated Langchain Tools
${commentChar === '#' ? '' : ' *'} 
${commentChar === '#' ? '' : ' *'} Auto-generated from MCP tool definitions
${commentChar === '#' ? '' : ' *'} Language: ${language}
${commentChar === '#' ? '' : ' *'} 
${commentChar === '#' ? '' : ' *'} @author nich (x.com/nichxbt | github.com/nirholas)
${commentChar === '#' ? '' : ' *'} @see https://github.com/nirholas/github-to-mcp
${commentChar === '#' ? '"""' : ' */'}`;
  }

  private generateTypeScriptImports(includeValidation: boolean): string {
    const imports = [
      `import { DynamicStructuredTool } from '@langchain/core/tools';`,
    ];

    if (includeValidation) {
      imports.push(`import { z } from 'zod';`);
    }

    return imports.join('\n');
  }

  private generateZodSchemas(tools: ExtractedTool[]): string {
    return tools.map(tool => this.generateZodSchema(tool)).join('\n\n');
  }

  private generateZodSchema(tool: ExtractedTool): string {
    const schemaName = `${this.toPascalCase(tool.name)}Schema`;
    const properties = tool.inputSchema?.properties || {};
    const required = tool.inputSchema?.required || [];

    const fields = Object.entries(properties).map(([name, prop]: [string, any]) => {
      const zodType = this.jsonSchemaToZod(prop, required.includes(name));
      const description = prop.description ? `.describe('${this.escapeString(prop.description)}')` : '';
      return `  ${name}: ${zodType}${description},`;
    });

    return `export const ${schemaName} = z.object({
${fields.join('\n')}
});

export type ${this.toPascalCase(tool.name)}Input = z.infer<typeof ${schemaName}>;`;
  }

  private jsonSchemaToZod(prop: any, isRequired: boolean): string {
    let zodType: string;

    switch (prop.type) {
      case 'string':
        zodType = 'z.string()';
        if (prop.format === 'email') zodType = 'z.string().email()';
        if (prop.format === 'url' || prop.format === 'uri') zodType = 'z.string().url()';
        if (prop.format === 'uuid') zodType = 'z.string().uuid()';
        if (prop.minLength) zodType += `.min(${prop.minLength})`;
        if (prop.maxLength) zodType += `.max(${prop.maxLength})`;
        if (prop.pattern) zodType += `.regex(/${prop.pattern}/)`;
        if (prop.enum) zodType = `z.enum([${prop.enum.map((e: string) => `'${e}'`).join(', ')}])`;
        break;
      case 'number':
      case 'integer':
        zodType = prop.type === 'integer' ? 'z.number().int()' : 'z.number()';
        if (prop.minimum !== undefined) zodType += `.min(${prop.minimum})`;
        if (prop.maximum !== undefined) zodType += `.max(${prop.maximum})`;
        break;
      case 'boolean':
        zodType = 'z.boolean()';
        break;
      case 'array':
        const itemType = prop.items ? this.jsonSchemaToZod(prop.items, true) : 'z.unknown()';
        zodType = `z.array(${itemType})`;
        break;
      case 'object':
        if (prop.properties) {
          const nestedFields = Object.entries(prop.properties).map(([k, v]: [string, any]) => {
            const nestedRequired = (prop.required || []).includes(k);
            return `${k}: ${this.jsonSchemaToZod(v, nestedRequired)}`;
          }).join(', ');
          zodType = `z.object({ ${nestedFields} })`;
        } else {
          zodType = 'z.record(z.unknown())';
        }
        break;
      default:
        zodType = 'z.unknown()';
    }

    if (!isRequired) {
      zodType += '.optional()';
    }

    return zodType;
  }

  private generateTypeScriptTool(tool: ExtractedTool, includeValidation: boolean): string {
    const varName = this.toVariableName(tool.name);
    const schemaName = `${this.toPascalCase(tool.name)}Schema`;
    const description = this.escapeString(tool.description || `Execute ${tool.name}`);

    const properties = tool.inputSchema?.properties || {};
    const params = Object.keys(properties);
    const destructure = params.length > 0 ? `{ ${params.join(', ')} }` : '{}';

    // Generate inline schema if not using validation
    const schemaCode = includeValidation
      ? schemaName
      : this.generateInlineZodSchema(tool);

    // Generate implementation
    const endpoint = this.guessEndpoint(tool.name);
    const method = this.guessHttpMethod(tool.name);

    return `export const ${varName}Tool = new DynamicStructuredTool({
  name: '${tool.name}',
  description: \`${description}\`,
  schema: ${schemaCode},
  func: async (${destructure}) => {
    try {
      const result = await makeApiRequest(
        '${endpoint}',
        '${method}',
        ${params.length > 0 ? `{ ${params.join(', ')} }` : 'undefined'}
      );
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return \`Error: \${error instanceof Error ? error.message : String(error)}\`;
    }
  },
});`;
  }

  private generateInlineZodSchema(tool: ExtractedTool): string {
    const properties = tool.inputSchema?.properties || {};
    const required = tool.inputSchema?.required || [];

    const fields = Object.entries(properties).map(([name, prop]: [string, any]) => {
      const zodType = this.jsonSchemaToZod(prop, required.includes(name));
      const description = prop.description ? `.describe('${this.escapeString(prop.description)}')` : '';
      return `    ${name}: ${zodType}${description},`;
    });

    return `z.object({
${fields.join('\n')}
  })`;
  }

  private generateTypeScriptToolkit(tools: ExtractedTool[], name: string): string {
    const className = this.toPascalCase(name) + 'Toolkit';
    return `
/**
 * Toolkit class for grouping related tools
 */
export class ${className} {
  private tools: DynamicStructuredTool[];

  constructor() {
    this.tools = ${name};
  }

  getTools(): DynamicStructuredTool[] {
    return this.tools;
  }

  getTool(name: string): DynamicStructuredTool | undefined {
    return this.tools.find(t => t.name === name);
  }
}
`;
  }

  // ============================================================================
  // Python Generation Helpers
  // ============================================================================

  private generatePythonImports(includeValidation: boolean): string {
    const imports = [
      'import os',
      'import logging',
      'from typing import Any',
      '',
      'import httpx',
      'from langchain.tools import StructuredTool',
    ];

    if (includeValidation) {
      imports.push('from pydantic import BaseModel, Field');
    }

    imports.push('', 'logger = logging.getLogger(__name__)');

    return imports.join('\n');
  }

  private generatePydanticModels(tools: ExtractedTool[]): string {
    return tools.map(tool => this.generatePydanticModel(tool)).join('\n\n');
  }

  private generatePydanticModel(tool: ExtractedTool): string {
    const className = `${this.toPascalCase(tool.name)}Input`;
    const properties = tool.inputSchema?.properties || {};
    const required = tool.inputSchema?.required || [];

    const fields = Object.entries(properties).map(([name, prop]: [string, any]) => {
      const pythonType = this.jsonSchemaToPython(prop, required.includes(name));
      const fieldArgs: string[] = [];

      if (!required.includes(name)) {
        fieldArgs.push('default=None');
      }
      if (prop.description) {
        fieldArgs.push(`description="${this.escapeString(prop.description)}"`);
      }

      const fieldDef = fieldArgs.length > 0 ? `Field(${fieldArgs.join(', ')})` : '...';
      return `    ${this.toSnakeCase(name)}: ${pythonType} = ${fieldDef}`;
    });

    const docstring = tool.description ? `    """${tool.description}"""\n` : '';

    return `class ${className}(BaseModel):
${docstring}${fields.join('\n')}`;
  }

  private jsonSchemaToPython(prop: any, isRequired: boolean): string {
    let pythonType: string;

    switch (prop.type) {
      case 'string':
        pythonType = 'str';
        break;
      case 'number':
        pythonType = 'float';
        break;
      case 'integer':
        pythonType = 'int';
        break;
      case 'boolean':
        pythonType = 'bool';
        break;
      case 'array':
        const itemType = prop.items ? this.jsonSchemaToPython(prop.items, true) : 'Any';
        pythonType = `list[${itemType}]`;
        break;
      case 'object':
        pythonType = 'dict[str, Any]';
        break;
      default:
        pythonType = 'Any';
    }

    if (!isRequired) {
      pythonType = `${pythonType} | None`;
    }

    return pythonType;
  }

  private generatePythonTool(tool: ExtractedTool, includeValidation: boolean): string {
    const funcName = this.toSnakeCase(tool.name);
    const className = `${this.toPascalCase(tool.name)}Input`;
    const description = this.escapeString(tool.description || `Execute ${tool.name}`);

    const properties = tool.inputSchema?.properties || {};
    const required = tool.inputSchema?.required || [];
    
    // Generate function parameters
    const params = Object.entries(properties).map(([name, prop]: [string, any]) => {
      const pythonType = this.jsonSchemaToPython(prop, required.includes(name));
      const snakeName = this.toSnakeCase(name);
      const defaultVal = required.includes(name) ? '' : ' = None';
      return `    ${snakeName}: ${pythonType}${defaultVal}`;
    });

    const endpoint = this.guessEndpoint(tool.name);
    const method = this.guessHttpMethod(tool.name);
    const bodyParams = Object.keys(properties).map(p => `"${p}": ${this.toSnakeCase(p)}`).join(', ');

    const functionDef = `async def ${funcName}(
${params.join(',\n') || '    # No parameters'}
) -> str:
    """
    ${description}
    """
    try:
        result = await make_api_request(
            "${endpoint}",
            "${method}",
            {${bodyParams}} if ${Object.keys(properties).length > 0} else None
        )
        return str(result)
    except Exception as e:
        return f"Error: {e}"`;

    const toolDef = `${funcName}_tool = StructuredTool.from_function(
    coroutine=${funcName},
    name="${tool.name}",
    description="${description}",${includeValidation ? `\n    args_schema=${className},` : ''}
)`;

    return `${functionDef}\n\n${toolDef}`;
  }

  private generatePythonToolkit(tools: ExtractedTool[], name: string): string {
    const className = this.toPascalCase(name) + 'Toolkit';
    return `

class ${className}:
    """Toolkit class for grouping related tools."""

    def __init__(self):
        self.tools = ${name}

    def get_tools(self) -> list[StructuredTool]:
        """Get all tools in this toolkit."""
        return self.tools

    def get_tool(self, name: str) -> StructuredTool | None:
        """Get a specific tool by name."""
        return next((t for t in self.tools if t.name == name), None)
`;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private toVariableName(name: string): string {
    // Convert to camelCase variable name
    return name
      .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
      .replace(/^(.)/, char => char.toLowerCase());
  }

  private toPascalCase(name: string): string {
    return name
      .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
      .replace(/^(.)/, char => char.toUpperCase());
  }

  private toSnakeCase(name: string): string {
    return name
      .replace(/([A-Z])/g, '_$1')
      .replace(/[-\s]/g, '_')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/_+/g, '_');
  }

  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/`/g, '\\`');
  }

  private guessEndpoint(toolName: string): string {
    // Try to guess a RESTful endpoint from the tool name
    const parts = toolName.split(/[-_]/);
    const action = parts[0].toLowerCase();
    const resource = parts.slice(1).join('/').toLowerCase() || 'resource';

    switch (action) {
      case 'get':
      case 'list':
      case 'fetch':
        return `/${resource}`;
      case 'create':
      case 'add':
      case 'post':
        return `/${resource}`;
      case 'update':
      case 'edit':
      case 'patch':
        return `/${resource}/{id}`;
      case 'delete':
      case 'remove':
        return `/${resource}/{id}`;
      default:
        return `/${toolName.replace(/[-_]/g, '/')}`;
    }
  }

  private guessHttpMethod(toolName: string): string {
    const name = toolName.toLowerCase();
    if (name.startsWith('get') || name.startsWith('list') || name.startsWith('fetch') || name.startsWith('read')) {
      return 'GET';
    }
    if (name.startsWith('create') || name.startsWith('add') || name.startsWith('post')) {
      return 'POST';
    }
    if (name.startsWith('update') || name.startsWith('edit') || name.startsWith('patch')) {
      return 'PATCH';
    }
    if (name.startsWith('delete') || name.startsWith('remove')) {
      return 'DELETE';
    }
    return 'POST';
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new Langchain exporter with options
 */
export function createLangchainExporter(options?: LangchainExportOptions): LangchainExporter {
  return new LangchainExporter(options);
}

/**
 * Quick export tools to Langchain format
 */
export function exportToLangchain(
  tools: ExtractedTool[],
  options?: LangchainExportOptions
): LangchainExportResult {
  const exporter = new LangchainExporter(options);
  return exporter.export(tools);
}
