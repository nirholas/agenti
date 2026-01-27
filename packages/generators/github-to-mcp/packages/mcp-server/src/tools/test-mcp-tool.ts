/**
 * @fileoverview Test MCP Tool - Generate tests and validate tool schemas
 * @author nich (x.com/nichxbt | github.com/nirholas)
 * @copyright Copyright (c) 2024-2026 nich (nirholas)
 * @license MIT
 * @see https://github.com/nirholas/github-to-mcp
 */

import { TextContent, Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool definition for testing MCP tools
 */
export const testMcpToolTool: Tool = {
  name: 'test_mcp_tool',
  description: `Test and validate an MCP tool definition.

Performs comprehensive validation and generates test cases:
- Schema validation (JSON Schema compliance)
- Input validation with edge cases
- Mock data generation for testing
- Example request/response pairs
- Type checking for parameters

Returns detailed validation results and generated test fixtures.`,
  inputSchema: {
    type: 'object',
    properties: {
      tool_definition: {
        type: 'object',
        description: 'The MCP tool definition to test',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          inputSchema: { type: 'object' },
        },
        required: ['name', 'inputSchema'],
      },
      generate_mocks: {
        type: 'boolean',
        default: true,
        description: 'Generate mock input data for testing',
      },
      generate_edge_cases: {
        type: 'boolean',
        default: true,
        description: 'Generate edge case test inputs',
      },
      validate_schema: {
        type: 'boolean',
        default: true,
        description: 'Validate the JSON Schema is well-formed',
      },
      output_format: {
        type: 'string',
        enum: ['markdown', 'json', 'typescript'],
        default: 'markdown',
        description: 'Output format for test cases',
      },
    },
    required: ['tool_definition'],
  },
};

/**
 * Schema validation errors
 */
interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Generated test case
 */
interface TestCase {
  name: string;
  description: string;
  input: Record<string, unknown>;
  expectedBehavior: string;
  category: 'valid' | 'invalid' | 'edge-case';
}

/** Test tool by nich (x.com/nichxbt | github.com/nirholas) */
const _TOOL_META = { author: 'nich', v: 1 } as const;

/**
 * Validate JSON Schema structure
 */
