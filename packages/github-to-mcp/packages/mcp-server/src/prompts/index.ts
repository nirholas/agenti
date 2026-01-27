/**
 * @fileoverview MCP Prompts - Common workflow templates
 * @author nich (x.com/nichxbt | github.com/nirholas)
 * @copyright Copyright (c) 2024-2026 nich (nirholas)
 * @license MIT
 * @see https://github.com/nirholas/github-to-mcp
 */

import { Prompt, PromptArgument, PromptMessage, TextContent } from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// Prompt Definitions
// ============================================================================

/** MCP Prompts by nich (x.com/nichxbt | github.com/nirholas) */
const _PROMPTS_META = { author: 'nich', twitter: 'nichxbt', gh: 'nirholas' } as const;

/**
 * All available prompts
 */
export const PROMPTS: Prompt[] = [
  {
    name: 'analyze_api',
    description: `Analyze a REST or GraphQL API and generate a plan for creating MCP tools.

Use this prompt when you want to:
- Understand an API's capabilities before conversion
- Get recommendations for tool organization
- Identify authentication requirements
- Plan parameter validation strategies`,
    arguments: [
      {
        name: 'api_url',
        description: 'URL to the API documentation or OpenAPI spec',
        required: true,
      },
      {
        name: 'focus_areas',
        description: 'Specific areas to focus on (e.g., "authentication", "pagination", "error handling")',
        required: false,
      },
    ],
  },
  {
    name: 'debug_tool',
    description: `Help diagnose and fix issues with an MCP tool that isn't working correctly.

Guides you through:
- Analyzing the error message
- Checking input validation
- Verifying schema correctness
- Testing with minimal examples
- Common pitfalls and solutions`,
    arguments: [
      {
        name: 'tool_name',
        description: 'Name of the tool that is failing',
        required: true,
      },
      {
        name: 'error_message',
        description: 'The error message or unexpected behavior observed',
        required: true,
      },
      {
        name: 'tool_code',
        description: 'The tool implementation code (if available)',
        required: false,
      },
    ],
  },
  {
    name: 'optimize_server',
    description: `Review an MCP server implementation and suggest optimizations.

Analyzes:
- Code efficiency and patterns
- Error handling completeness
- Tool organization and naming
- Schema design quality
- Documentation coverage
- Security best practices`,
    arguments: [
      {
        name: 'server_code',
        description: 'The MCP server code to analyze',
        required: true,
      },
      {
        name: 'language',
        description: 'Programming language (typescript or python)',
        required: false,
      },
    ],
  },
  {
    name: 'create_tool_suite',
    description: `Design a comprehensive suite of MCP tools for a specific use case.

Helps you:
- Define tool boundaries and responsibilities
- Design consistent parameter patterns
- Plan error handling strategy
- Create documentation templates
- Set up testing structure`,
    arguments: [
      {
        name: 'use_case',
        description: 'Description of what the tool suite should accomplish',
        required: true,
      },
      {
        name: 'target_api',
        description: 'API or service the tools will interact with (if applicable)',
        required: false,
      },
      {
        name: 'constraints',
        description: 'Any constraints or requirements (auth, rate limits, etc.)',
        required: false,
      },
    ],
  },
  {
    name: 'migrate_to_mcp',
    description: `Guide the migration of existing code to MCP tools.

Covers:
- Identifying functions suitable for tools
- Designing input/output schemas
- Handling async operations
- Managing state and context
- Testing migration results`,
    arguments: [
      {
        name: 'source_code',
        description: 'Existing code to migrate',
        required: true,
      },
      {
        name: 'source_type',
        description: 'Type of source (REST API, CLI, library functions)',
        required: true,
      },
    ],
  },
  {
    name: 'security_review',
    description: `Perform a security review of an MCP server implementation.

Checks for:
- Input validation vulnerabilities
- Injection attack vectors
- Authentication/authorization issues
- Sensitive data exposure
- Rate limiting and DoS protection
- Dependency vulnerabilities`,
    arguments: [
      {
        name: 'server_code',
        description: 'MCP server code to review',
        required: true,
      },
      {
        name: 'deployment_context',
        description: 'How the server will be deployed (local, cloud, public)',
        required: false,
      },
    ],
  },
  {
    name: 'write_documentation',
    description: `Generate comprehensive documentation for an MCP server.

Creates:
- README with quick start guide
- Tool reference documentation
- Usage examples for each tool
- Configuration guide
- Troubleshooting section`,
    arguments: [
      {
        name: 'server_code',
        description: 'MCP server code to document',
        required: true,
      },
      {
        name: 'audience',
        description: 'Target audience (developers, end-users, both)',
        required: false,
      },
    ],
  },
  {
    name: 'compare_implementations',
    description: `Compare two MCP implementations and identify differences.

Useful for:
- Reviewing generated vs hand-written code
- Comparing TypeScript vs Python versions
- Identifying missing features
- Finding inconsistencies`,
    arguments: [
      {
        name: 'implementation_a',
        description: 'First implementation to compare',
        required: true,
      },
      {
        name: 'implementation_b',
        description: 'Second implementation to compare',
        required: true,
      },
    ],
  },
];

