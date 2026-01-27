# Architecture

Technical architecture of GitHub to MCP.

## Overview

GitHub to MCP follows a monorepo architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Applications                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Web App   │  │    Docs     │  │   VS Code   │             │
│  │  (Next.js)  │  │  (Nextra)   │  │ (Extension) │             │
│  └──────┬──────┘  └─────────────┘  └──────┬──────┘             │
│         │                                  │                     │
│         └─────────────────┬────────────────┘                     │
│                           ↓                                      │
├─────────────────────────────────────────────────────────────────┤
│                         Packages                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     @nirholas/github-to-mcp              │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐  │    │
│  │  │   Generator   │  │  Extractors   │  │   GitHub    │  │    │
│  │  │               │  │               │  │   Client    │  │    │
│  │  └───────┬───────┘  └───────┬───────┘  └──────┬──────┘  │    │
│  └──────────┼──────────────────┼─────────────────┼─────────┘    │
│             │                  │                 │               │
│  ┌──────────┴──────────┐ ┌────┴────────────────┴─────────┐     │
│  │  @github-to-mcp/    │ │   @github-to-mcp/mcp-server   │     │
│  │  openapi-parser     │ │                               │     │
│  └─────────────────────┘ └───────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Package Responsibilities

### @nirholas/github-to-mcp (core)

The main library that orchestrates the conversion process.

**Responsibilities:**
- Public API (`generateFromGithub`, `parseRepository`)
- Repository classification
- Tool extraction coordination
- Code generation
- Output bundling

**Key Components:**

```typescript
// Generator - Main orchestrator
class GithubToMcpGenerator {
  async generate(url: string, options: Options): Promise<Result>
}

// GitHub Client - API interaction
class GithubClient {
  async getRepository(url: string): Promise<RepoInfo>
  async getFileTree(url: string): Promise<FileTree>
  async getFile(url: string, path: string): Promise<string>
}

// Classifier - Repository type detection
function classifyRepository(info: RepoInfo): RepositoryType

// Extractors - Tool extraction
interface Extractor {
  extract(info: RepoInfo): Promise<Tool[]>
}
```

### @github-to-mcp/openapi-parser

Parses API specifications into tool definitions.

**Responsibilities:**
- OpenAPI 2.0/3.0/3.1 parsing
- GraphQL schema parsing
- JSON Schema generation
- Spec file detection

**Key Components:**

```typescript
// OpenAPI Parser
function parseOpenAPI(spec: string | object): Promise<Tool[]>

// GraphQL Parser
function parseGraphQL(schema: string): Promise<Tool[]>

// Spec Finder
function findSpecs(files: FileTree): SpecFiles
```

### @github-to-mcp/mcp-server

MCP server implementation for generated servers.

**Responsibilities:**
- MCP protocol implementation
- Tool registration and execution
- Transport handling (stdio, HTTP)
- Error handling

**Key Components:**

```typescript
// MCP Server
class McpServer {
  addTool(tool: ToolDefinition): void
  start(): Promise<void>
  stop(): Promise<void>
}

// Transports
class StdioTransport implements Transport {}
class HttpTransport implements Transport {}
```

## Data Flow

### Generation Flow

```
1. User Input (GitHub URL)
           ↓
2. GithubClient.getRepository()
   - Fetch metadata
   - Fetch README
   - Fetch file tree
           ↓
3. classifyRepository()
   - Analyze patterns
   - Determine type
           ↓
4. Extractors.extract()
   - Universal tools
   - OpenAPI extraction
   - GraphQL extraction
   - Code analysis
           ↓
5. CodeGenerator.generate()
   - Apply templates
   - Generate implementations
           ↓
6. Bundler.bundle()
   - Create package.json
   - Organize files
   - Write to disk
```

### Tool Execution Flow

```
1. AI Client sends tools/call
           ↓
2. McpServer receives request
   - Parse JSON-RPC
   - Validate parameters
           ↓
3. Tool.execute()
   - Run implementation
   - Handle errors
           ↓
4. Format response
   - Create content array
   - Return result
```

## File Organization

### Core Package Structure

```
packages/core/
├── src/
│   ├── index.ts           # Public exports
│   ├── generator.ts       # Main generator class
│   ├── types.ts           # TypeScript types
│   ├── github/
│   │   ├── client.ts      # GitHub API client
│   │   ├── cache.ts       # Request caching
│   │   └── types.ts       # GitHub types
│   ├── classification/
│   │   ├── classifier.ts  # Repository classifier
│   │   └── patterns.ts    # Detection patterns
│   ├── extractors/
│   │   ├── universal.ts   # Universal tools
│   │   ├── openapi.ts     # OpenAPI extractor
│   │   ├── graphql.ts     # GraphQL extractor
│   │   └── code.ts        # Code analysis
│   ├── generators/
│   │   ├── typescript.ts  # TS code generator
│   │   └── python.ts      # Python code generator
│   └── utils/
│       ├── schema.ts      # JSON Schema helpers
│       └── naming.ts      # Naming conventions
├── tests/
├── package.json
└── tsconfig.json
```

### Web App Structure

```
apps/web/
├── app/
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   ├── api/
│   │   └── generate/      # API routes
│   ├── playground/        # Playground page
│   └── batch/             # Batch conversion
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── GeneratorForm.tsx
│   └── ...
├── lib/
│   ├── generator.ts       # Client-side generator
│   └── utils.ts
└── public/
```

## Design Decisions

### Why Monorepo?

- **Shared code**: Common utilities across packages
- **Atomic changes**: Related changes in one PR
- **Consistent tooling**: Same lint, test, build config
- **Easy local development**: Automatic linking

### Why TypeScript?

- **Type safety**: Catch errors at compile time
- **Better DX**: IDE autocomplete and documentation
- **Self-documenting**: Types serve as documentation
- **Industry standard**: Common in JS/TS ecosystem

### Why Next.js for Web?

- **Server components**: Fast initial load
- **API routes**: Built-in backend
- **Vercel deployment**: Zero-config hosting
- **React ecosystem**: Rich component libraries

### Why Separate Parser Package?

- **Reusability**: Can be used independently
- **Testability**: Easier to test in isolation
- **Performance**: Tree-shakeable for size
- **Maintenance**: Clear boundaries

---

## See Also

- [Development Setup](development.md) - Get started contributing
- [Testing](testing.md) - Write and run tests
- [How It Works](../concepts/how-it-works.md) - User-facing explanation