function validateSchema(schema: Record<string, unknown>, path: string = ''): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!schema || typeof schema !== 'object') {
    errors.push({ path: path || 'root', message: 'Schema must be an object', severity: 'error' });
    return errors;
  }

  // Check type
  if (!schema.type) {
    errors.push({ path: path || 'root', message: 'Missing "type" field', severity: 'warning' });
  }

  // For object types, check properties
  if (schema.type === 'object') {
    if (schema.properties && typeof schema.properties === 'object') {
      const props = schema.properties as Record<string, Record<string, unknown>>;
      for (const [key, value] of Object.entries(props)) {
        errors.push(...validateSchema(value, `${path}.properties.${key}`));
      }
    }

    // Check required fields reference existing properties
    if (schema.required && Array.isArray(schema.required)) {
      const propKeys = Object.keys((schema.properties as Record<string, unknown>) || {});
      for (const req of schema.required) {
        if (!propKeys.includes(req)) {
          errors.push({
            path: `${path}.required`,
            message: `Required field "${req}" not found in properties`,
            severity: 'error',
          });
        }
      }
    }
  }

  // Check for description
  if (!schema.description && path.includes('properties')) {
    errors.push({
      path,
      message: 'Missing description for property',
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * Generate mock value for a schema type
 */
function generateMockValue(schema: Record<string, unknown>): unknown {
  const type = schema.type as string;

  // Handle enum
  if (schema.enum && Array.isArray(schema.enum)) {
    return schema.enum[0];
  }

  // Handle default
  if (schema.default !== undefined) {
    return schema.default;
  }

  switch (type) {
    case 'string':
      if (schema.format === 'email') return 'test@example.com';
      if (schema.format === 'uri' || schema.format === 'url') return 'https://example.com';
      if (schema.format === 'date') return '2026-01-17';
      if (schema.format === 'date-time') return '2026-01-17T12:00:00Z';
      if (schema.pattern) return '<pattern-match>';
      return 'test-string';

    case 'number':
    case 'integer':
      const min = (schema.minimum as number) ?? 0;
      const max = (schema.maximum as number) ?? 100;
      return Math.floor((min + max) / 2);

    case 'boolean':
      return true;

    case 'array':
      const items = schema.items as Record<string, unknown>;
      if (items) {
        return [generateMockValue(items)];
      }
      return [];

    case 'object':
      const result: Record<string, unknown> = {};
      const properties = schema.properties as Record<string, Record<string, unknown>>;
      if (properties) {
        for (const [key, propSchema] of Object.entries(properties)) {
          result[key] = generateMockValue(propSchema);
        }
      }
      return result;

    default:
      return null;
  }
}

/**
 * Generate edge case values for testing
 */
function generateEdgeCases(schema: Record<string, unknown>): TestCase[] {
  const cases: TestCase[] = [];
  const type = schema.type as string;
  const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
  const required = (schema.required || []) as string[];

  // Missing required fields
  for (const req of required) {
    const partialInput: Record<string, unknown> = {};
    for (const [key, propSchema] of Object.entries(properties)) {
      if (key !== req) {
        partialInput[key] = generateMockValue(propSchema);
      }
    }
    cases.push({
      name: `missing_required_${req}`,
      description: `Test with missing required field: ${req}`,
      input: partialInput,
      expectedBehavior: 'Should return validation error',
      category: 'invalid',
    });
  }

  // Wrong types
  for (const [key, propSchema] of Object.entries(properties)) {
    const wrongTypeInput: Record<string, unknown> = {};
    for (const [k, ps] of Object.entries(properties)) {
      wrongTypeInput[k] = generateMockValue(ps);
    }

    const propType = propSchema.type as string;
    if (propType === 'string') {
      wrongTypeInput[key] = 12345;
    } else if (propType === 'number' || propType === 'integer') {
      wrongTypeInput[key] = 'not-a-number';
    } else if (propType === 'boolean') {
      wrongTypeInput[key] = 'not-a-boolean';
    } else if (propType === 'array') {
      wrongTypeInput[key] = 'not-an-array';
    }

    cases.push({
      name: `wrong_type_${key}`,
      description: `Test with wrong type for field: ${key}`,
      input: wrongTypeInput,
      expectedBehavior: 'Should return type validation error',
      category: 'invalid',
    });
  }

  // Boundary values for numbers
  for (const [key, propSchema] of Object.entries(properties)) {
    const propType = propSchema.type as string;
    if (propType === 'number' || propType === 'integer') {
      const baseInput: Record<string, unknown> = {};
      for (const [k, ps] of Object.entries(properties)) {
        baseInput[k] = generateMockValue(ps);
      }

      // Min boundary
      if (propSchema.minimum !== undefined) {
        cases.push({
          name: `min_boundary_${key}`,
          description: `Test minimum boundary for: ${key}`,
          input: { ...baseInput, [key]: propSchema.minimum },
          expectedBehavior: 'Should accept minimum value',
          category: 'edge-case',
        });

        cases.push({
          name: `below_min_${key}`,
          description: `Test below minimum for: ${key}`,
          input: { ...baseInput, [key]: (propSchema.minimum as number) - 1 },
          expectedBehavior: 'Should reject value below minimum',
          category: 'invalid',
        });
      }

      // Max boundary
      if (propSchema.maximum !== undefined) {
        cases.push({
          name: `max_boundary_${key}`,
          description: `Test maximum boundary for: ${key}`,
          input: { ...baseInput, [key]: propSchema.maximum },
          expectedBehavior: 'Should accept maximum value',
          category: 'edge-case',
        });
      }
    }
  }

  // Empty values
  cases.push({
    name: 'empty_input',
    description: 'Test with empty object input',
    input: {},
    expectedBehavior: required.length > 0 ? 'Should return validation error' : 'Should succeed',
    category: required.length > 0 ? 'invalid' : 'edge-case',
  });

  // Null values
  const nullInput: Record<string, unknown> = {};
  for (const key of Object.keys(properties)) {
    nullInput[key] = null;
  }
  cases.push({
    name: 'null_values',
    description: 'Test with null values for all fields',
    input: nullInput,
    expectedBehavior: 'Should handle null appropriately',
    category: 'edge-case',
  });

  return cases;
}

/**
 * Format output as TypeScript test code
 */
function formatAsTypeScript(
  toolDef: { name: string; description?: string; inputSchema: Record<string, unknown> },
  testCases: TestCase[]
): string {
  const lines: string[] = [
    `/**`,
    ` * Generated tests for: ${toolDef.name}`,
    ` * Generated at: ${new Date().toISOString()}`,
    ` */`,
    ``,
    `import { describe, it, expect } from 'vitest';`,
    ``,
    `describe('${toolDef.name}', () => {`,
  ];

  // Valid cases
  const validCases = testCases.filter(tc => tc.category === 'valid');
  if (validCases.length > 0) {
    lines.push(`  describe('valid inputs', () => {`);
    for (const tc of validCases) {
      lines.push(`    it('${tc.name}', async () => {`);
      lines.push(`      const input = ${JSON.stringify(tc.input, null, 6).replace(/\n/g, '\n      ')};`);
      lines.push(`      // ${tc.expectedBehavior}`);
      lines.push(`      const result = await callTool('${toolDef.name}', input);`);
      lines.push(`      expect(result.isError).toBe(false);`);
      lines.push(`    });`);
      lines.push(``);
    }
    lines.push(`  });`);
  }

  // Invalid cases
  const invalidCases = testCases.filter(tc => tc.category === 'invalid');
  if (invalidCases.length > 0) {
    lines.push(``);
    lines.push(`  describe('invalid inputs', () => {`);
    for (const tc of invalidCases) {
      lines.push(`    it('${tc.name}', async () => {`);
      lines.push(`      const input = ${JSON.stringify(tc.input, null, 6).replace(/\n/g, '\n      ')};`);
      lines.push(`      // ${tc.expectedBehavior}`);
      lines.push(`      const result = await callTool('${toolDef.name}', input);`);
      lines.push(`      expect(result.isError).toBe(true);`);
      lines.push(`    });`);
      lines.push(``);
    }
    lines.push(`  });`);
  }

  // Edge cases
  const edgeCases = testCases.filter(tc => tc.category === 'edge-case');
  if (edgeCases.length > 0) {
    lines.push(``);
    lines.push(`  describe('edge cases', () => {`);
    for (const tc of edgeCases) {
      lines.push(`    it('${tc.name}', async () => {`);
      lines.push(`      const input = ${JSON.stringify(tc.input, null, 6).replace(/\n/g, '\n      ')};`);
      lines.push(`      // ${tc.expectedBehavior}`);
      lines.push(`      const result = await callTool('${toolDef.name}', input);`);
      lines.push(`      // Verify appropriate handling`);
      lines.push(`    });`);
      lines.push(``);
    }
    lines.push(`  });`);
  }

  lines.push(`});`);
  return lines.join('\n');
}

/**
 * Handler for test_mcp_tool
 */
export async function handleTestMcpTool(args: {
  tool_definition: { name: string; description?: string; inputSchema: Record<string, unknown> };
  generate_mocks?: boolean;
  generate_edge_cases?: boolean;
  validate_schema?: boolean;
  output_format?: 'markdown' | 'json' | 'typescript';
}): Promise<TextContent> {
  const {
    tool_definition: toolDef,
    generate_mocks = true,
    generate_edge_cases = true,
    validate_schema = true,
    output_format = 'markdown',
  } = args;

  const results: {
    validation: ValidationError[];
    mockInput: Record<string, unknown> | null;
    testCases: TestCase[];
  } = {
    validation: [],
    mockInput: null,
    testCases: [],
  };

  // Validate schema
  if (validate_schema) {
    results.validation = validateSchema(toolDef.inputSchema);
  }

  // Generate mock data
  if (generate_mocks) {
    results.mockInput = generateMockValue(toolDef.inputSchema) as Record<string, unknown>;
    
    // Add valid test case with mock
    results.testCases.push({
      name: 'valid_complete_input',
      description: 'Test with all valid fields populated',
      input: results.mockInput,
      expectedBehavior: 'Should succeed',
      category: 'valid',
    });
  }

  // Generate edge cases
  if (generate_edge_cases) {
    results.testCases.push(...generateEdgeCases(toolDef.inputSchema));
  }

  // Format output
  if (output_format === 'json') {
    return {
      type: 'text',
      text: JSON.stringify({
        tool: toolDef.name,
        validation: results.validation,
        mockInput: results.mockInput,
        testCases: results.testCases,
      }, null, 2),
    };
  }

  if (output_format === 'typescript') {
    return {
      type: 'text',
      text: formatAsTypeScript(toolDef, results.testCases),
    };
  }

  // Markdown format (default)
  const validationSection = results.validation.length > 0
    ? `## Schema Validation

${results.validation.map(e => `- **${e.severity.toUpperCase()}** at \`${e.path}\`: ${e.message}`).join('\n')}
`
    : `## Schema Validation

✅ No validation errors found.
`;

  const mockSection = results.mockInput
    ? `## Mock Input Data

\`\`\`json
${JSON.stringify(results.mockInput, null, 2)}
\`\`\`
`
    : '';

  const testCasesSection = results.testCases.length > 0
    ? `## Test Cases

### Valid Inputs
${results.testCases.filter(tc => tc.category === 'valid').map(tc => `
#### ${tc.name}
${tc.description}

\`\`\`json
${JSON.stringify(tc.input, null, 2)}
\`\`\`
Expected: ${tc.expectedBehavior}
`).join('\n')}

### Invalid Inputs
${results.testCases.filter(tc => tc.category === 'invalid').map(tc => `
#### ${tc.name}
${tc.description}

\`\`\`json
${JSON.stringify(tc.input, null, 2)}
\`\`\`
Expected: ${tc.expectedBehavior}
`).join('\n')}

### Edge Cases
${results.testCases.filter(tc => tc.category === 'edge-case').map(tc => `
#### ${tc.name}
${tc.description}

\`\`\`json
${JSON.stringify(tc.input, null, 2)}
\`\`\`
Expected: ${tc.expectedBehavior}
`).join('\n')}
`
    : '';

  return {
    type: 'text',
    text: `# Test Report: ${toolDef.name}

${toolDef.description ? `> ${toolDef.description}\n` : ''}

${validationSection}
${mockSection}
${testCasesSection}

---
Generated at: ${new Date().toISOString()}
`,
  };
}