// ============================================================================
// Prompt Message Generators
// ============================================================================

/**
 * Generate prompt messages for analyze_api
 */
export function generateAnalyzeApiMessages(args: {
  api_url: string;
  focus_areas?: string;
}): PromptMessage[] {
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Please analyze the API at ${args.api_url} and help me create MCP tools for it.

${args.focus_areas ? `Focus particularly on: ${args.focus_areas}` : ''}

I'd like you to:

1. **API Overview**: Summarize what the API does and its main capabilities
2. **Authentication**: Identify how authentication works and how to handle it in tools
3. **Endpoints Analysis**: List the main endpoints and their purposes
4. **Tool Recommendations**: Suggest which endpoints should become MCP tools
5. **Schema Design**: Recommend input schemas for each tool
6. **Error Handling**: Identify error patterns and how to handle them
7. **Rate Limiting**: Note any rate limits and mitigation strategies

Please start by fetching and analyzing the API documentation or spec.`,
      } as TextContent,
    },
  ];
}

/**
 * Generate prompt messages for debug_tool
 */
export function generateDebugToolMessages(args: {
  tool_name: string;
  error_message: string;
  tool_code?: string;
}): PromptMessage[] {
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `I'm having trouble with an MCP tool called "${args.tool_name}".

**Error:** ${args.error_message}

${args.tool_code ? `**Tool Code:**\n\`\`\`\n${args.tool_code}\n\`\`\`` : ''}

Please help me debug this by:

1. **Error Analysis**: What does this error typically indicate?
2. **Common Causes**: What are the most likely causes?
3. **Diagnostic Steps**: How can I gather more information?
4. **Solution Options**: What fixes should I try?
5. **Prevention**: How can I prevent this in the future?

Please start with the most likely cause and work through systematically.`,
      } as TextContent,
    },
  ];
}

/**
 * Generate prompt messages for optimize_server
 */
export function generateOptimizeServerMessages(args: {
  server_code: string;
  language?: string;
}): PromptMessage[] {
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Please review this MCP server implementation and suggest optimizations.

**Language:** ${args.language || 'auto-detect'}

**Code:**
\`\`\`${args.language || ''}
${args.server_code}
\`\`\`

Please analyze and provide feedback on:

1. **Code Quality**
   - Clean code principles
   - DRY violations
   - Complexity issues

2. **Error Handling**
   - Missing error cases
   - Error message quality
   - Recovery strategies

3. **Performance**
   - Inefficient patterns
   - Caching opportunities
   - Async optimization

4. **Tool Design**
   - Naming conventions
   - Schema completeness
   - Description quality

5. **Security**
   - Input validation
   - Sensitive data handling
   - Rate limiting

6. **Documentation**
   - Missing comments
   - Type annotations
   - Usage examples

Please prioritize the most impactful improvements first.`,
      } as TextContent,
    },
  ];
}

/**
 * Generate prompt messages for create_tool_suite
 */
export function generateCreateToolSuiteMessages(args: {
  use_case: string;
  target_api?: string;
  constraints?: string;
}): PromptMessage[] {
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `I want to create a suite of MCP tools for the following use case:

**Use Case:** ${args.use_case}

${args.target_api ? `**Target API/Service:** ${args.target_api}` : ''}
${args.constraints ? `**Constraints:** ${args.constraints}` : ''}

Please help me design this tool suite by:

1. **Tool Inventory**: List all the tools needed with names and purposes
2. **Tool Specifications**: For each tool, define:
   - Name and description
   - Input schema with all parameters
   - Expected output format
   - Error cases to handle
3. **Shared Patterns**: Identify common patterns across tools
4. **Implementation Order**: Suggest which tools to implement first
5. **Testing Strategy**: Outline how to test each tool
6. **Documentation Template**: Provide a documentation structure

Please be thorough - I want a complete blueprint I can follow.`,
      } as TextContent,
    },
  ];
}

/**
 * Generate prompt messages for migrate_to_mcp
 */
