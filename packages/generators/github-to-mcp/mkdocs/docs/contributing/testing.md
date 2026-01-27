# Testing

Guide to writing and running tests for GitHub to MCP.

## Running Tests

### All Tests

```bash
pnpm test
```

### Watch Mode

```bash
pnpm test:watch
```

### Coverage Report

```bash
pnpm test:coverage
```

### Specific Package

```bash
pnpm --filter @nirholas/github-to-mcp test
pnpm --filter @github-to-mcp/openapi-parser test
```

## Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── core/
│   │   ├── generator.test.ts
│   │   ├── classifier.test.ts
│   │   └── extractors/
│   ├── openapi-parser/
│   └── mcp-server/
├── integration/             # Integration tests
│   ├── generation.test.ts
│   └── end-to-end.test.ts
└── fixtures/                # Test data
    ├── repos/
    ├── openapi/
    └── graphql/
```

## Writing Tests

### Unit Tests

Test individual functions in isolation:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { classifyRepository } from '@nirholas/github-to-mcp';

describe('classifyRepository', () => {
  it('should classify MCP server repos', () => {
    const repo = {
      packageJson: {
        dependencies: {
          '@modelcontextprotocol/sdk': '^1.0.0'
        }
      }
    };
    
    expect(classifyRepository(repo)).toBe('mcp-server');
  });
  
  it('should classify API SDK repos', () => {
    const repo = {
      files: ['openapi.json'],
      packageJson: {}
    };
    
    expect(classifyRepository(repo)).toBe('api-sdk');
  });
});
```

### Mocking

Use Vitest's mocking capabilities:

```typescript
import { vi } from 'vitest';
import { GithubClient } from '../src/github/client';

// Mock entire module
vi.mock('../src/github/client');

// Mock specific function
const mockFetch = vi.fn();
vi.spyOn(global, 'fetch').mockImplementation(mockFetch);

// Setup mock return value
mockFetch.mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: 'test' })
});
```

### Integration Tests

Test multiple components together:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateFromGithub } from '@nirholas/github-to-mcp';

describe('End-to-end generation', () => {
  it('should generate MCP server from public repo', async () => {
    const result = await generateFromGithub(
      'https://github.com/octocat/Hello-World',
      { token: process.env.GITHUB_TOKEN }
    );
    
    expect(result.tools).toHaveLength(4); // Universal tools
    expect(result.tools.map(t => t.name)).toContain('read_file');
    expect(result.tools.map(t => t.name)).toContain('list_files');
  });
  
  it('should extract OpenAPI tools', async () => {
    const result = await generateFromGithub(
      'https://github.com/stripe/stripe-node'
    );
    
    // Should have more than universal tools
    expect(result.tools.length).toBeGreaterThan(4);
    expect(result.tools.some(t => t.source === 'openapi')).toBe(true);
  });
});
```

### Fixture Tests

Test with predefined data:

```typescript
import { readFixture } from '../helpers';
import { parseOpenAPI } from '@github-to-mcp/openapi-parser';

describe('OpenAPI Parser', () => {
  it('should parse petstore spec', async () => {
    const spec = await readFixture('openapi/petstore.json');
    const tools = await parseOpenAPI(spec);
    
    expect(tools).toMatchSnapshot();
  });
  
  it('should parse GitHub API spec', async () => {
    const spec = await readFixture('openapi/github-api.yaml');
    const tools = await parseOpenAPI(spec);
    
    expect(tools.length).toBeGreaterThan(100);
  });
});
```

## Test Helpers

### fixtures/helpers.ts

```typescript
import fs from 'fs/promises';
import path from 'path';

export async function readFixture(name: string): Promise<string> {
  const fixturePath = path.join(__dirname, 'fixtures', name);
  return fs.readFile(fixturePath, 'utf-8');
}

export function createMockRepo(overrides = {}) {
  return {
    owner: 'test',
    name: 'repo',
    url: 'https://github.com/test/repo',
    readme: '# Test Repo',
    files: [],
    packageJson: {},
    ...overrides
  };
}

export function createMockTool(overrides = {}) {
  return {
    name: 'test_tool',
    description: 'A test tool',
    inputSchema: { type: 'object' },
    source: 'universal',
    ...overrides
  };
}
```

## Testing Patterns

### Testing Extractors

```typescript
describe('OpenAPI Extractor', () => {
  it('should extract operations with operationId', async () => {
    const repo = createMockRepo({
      files: ['openapi.json'],
      fileContents: {
        'openapi.json': JSON.stringify({
          openapi: '3.0.0',
          paths: {
            '/users': {
              get: {
                operationId: 'listUsers',
                summary: 'List all users'
              }
            }
          }
        })
      }
    });
    
    const extractor = new OpenAPIExtractor();
    const tools = await extractor.extract(repo);
    
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('listUsers');
  });
});
```

### Testing Generators

```typescript
describe('TypeScript Generator', () => {
  it('should generate valid TypeScript', async () => {
    const tools = [createMockTool({ name: 'read_file' })];
    const generator = new TypeScriptGenerator();
    
    const code = generator.generate(tools);
    
    // Check it's valid TypeScript by parsing
    expect(() => typescript.createSourceFile(
      'test.ts',
      code,
      typescript.ScriptTarget.Latest
    )).not.toThrow();
  });
});
```

### Testing Error Handling

```typescript
describe('Error handling', () => {
  it('should throw on invalid URL', async () => {
    await expect(
      generateFromGithub('not-a-url')
    ).rejects.toThrow('Invalid GitHub URL');
  });
  
  it('should throw on rate limit', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers({
        'X-RateLimit-Remaining': '0'
      })
    });
    
    await expect(
      generateFromGithub('https://github.com/test/repo')
    ).rejects.toThrow('Rate limit exceeded');
  });
});
```

## Snapshot Testing

For complex outputs, use snapshots:

```typescript
it('should generate expected server code', async () => {
  const result = await generateFromGithub(
    'https://github.com/test/simple-repo'
  );
  
  expect(result.toTypeScript()).toMatchSnapshot();
});
```

Update snapshots when behavior changes intentionally:

```bash
pnpm test -- -u
```

## Coverage Goals

| Package | Target |
|---------|--------|
| Core | 80%+ |
| OpenAPI Parser | 90%+ |
| MCP Server | 85%+ |

Check coverage:

```bash
pnpm test:coverage
```

---

## See Also

- [Development Setup](development.md) - Setup environment
- [Architecture](architecture.md) - Code structure
- [Contributing](index.md) - Contribution guidelines
