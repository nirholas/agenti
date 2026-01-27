# OpenAPI Parser

The `@github-to-mcp/openapi-parser` package extracts tools from OpenAPI/Swagger and GraphQL schemas.

## Installation

```bash
npm install @github-to-mcp/openapi-parser
```

## Functions

### parseOpenAPI

Parse an OpenAPI specification and extract tools.

```typescript
function parseOpenAPI(
  spec: string | object,
  options?: OpenAPIParserOptions
): Promise<Tool[]>
```

#### Example

```typescript
import { parseOpenAPI } from '@github-to-mcp/openapi-parser';

const spec = await fs.readFile('openapi.json', 'utf-8');
const tools = await parseOpenAPI(spec);

console.log(`Extracted ${tools.length} tools from OpenAPI spec`);
```

---

### parseGraphQL

Parse a GraphQL schema and extract tools.

```typescript
function parseGraphQL(
  schema: string,
  options?: GraphQLParserOptions
): Promise<Tool[]>
```

#### Example

```typescript
import { parseGraphQL } from '@github-to-mcp/openapi-parser';

const schema = await fs.readFile('schema.graphql', 'utf-8');
const tools = await parseGraphQL(schema, {
  includeQueries: true,
  includeMutations: true,
  includeSubscriptions: false,
});

console.log(`Extracted ${tools.length} tools from GraphQL schema`);
```

---

### findSpecs

Find OpenAPI and GraphQL specs in a file tree.

```typescript
function findSpecs(
  files: FileTree,
  options?: FindSpecsOptions
): SpecFiles
```

#### Example

```typescript
import { findSpecs } from '@github-to-mcp/openapi-parser';

const specs = findSpecs(fileTree, {
  maxDepth: 3,
  patterns: ['**/openapi.{json,yaml}', '**/swagger.{json,yaml}'],
});

console.log(`Found ${specs.openapi.length} OpenAPI specs`);
console.log(`Found ${specs.graphql.length} GraphQL schemas`);
```

---

## Types

### OpenAPIParserOptions

```typescript
interface OpenAPIParserOptions {
  /** Include all operations or filter */
  includeOperations?: string[];
  
  /** Exclude specific operations */
  excludeOperations?: string[];
  
  /** Include deprecated operations */
  includeDeprecated?: boolean;
  
  /** Custom operation ID generator */
  operationIdGenerator?: (operation: Operation) => string;
  
  /** Base URL for API calls */
  baseUrl?: string;
}
```

### GraphQLParserOptions

```typescript
interface GraphQLParserOptions {
  /** Include query operations */
  includeQueries?: boolean;
  
  /** Include mutation operations */
  includeMutations?: boolean;
  
  /** Include subscription operations */
  includeSubscriptions?: boolean;
  
  /** Include deprecated fields */
  includeDeprecated?: boolean;
}
```

### SpecFiles

```typescript
interface SpecFiles {
  /** Found OpenAPI specifications */
  openapi: Array<{
    path: string;
    version: '2.0' | '3.0' | '3.1';
    content: string;
  }>;
  
  /** Found GraphQL schemas */
  graphql: Array<{
    path: string;
    content: string;
  }>;
}
```

---

## OpenAPI Support

### Supported Versions

| Version | Support |
|---------|---------|
| OpenAPI 3.1 | ✅ Full |
| OpenAPI 3.0 | ✅ Full |
| Swagger 2.0 | ✅ Full |

### Supported Formats

| Format | Extensions |
|--------|------------|
| JSON | `.json` |
| YAML | `.yaml`, `.yml` |

### Extracted Information

For each operation, the parser extracts:

- Operation ID (or generates one)
- HTTP method and path
- Description and summary
- Request parameters (path, query, header)
- Request body schema
- Response schemas
- Security requirements

---

## GraphQL Support

### Supported Features

- Queries
- Mutations
- Subscriptions (optional)
- Input types
- Custom scalars
- Directives

### Schema Introspection

```typescript
import { introspectGraphQL } from '@github-to-mcp/openapi-parser';

const schema = await introspectGraphQL('https://api.example.com/graphql');
const tools = await parseGraphQL(schema);
```

---

## Advanced Usage

### Custom Tool Naming

```typescript
const tools = await parseOpenAPI(spec, {
  operationIdGenerator: (op) => {
    // Custom naming: method_path
    return `${op.method}_${op.path.replace(/\//g, '_')}`;
  },
});
```

### Filtering Operations

```typescript
// Only include specific operations
const tools = await parseOpenAPI(spec, {
  includeOperations: ['createUser', 'getUser', 'updateUser'],
});

// Exclude deprecated
const tools = await parseOpenAPI(spec, {
  includeDeprecated: false,
});
```

### Combining Multiple Specs

```typescript
import { parseOpenAPI, mergeTools } from '@github-to-mcp/openapi-parser';

const spec1Tools = await parseOpenAPI(spec1);
const spec2Tools = await parseOpenAPI(spec2);

const allTools = mergeTools([spec1Tools, spec2Tools], {
  deduplicateBy: 'name',
  conflictResolution: 'rename',
});
```

---

## See Also

- [Core API](core.md) - Main library
- [Tool Types](../concepts/tool-types.md) - Understanding extracted tools
- [How It Works](../concepts/how-it-works.md) - Extraction process
