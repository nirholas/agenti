/**
 * @fileoverview Generate OpenAPI spec tool for MCP server
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license Apache-2.0
 */

import { TextContent, Tool } from '@modelcontextprotocol/sdk/types.js';
import { generateOpenApiFromCodeWithDetails, FileContent, GeneratorOptions } from '@github-to-mcp/openapi-parser';

/**
 * Tool definition for generating OpenAPI spec from code
 */
export const generateOpenApiTool: Tool = {
  name: 'generate_openapi_spec',
  description: `Generate an OpenAPI 3.1 specification from source code files.

Analyzes source code to extract API routes and generates a complete OpenAPI specification.

Supported frameworks:
- Express.js (Node.js)
- FastAPI/Flask (Python)
- Next.js API routes (app/api and pages/api)

The tool detects the framework automatically and extracts:
- Routes and HTTP methods
- Path, query, and header parameters
- Request body schemas
- Response schemas
- Security schemes
- Tags for grouping

Returns the generated OpenAPI spec in both JSON and YAML formats.`,
  inputSchema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path (relative or absolute)',
            },
            content: {
              type: 'string',
              description: 'File content',
            },
            language: {
              type: 'string',
              enum: ['typescript', 'javascript', 'python'],
              description: 'Programming language (auto-detected if not provided)',
            },
          },
          required: ['path', 'content'],
        },
        description: 'Array of source code files to analyze',
      },
      options: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'API title for the spec',
          },
          description: {
            type: 'string',
            description: 'API description',
          },
          version: {
            type: 'string',
            description: 'API version (e.g., "1.0.0")',
          },
          baseUrl: {
            type: 'string',
            description: 'Base URL for the API',
          },
          includeExamples: {
            type: 'boolean',
            description: 'Whether to include examples in the spec',
          },
        },
        description: 'Generation options',
      },
      format: {
        type: 'string',
        enum: ['json', 'yaml', 'both'],
        default: 'json',
        description: 'Output format',
      },
    },
    required: ['files'],
  },
};

/**
 * Handler for generate_openapi_spec tool
 */
export async function handleGenerateOpenApi(args: {
  files: Array<{ path: string; content: string; language?: string }>;
  options?: GeneratorOptions;
  format?: 'json' | 'yaml' | 'both';
}): Promise<TextContent> {
  try {
    const files: FileContent[] = args.files.map(f => ({
      path: f.path,
      content: f.content,
      language: f.language as FileContent['language'],
    }));

    const result = await generateOpenApiFromCodeWithDetails(files, args.options || {});
    
    const format = args.format || 'json';
    let output: string;

    if (format === 'both') {
      output = `# Generated OpenAPI Specification

## Analysis Summary

- **Framework Detected:** ${result.analysis.framework}
- **Routes Found:** ${result.analysis.routes.length}
- **Schemas Extracted:** ${Object.keys(result.analysis.schemas).length}
- **Security Schemes:** ${Object.keys(result.analysis.securitySchemes).length}
- **Files Analyzed:** ${result.analysis.filesAnalyzed.length}

${result.analysis.warnings.length > 0 ? `### Warnings\n${result.analysis.warnings.map(w => `- ${w}`).join('\n')}\n` : ''}
${result.analysis.errors.length > 0 ? `### Errors\n${result.analysis.errors.map(e => `- ${e}`).join('\n')}\n` : ''}

## Routes

${result.analysis.routes.map(r => `- \`${r.method.toUpperCase()} ${r.openApiPath}\` - ${r.summary || r.operationId}`).join('\n')}

## JSON Format

\`\`\`json
${result.json}
\`\`\`

## YAML Format

\`\`\`yaml
${result.yaml}
\`\`\`
`;
    } else if (format === 'yaml') {
      output = result.yaml;
    } else {
      output = result.json;
    }

    return {
      type: 'text',
      text: output,
    };
  } catch (error) {
    return {
      type: 'text',
      text: `Error generating OpenAPI spec: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