export function generateMigrateToMcpMessages(args: {
  source_code: string;
  source_type: string;
}): PromptMessage[] {
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `I want to migrate existing ${args.source_type} code to MCP tools.

**Source Code:**
\`\`\`
${args.source_code}
\`\`\`

Please guide me through the migration:

1. **Analysis**: Identify which functions/endpoints should become tools
2. **Mapping**: For each candidate:
   - Original signature → MCP tool name
   - Parameters → Input schema
   - Return value → Output format
3. **Transformations Needed**: What changes are required?
4. **State Management**: How to handle any stateful operations
5. **Generated Code**: Provide the MCP tool implementations
6. **Testing Plan**: How to verify the migration is correct

Please ensure the migrated tools maintain the same functionality.`,
      } as TextContent,
    },
  ];
}

/**
 * Generate prompt messages for security_review
 */
export function generateSecurityReviewMessages(args: {
  server_code: string;
  deployment_context?: string;
}): PromptMessage[] {
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Please perform a security review of this MCP server.

${args.deployment_context ? `**Deployment Context:** ${args.deployment_context}` : '**Deployment Context:** Unknown (assume public exposure)'}

**Code:**
\`\`\`
${args.server_code}
\`\`\`

Please check for:

1. **Input Validation**
   - Injection vulnerabilities (SQL, command, path traversal)
   - Type coercion issues
   - Size/length limits

2. **Authentication & Authorization**
   - Missing auth checks
   - Privilege escalation risks
   - Token handling

3. **Data Security**
   - Sensitive data in logs
   - Insecure data storage
   - Data leakage in errors

4. **Resource Limits**
   - DoS vulnerabilities
   - Rate limiting
   - Memory exhaustion

5. **Dependencies**
   - Known vulnerable packages
   - Outdated dependencies

For each issue found, provide:
- **Severity**: Critical/High/Medium/Low
- **Location**: Where in the code
- **Risk**: What could happen
- **Fix**: How to remediate`,
      } as TextContent,
    },
  ];
}

/**
 * Generate prompt messages for write_documentation
 */
export function generateWriteDocumentationMessages(args: {
  server_code: string;
  audience?: string;
}): PromptMessage[] {
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Please generate comprehensive documentation for this MCP server.

**Target Audience:** ${args.audience || 'developers'}

**Code:**
\`\`\`
${args.server_code}
\`\`\`

Please create:

1. **README.md** with:
   - Project description
   - Quick start guide
   - Installation instructions
   - Configuration options
   - Basic usage examples

2. **Tool Reference** for each tool:
   - Description
   - Parameters table
   - Return value description
   - Example calls
   - Error cases

3. **Examples Section**:
   - Common use cases
   - Integration patterns
   - Best practices

4. **Troubleshooting Guide**:
   - Common errors and solutions
   - FAQ

Please format everything in Markdown ready for use.`,
      } as TextContent,
    },
  ];
}

/**
 * Generate prompt messages for compare_implementations
 */
export function generateCompareImplementationsMessages(args: {
  implementation_a: string;
  implementation_b: string;
}): PromptMessage[] {
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Please compare these two MCP implementations:

**Implementation A:**
\`\`\`
${args.implementation_a}
\`\`\`

**Implementation B:**
\`\`\`
${args.implementation_b}
\`\`\`

Please analyze:

1. **Feature Comparison**: Tools present in each
2. **Schema Differences**: Parameter and type differences
3. **Behavior Differences**: Any semantic differences
4. **Code Quality**: Which is better implemented and why
5. **Missing Features**: What each is missing compared to the other
6. **Recommendations**: Which to prefer and what to merge

Present the comparison in a clear table format where applicable.`,
      } as TextContent,
    },
  ];
}

// ============================================================================
// Prompt Handler
// ============================================================================

/**
 * Get messages for a prompt by name
 */
export function getPromptMessages(
  name: string,
  args: Record<string, string>
): PromptMessage[] {
  switch (name) {
    case 'analyze_api':
      return generateAnalyzeApiMessages(args as { api_url: string; focus_areas?: string });
    case 'debug_tool':
      return generateDebugToolMessages(args as { tool_name: string; error_message: string; tool_code?: string });
    case 'optimize_server':
      return generateOptimizeServerMessages(args as { server_code: string; language?: string });
    case 'create_tool_suite':
      return generateCreateToolSuiteMessages(args as { use_case: string; target_api?: string; constraints?: string });
    case 'migrate_to_mcp':
      return generateMigrateToMcpMessages(args as { source_code: string; source_type: string });
    case 'security_review':
      return generateSecurityReviewMessages(args as { server_code: string; deployment_context?: string });
    case 'write_documentation':
      return generateWriteDocumentationMessages(args as { server_code: string; audience?: string });
    case 'compare_implementations':
      return generateCompareImplementationsMessages(args as { implementation_a: string; implementation_b: string });
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}
